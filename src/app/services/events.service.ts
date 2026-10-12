import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { EventKind, LEGIONS } from '../defs/event-kind';
import { SupabaseService } from './supabase.service';

export interface DEventParticipant {
  id: number;
  member_id: number;
  is_substitute: boolean;
  power: number | null;
  score: number | null;
  showed_up: boolean | null;
  registered: boolean;
  notes: string | null;
  member: { id: number; name: string; gameId: number | null };
}

export interface DEvent {
  id: number;
  date: string;
  time: string;
  legion: number;
  opponent: string | null;
  opponent_score: number | null;
  opponent_2: string | null;
  opponent_2_score: number | null;
  our_score: number | null;
  notes: string | null;
  participants: DEventParticipant[];
}

export type DEventUpdate = Partial<
  Pick<
    DEvent,
    | 'time'
    | 'legion'
    | 'opponent'
    | 'opponent_score'
    | 'opponent_2'
    | 'opponent_2_score'
    | 'our_score'
    | 'notes'
  >
>;

export type DParticipantUpdate = Partial<
  Pick<
    DEventParticipant,
    'is_substitute' | 'power' | 'score' | 'showed_up' | 'registered' | 'notes'
  >
>;

export interface DDayPlan {
  date: string;
  events: {
    id: number | null;
    time: string;
    legion: number;
    participants: {
      member_id: number;
      is_substitute: boolean;
      power: number | null;
      registered: boolean;
    }[];
  }[];
}

const TABLES = {
  foundry: { event: 'foundries', participant: 'foundry_participants', fk: 'foundry_id' },
  'canyon-clash': {
    event: 'canyon_clashes',
    participant: 'canyon_clash_participants',
    fk: 'clash_id',
  },
} as const;

/**
 * Foundries and Canyon Clashes share the same columns apart from the participant FK name,
 * so both are read/written through here and normalised into `DEvent`.
 */
@Injectable({
  providedIn: 'root',
})
export class EventsService {
  private readonly supabase = inject(SupabaseService).client as unknown as SupabaseClient;

