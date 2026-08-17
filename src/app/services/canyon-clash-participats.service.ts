import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DCanyonClashParticipantsInsert =
  Database['public']['Tables']['canyon_clash_participants']['Insert'];

export type DCanyonClashParticipantsUpdate =
  Database['public']['Tables']['canyon_clash_participants']['Update'];

@Injectable({
  providedIn: 'root',
})
export class CanyonClashParticipantsService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase
      .from('canyon_clash_participants')
      .select('*, canyon_clashes(date, time)')
      .eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async listByClash(p_clash: number) {
    const { data, error } = await this.supabase
      .from('canyon_clash_participants')
      .select('*, canyon_clashes(date, time)')
      .eq('clash_id', p_clash)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async listByCanyonClashParticipants(p_canyonClashParticipants: number) {
    const { data, error } = await this.supabase
      .from('canyon_clash_participants')
      .select('*')
      .eq('member_id', p_canyonClashParticipants)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DCanyonClashParticipantsInsert) {
    const { data, error } = await this.supabase
      .from('canyon_clash_participants')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DCanyonClashParticipantsUpdate) {
    const { data, error } = await this.supabase
      .from('canyon_clash_participants')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.supabase.from('canyon_clash_participants').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
