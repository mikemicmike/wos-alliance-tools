import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DStatusInsert = Database['public']['Tables']['statuses']['Insert'];

export type DStatusUpdate = Database['public']['Tables']['statuses']['Update'];

@Injectable({
  providedIn: 'root',
})
export class StatusesService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase.from('statuses').select('*').eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list() {
    const { data, error } = await this.supabase.from('statuses').select('*').order('status');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DStatusInsert) {
    const { data, error } = await this.supabase.from('statuses').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DStatusUpdate) {
    const { data, error } = await this.supabase
      .from('statuses')
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
    const { error } = await this.supabase.from('statuses').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
