import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DAllianceInsert = Database['public']['Tables']['alliances']['Insert'];

export type DAllianceUpdate = Database['public']['Tables']['alliances']['Update'];

@Injectable({
  providedIn: 'root',
})
export class AlliancesService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_tag: string) {
    const { data, error } = await this.supabase.from('alliances').select('*').eq('tag', p_tag);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list() {
    const { data, error } = await this.supabase.from('alliances').select('*').order('tag');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DAllianceInsert) {
    const { data, error } = await this.supabase.from('alliances').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(tag: DAllianceInsert['tag'], changes: DAllianceUpdate) {
    const { data, error } = await this.supabase
      .from('alliances')
      .update(changes)
      .eq('tag', tag)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async remove(tag: DAllianceInsert['tag']): Promise<void> {
    const { error } = await this.supabase.from('alliances').delete().eq('tag', tag);

    if (error) {
      throw new Error(error.message);
    }
  }
}
