import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';
import {
  DFoundryParticipantsUpdate,
  FoundryParticipantsService,
} from './foundry-participants.service';
import fa from '@angular/common/locales/fa';

export type DFoundryInsert = Database['public']['Tables']['foundries']['Insert'];

export type DFoundryUpdate = Database['public']['Tables']['foundries']['Update'];

@Injectable({
  providedIn: 'root',
})
export class FoundriesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly foundryParticipantsService = inject(FoundryParticipantsService);
  async getSingle(p_id: number) {
    const { data, error } = await this.supabase
      .from('foundries')
      .select('*, foundry_participants(*)')
      .eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list() {
    const { data, error } = await this.supabase
      .from('foundries')
      .select('*, foundry_participants(*)')
      .order('date', {
        ascending: false,
      })
      .order('legion', {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async listForDate(p_date: string) {
    const { data, error } = await this.supabase
      .from('foundries')
      .select('*, foundry_participants(*, members(id, name)) ')
      .eq('date', p_date)
      .order('time', {
        ascending: true,
      })
      .order('score', {
        ascending: false,
        referencedTable: 'foundry_participants',
      })
      .order('power', {
        ascending: false,
        referencedTable: 'foundry_participants',
      })
      .order('name', {
        ascending: false,
        referencedTable: 'foundry_participants.members',
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DFoundryInsert) {
    const { data, error } = await this.supabase.from('foundries').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DFoundryUpdate) {
    const { data, error } = await this.supabase
      .from('foundries')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async updateDay(data: {
    date: string;
    foundries: {
      id: number | null;
      time: string;
      legion: number;
      participants: {
        member_id: number;
        is_substitute: boolean;
        power: number | null;
      }[];
    }[];
  }) {
    for (let [x_foundry, w_foundry] of data.foundries.entries()) {
      if (!w_foundry.time) {
        if (w_foundry.id) {
          await this.remove(w_foundry.id);
        }
        continue;
      }
      let w_created = false;
      let w_foundryId = w_foundry.id;
      if (w_foundry.id) {
        await this.update(w_foundry.id, {
          date: data.date,
          time: w_foundry.time,
          legion: w_foundry.legion,
        });
      } else {
        w_foundryId = (
          await this.create({
            date: data.date,
            time: w_foundry.time || '',
            legion: w_foundry.legion,
            status: 'Upcoming',
          })
        ).id;
        w_created = true;
      }

      if (!w_foundryId) {
        throw new Error('something weird going on we dont have an id...');
      }

      let a_currentParticipants: Awaited<ReturnType<FoundryParticipantsService['listByFoundry']>> =
        w_created ? [] : await this.foundryParticipantsService.listByFoundry(w_foundryId);

      for (const w_participant of w_foundry.participants) {
        const w_current = a_currentParticipants.find(
          (p_current) => p_current.member_id === w_participant.member_id,
        );
        if (w_current) {
          await this.foundryParticipantsService.update(w_current.id, {
            is_substitute: w_participant.is_substitute,
            power: w_participant.power,
          });
          a_currentParticipants = a_currentParticipants.filter(
            (p_current) => p_current !== w_current,
          );
        } else {
          await this.foundryParticipantsService.create({
            is_substitute: w_participant.is_substitute,
            power: w_participant.power,
            foundry_id: w_foundryId,
            member_id: w_participant.member_id,
          });
        }
      }
      for (const w_current of a_currentParticipants) {
        await this.foundryParticipantsService.remove(w_current.id);
      }
    }
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.supabase.from('foundries').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
