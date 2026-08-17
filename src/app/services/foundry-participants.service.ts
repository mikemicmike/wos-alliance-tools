import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DFoundryParticipantsInsert =
  Database['public']['Tables']['foundry_participants']['Insert'];

export type DFoundryParticipantsUpdate =
  Database['public']['Tables']['foundry_participants']['Update'];

@Injectable({
  providedIn: 'root',
})
export class FoundryParticipantsService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase
      .from('foundry_participants')
      .select('*, foundries(date, time)')
      .eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async listByFoundry(p_foundry: number) {
    const { data, error } = await this.supabase
      .from('foundry_participants')
      .select('*, foundries(date, time), members(id, name)')
      .eq('foundry_id', p_foundry)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DFoundryParticipantsInsert) {
    const { data, error } = await this.supabase
      .from('foundry_participants')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DFoundryParticipantsUpdate) {
    const { data, error } = await this.supabase
      .from('foundry_participants')
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
    const { error } = await this.supabase.from('foundry_participants').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
