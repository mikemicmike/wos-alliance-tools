import { inject, Injectable, Service } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DMemberLogInsert = Database['public']['Tables']['member_log']['Insert'];

export type DMemberLogUpdate = Database['public']['Tables']['member_log']['Update'];

@Injectable({
  providedIn: 'root',
})
export class MemberLogService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase.from('member_log').select('*').eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw 'record not found';
    }

    return data[0];
  }

  async list(p_member: number) {
    const { data, error } = await this.supabase
      .from('member_log')
      .select('*')
      .eq('member_id', p_member)
      .order('created_at');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DMemberLogInsert) {
    const { data, error } = await this.supabase.from('member_log').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DMemberLogUpdate) {
    const { data, error } = await this.supabase
      .from('member_log')
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
    const { error } = await this.supabase.from('member_log').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
