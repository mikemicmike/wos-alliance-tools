import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';

export type TaskRole = 'owner' | 'backup';

export interface DTaskAssignment {
  id: number;
  task_id: number;
  member_id: number;
  role: TaskRole;
  notes: string | null;
  member: { id: number; name: string; gameId: number | null };
}

export interface DTask {
  id: number;
  created_at: string;
  title: string;
  notes: string | null;
  assignments: DTaskAssignment[];
}

/**
 * Admin-only task list (the database enforces that through RLS).
 * Uses an untyped client until `npm run gen:types` has been run after the tasks migration.
 */
@Injectable({
  providedIn: 'root',
})
export class TasksService {
  private readonly supabase = inject(SupabaseService).client as unknown as SupabaseClient;

  async list(): Promise<DTask[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, assignments:task_assignments(*, member:members(id, name, gameId))')
      .order('title');

    if (error) {
      throw new Error(error.message);
    }

    return data as DTask[];
  }

  async createTask(p_title: string, p_notes: string | null): Promise<void> {
    const { error } = await this.supabase.from('tasks').insert({ title: p_title, notes: p_notes });

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateTask(p_id: number, p_changes: { title?: string; notes?: string | null }) {
    const { error } = await this.supabase.from('tasks').update(p_changes).eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /** Its assignments go with it (`on delete cascade`). */
  async removeTask(p_id: number): Promise<void> {
    const { error } = await this.supabase.from('tasks').delete().eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async addAssignment(p_input: {
    task_id: number;
    member_id: number;
    role: TaskRole;
    notes: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from('task_assignments').insert(p_input);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateAssignment(p_id: number, p_changes: { role?: TaskRole; notes?: string | null }) {
    const { error } = await this.supabase.from('task_assignments').update(p_changes).eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async removeAssignment(p_id: number): Promise<void> {
    const { error } = await this.supabase.from('task_assignments').delete().eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
