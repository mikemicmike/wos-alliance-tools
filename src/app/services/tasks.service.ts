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
  category_id: number | null;
  /** Position within its category. */
  sort_order: number;
  assignments: DTaskAssignment[];
}

export interface DTaskCategory {
  id: number;
  name: string;
  sort_order: number;
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
      .order('sort_order')
      .order('title');

    if (error) {
      throw new Error(error.message);
    }

    return data as DTask[];
  }

  async listCategories(): Promise<DTaskCategory[]> {
    const { data, error } = await this.supabase
      .from('task_categories')
      .select('id, name, sort_order')
      .order('sort_order')
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return data as DTaskCategory[];
  }

  async createCategory(p_name: string, p_sortOrder: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_categories')
      .insert({ name: p_name, sort_order: p_sortOrder });

    if (error) {
      throw new Error(error.message);
    }
  }

  async renameCategory(p_id: number, p_name: string): Promise<void> {
    const { error } = await this.supabase
      .from('task_categories')
      .update({ name: p_name })
      .eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /** Its tasks become uncategorized (`on delete set null`). */
  async removeCategory(p_id: number): Promise<void> {
    const { error } = await this.supabase.from('task_categories').delete().eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /** Each id gets its position in the array, in one database call. */
  async reorderCategories(p_ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_task_categories', { p_category_ids: p_ids });

    if (error) {
      throw new Error(error.message);
    }
  }

  /** Each id gets its position in the array, in one database call. */
  async reorderTasks(p_ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_tasks', { p_task_ids: p_ids });

    if (error) {
      throw new Error(error.message);
    }
  }

  async createTask(p_input: {
    title: string;
    notes: string | null;
    category_id: number | null;
    sort_order: number;
  }): Promise<void> {
    const { error } = await this.supabase.from('tasks').insert(p_input);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateTask(
    p_id: number,
    p_changes: {
      title?: string;
      notes?: string | null;
      category_id?: number | null;
      sort_order?: number;
    },
  ) {
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

  /** Adds several people to a task in one insert. */
  async addAssignments(
    p_inputs: { task_id: number; member_id: number; role: TaskRole; notes: string | null }[],
  ): Promise<void> {
    if (!p_inputs.length) {
      return;
    }

    const { error } = await this.supabase.from('task_assignments').insert(p_inputs);

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
