import { inject, Injectable } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DUserProfile = Database['public']['Tables']['user_profiles']['Row'];

export type DUserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];

export type DUserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

@Injectable({
  providedIn: 'root',
})
export class UserProfilesService {
  private readonly supabase = inject(SupabaseService).client;

  async list(): Promise<DUserProfile[]> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .order('display_name', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DUserProfileInsert): Promise<DUserProfile> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: DUserProfile['id'], changes: DUserProfileUpdate): Promise<DUserProfile> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async remove(id: DUserProfile['id']): Promise<void> {
    const { error } = await this.supabase.from('user_profiles').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
