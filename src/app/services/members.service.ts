import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DMemberInsert = Database['public']['Tables']['members']['Insert'];

export type DMemberUpdate = Database['public']['Tables']['members']['Update'];

@Injectable({
  providedIn: 'root',
})
export class MembersService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase
      .from('members')
      .select(
        `
          *,
          bear_times(label),
          statuses(status, is_active, is_transferred_out, color),
          canyon_clash_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            canyon_clashes(
              date,
              time
            )
          ),
          foundry_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            foundries(
              date,
              time
            )
          ),
          member_log(id, created_at, type, previous_value_num, previous_value_text, new_value_num, new_value_text)
        `,
      )
      .eq('id', p_id)
      .order('date', {
        referencedTable: 'foundry_participants.foundries',
        ascending: false,
      })
      .order('date', {
        referencedTable: 'canyon_clash_participants.canyon_clashes',
        ascending: false,
      })
      .order('created_at', {
        referencedTable: 'member_log',
        ascending: false,
      });

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
      .from('members')
      .select(
        `
          *,
          bear_times(label),
          statuses(status, is_active, is_transferred_out, color),
          canyon_clash_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            canyon_clashes(
              date,
              time
            )
          ),
          foundry_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            foundries(
              date,
              time
            )
          ),
          member_log(id, created_at, type, previous_value_num, previous_value_text, new_value_num, new_value_text)
        `,
      )
      .order('name')
      .order('date', {
        referencedTable: 'foundry_participants.foundries',
        ascending: false,
      })
      .order('date', {
        referencedTable: 'canyon_clash_participants.canyon_clashes',
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getActiveMembers() {
    const { data, error } = await this.supabase
      .from('members')
      .select(
        `
          *,
          bear_times(label),
          statuses(status, is_active, is_transferred_out, color),
          canyon_clash_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            canyon_clashes(
              date,
              time
            )
          ),
          foundry_participants(
            id,
            power,
            score,
            showed_up,
            is_substitute,
            foundries(
              date,
              time
            )
          ),
          member_log(id, created_at, type, previous_value_num, previous_value_text, new_value_num, new_value_text)
        `,
      )
      .eq('statuses.is_active', true)
      .order('name')
      .order('date', {
        referencedTable: 'foundry_participants.foundries',
        ascending: false,
      })
      .order('date', {
        referencedTable: 'canyon_clash_participants.canyon_clashes',
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DMemberInsert) {
    const { data, error } = await this.supabase.from('members').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DMemberUpdate) {
    const { data, error } = await this.supabase
      .from('members')
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
    const { error } = await this.supabase.from('members').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
