import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { DCalendarCheckpoint, DCalendarEvent } from '../defs/calendar';
import { SupabaseService } from './supabase.service';

export type DCalendarEventInput = Omit<DCalendarEvent, 'id' | 'checkpoints' | 'skips'> & {
  id: number | null;
};

export type DCheckpointInput = Omit<DCalendarCheckpoint, 'id' | 'event_id'> & {
  id: number | null;
};

/**
 * Admin-only calendar (enforced by RLS). Uses an untyped client until `npm run gen:types`
 * has been run after the calendar migration.
 */
@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private readonly supabase = inject(SupabaseService).client as unknown as SupabaseClient;

  async list(): Promise<DCalendarEvent[]> {
    const { data, error } = await this.supabase
      .from('calendar_events')
      .select(
        '*, checkpoints:calendar_event_checkpoints(*), skips:calendar_event_skips(occurrence_date)',
      )
      .order('start_date');

    if (error) {
      throw new Error(error.message);
    }

    return (data as any[]).map((p_row) => ({
      ...p_row,
      checkpoints: (p_row.checkpoints as DCalendarCheckpoint[]).sort(
        (a, b) => a.day_offset - b.day_offset || (a.time ?? '').localeCompare(b.time ?? ''),
      ),
      skips: (p_row.skips as { occurrence_date: string }[]).map((s) => s.occurrence_date),
    }));
  }

  /** Saves the event and its checkpoints in one transaction (`save_calendar_event`). */
  async save(p_event: DCalendarEventInput, p_checkpoints: DCheckpointInput[]): Promise<number> {
    const { data, error } = await this.supabase.rpc('save_calendar_event', {
      p_event,
      p_checkpoints,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as number;
  }

  /** Checkpoints and skips go with it (`on delete cascade`). */
  async remove(p_id: number): Promise<void> {
    const { error } = await this.supabase.from('calendar_events').delete().eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async skipOccurrence(p_eventId: number, p_date: string): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_event_skips')
      .insert({ event_id: p_eventId, occurrence_date: p_date });

    if (error) {
      throw new Error(error.message);
    }
  }

  async restoreOccurrence(p_eventId: number, p_date: string): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_event_skips')
      .delete()
      .eq('event_id', p_eventId)
      .eq('occurrence_date', p_date);

    if (error) {
      throw new Error(error.message);
    }
  }
}
