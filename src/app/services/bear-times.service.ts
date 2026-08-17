import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DBearTimeInsert = Database['public']['Tables']['bear_times']['Insert'];

export type DBearTimeUpdate = Database['public']['Tables']['bear_times']['Update'];

@Injectable({
  providedIn: 'root',
})
export class BearTimesService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase.from('bear_times').select('*').eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list() {
    const { data, error } = await this.supabase.from('bear_times').select('*').order('label');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DBearTimeInsert) {
    const { data, error } = await this.supabase.from('bear_times').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DBearTimeUpdate) {
    const { data, error } = await this.supabase
      .from('bear_times')
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
    const { error } = await this.supabase.from('bear_times').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
