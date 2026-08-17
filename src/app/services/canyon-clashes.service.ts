import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DCanyonClashesInsert = Database['public']['Tables']['canyon_clashes']['Insert'];

export type DCanyonClashesUpdate = Database['public']['Tables']['canyon_clashes']['Update'];

@Injectable({
  providedIn: 'root',
})
export class CanyonClashesService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase.from('canyon_clashes').select('*').eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list() {
    const { data, error } = await this.supabase.from('canyon_clashes').select('*').order('date', {
      ascending: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DCanyonClashesInsert) {
    const { data, error } = await this.supabase
      .from('canyon_clashes')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DCanyonClashesUpdate) {
    const { data, error } = await this.supabase
      .from('canyon_clashes')
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
    const { error } = await this.supabase.from('canyon_clashes').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