  async list(p_kind: EventKind): Promise<DEvent[]> {
    const { data, error } = await this.supabase
      .from(TABLES[p_kind].event)
      .select('*')
      .order('date', { ascending: false })
      .order('legion', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((p_row) => this.toEvent(p_row));
  }

  async listForDate(p_kind: EventKind, p_date: string): Promise<DEvent[]> {
    const t = TABLES[p_kind];
    const { data, error } = await this.supabase
      .from(t.event)
      .select(`*, participants:${t.participant}(*, member:members(id, name, gameId))`)
      .eq('date', p_date)
      .order('legion', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((p_row) => this.toEvent(p_row));
  }

  async updateEvent(p_kind: EventKind, p_id: number, p_changes: DEventUpdate): Promise<void> {
    const changes: Record<string, unknown> = { ...p_changes };
    if (p_kind === 'foundry') {
      // foundries has no second opponent
      delete changes['opponent_2'];
      delete changes['opponent_2_score'];
    }
    const { error } = await this.supabase.from(TABLES[p_kind].event).update(changes).eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateParticipant(
    p_kind: EventKind,
    p_id: number,
    p_changes: DParticipantUpdate,
  ): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES[p_kind].participant)
      .update(p_changes)
      .eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /** Deletes the event and its participants. */
  async removeEvent(p_kind: EventKind, p_id: number): Promise<void> {
    const t = TABLES[p_kind];
    const { error: participantsError } = await this.supabase
      .from(t.participant)
      .delete()
      .eq(t.fk, p_id);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    const { error } = await this.supabase.from(t.event).delete().eq('id', p_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Applies the registration grid for one day: creates/updates/removes the legion events
   * and syncs each event's participants. Writes are batched per event to keep the window
   * for a half-saved day small.
   */
  async updateDay(p_kind: EventKind, p_plan: DDayPlan): Promise<void> {
    const t = TABLES[p_kind];

    for (const w_event of p_plan.events) {
      if (!w_event.time) {
        if (w_event.id) {
          await this.removeEvent(p_kind, w_event.id);
        }
        continue;
      }

      let w_eventId = w_event.id;
      if (w_eventId) {
        await this.updateEvent(p_kind, w_eventId, {
          time: w_event.time,
          legion: w_event.legion,
        });
      } else {
        const { data, error } = await this.supabase
          .from(t.event)
          .insert({ date: p_plan.date, time: w_event.time, legion: w_event.legion })
          .select('id')
          .single();
        if (error) {
          throw new Error(error.message);
        }
        w_eventId = data.id as number;
      }

      await this.syncParticipants(p_kind, w_eventId, w_event.participants);
    }
  }

  private async syncParticipants(
    p_kind: EventKind,
    p_eventId: number,
    p_wanted: DDayPlan['events'][number]['participants'],
  ): Promise<void> {
    const t = TABLES[p_kind];

    const { data: current, error } = await this.supabase
      .from(t.participant)
      .select('id, member_id, is_substitute, power, registered')
      .eq(t.fk, p_eventId);

    if (error) {
      throw new Error(error.message);
    }

    const toRemove = current.filter(
      (p_current) => !p_wanted.some((p_wanted) => p_wanted.member_id === p_current.member_id),
    );
    const toInsert = p_wanted.filter(
      (p_wanted) => !current.some((p_current) => p_current.member_id === p_wanted.member_id),
    );

    for (const w_current of current) {
      const w_wanted = p_wanted.find((p_wanted) => p_wanted.member_id === w_current.member_id);
      if (
        w_wanted &&
        (w_wanted.is_substitute !== w_current.is_substitute ||
          w_wanted.power !== w_current.power ||
          w_wanted.registered !== w_current.registered)
      ) {
        await this.updateParticipant(p_kind, w_current.id, {
          is_substitute: w_wanted.is_substitute,
          power: w_wanted.power,
          registered: w_wanted.registered,
        });
      }
    }

    if (toInsert.length) {
      const { error: insertError } = await this.supabase
        .from(t.participant)
        .insert(toInsert.map((p_participant) => ({ ...p_participant, [t.fk]: p_eventId })));
      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    if (toRemove.length) {
      const { error: removeError } = await this.supabase
        .from(t.participant)
        .delete()
        .in(
          'id',
          toRemove.map((p_current) => p_current.id),
        );
      if (removeError) {
        throw new Error(removeError.message);
      }
    }
  }

  private toEvent(p_row: Record<string, any>): DEvent {
    return {
      id: p_row['id'],
      date: p_row['date'],
      time: p_row['time'],
      legion: p_row['legion'],
      opponent: p_row['opponent'] ?? null,
      opponent_score: p_row['opponent_score'] ?? null,
      opponent_2: p_row['opponent_2'] ?? null,
      opponent_2_score: p_row['opponent_2_score'] ?? null,
      our_score: p_row['our_score'] ?? null,
      notes: p_row['notes'] ?? null,
      participants: ((p_row['participants'] ?? []) as DEventParticipant[])
        .map((p_participant) => ({
          ...p_participant,
          is_substitute: p_participant.is_substitute ?? false,
          registered: p_participant.registered ?? false,
        }))
        .sort(compareParticipants),
    };
  }
}

/**
 * Puts one day's events into legion slots (index 0 = L1, 1 = L2). Events with an invalid legion
 * (old rows saved as legion 0) may fill an empty slot; anything else left over is an "extra",
 * typically a duplicate from a half-finished save.
 */
export function assignLegionSlots(p_events: DEvent[]): {
  slots: (DEvent | null)[];
  extras: DEvent[];
} {
  const remaining = [...p_events];
  const take = (p_predicate: (p_event: DEvent) => boolean) => {
    const index = remaining.findIndex(p_predicate);
    return index >= 0 ? remaining.splice(index, 1)[0] : null;
  };
  const isValidLegion = (p_legion: number) => (LEGIONS as readonly number[]).includes(p_legion);

  const slots = LEGIONS.map((p_legion) => take((e) => e.legion === p_legion));
  return {
    slots: slots.map((p_event) => p_event ?? take((e) => !isValidLegion(e.legion))),
    extras: remaining,
  };
}

/** Regulars first, then by power (highest first), then name. */
export function compareParticipants(a: DEventParticipant, b: DEventParticipant): number {
  return (
    Number(a.is_substitute) - Number(b.is_substitute) ||
    (b.power ?? -1) - (a.power ?? -1) ||
    a.member.name.localeCompare(b.member.name)
  );
}

/**
 * 1 = we won. For Canyon Clash 2/3 = second/third place.
 * `null` until every relevant score has been entered.
 */
export function eventPlacement(p_event: DEvent): number | null {
  if (p_event.our_score == null) {
    return null;
  }
  const opponentScores = [p_event.opponent_score];
  if (p_event.opponent_2 || p_event.opponent_2_score != null) {
    opponentScores.push(p_event.opponent_2_score);
  }
  if (opponentScores.some((p_score) => p_score == null)) {
    return null;
  }
  return 1 + opponentScores.filter((p_score) => p_score! > p_event.our_score!).length;
}
