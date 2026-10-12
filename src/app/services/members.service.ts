import { inject, Injectable } from '@angular/core';
import { Database } from '../defs/database.types';
import { SupabaseService } from './supabase.service';

export type DMemberInsert = Database['public']['Tables']['members']['Insert'];

export type DMemberUpdate = Database['public']['Tables']['members']['Update'];

const MEMBER_SELECT = `
  *,
  bear_times(label),
  statuses(status, is_active, is_transferred_out, color),
  canyon_clash_participants(
    id,
    power,
    score,
    showed_up,
    is_substitute,
    registered,
    notes,
    canyon_clashes(
      date,
      time,
      legion
    )
  ),
  foundry_participants(
    id,
    power,
    score,
    showed_up,
    is_substitute,
    registered,
    notes,
    foundries(
      date,
      time,
      legion
    )
  ),
  member_log(id, created_at, type, previous_value_num, previous_value_text, new_value_num, new_value_text)
` as const;

/**
 * PostgREST can't order a parent's embedded rows by a column of a nested embed
 * (`foundry_participants.foundries.date`), so participation history is sorted here, newest first.
 */
function sortHistory<
  T extends {
    foundry_participants: { foundries: { date: string } }[];
    canyon_clash_participants: { canyon_clashes: { date: string } }[];
  },
>(p_member: T): T {
  p_member.foundry_participants.sort((a, b) => b.foundries.date.localeCompare(a.foundries.date));
  p_member.canyon_clash_participants.sort((a, b) =>
    b.canyon_clashes.date.localeCompare(a.canyon_clashes.date),
  );
  return p_member;
}

@Injectable({
  providedIn: 'root',
})
export class MembersService {
  private readonly supabase = inject(SupabaseService).client;

  async getSingle(p_id: number) {
    const { data, error } = await this.supabase
      .from('members')
      .select(MEMBER_SELECT)
      .eq('id', p_id)
      .order('created_at', {
        referencedTable: 'member_log',
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    if (!data[0]) {
      throw new Error('Member not found');
    }

    return sortHistory(data[0]);
  }

  async list() {
    const { data, error } = await this.supabase
      .from('members')
      .select(MEMBER_SELECT)
      .order('rank', { ascending: false })
      .order('power', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map(sortHistory);
  }

  async getActiveMembers() {
    const { data, error } = await this.supabase
      .from('members')
      .select(
        `
          id,
          name,
          gameId,
          power,
          statuses!inner(is_active),
          canyon_clash_participants(power, showed_up, canyon_clashes(date)),
          foundry_participants(power, showed_up, foundries(date))
        `,
      )
      // !inner makes this filter the members themselves, not just the embedded status
      .eq('statuses.is_active', true)
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return data.map(sortHistory);
  }

  /** Active members for pickers (name, game ID, rank). */
  async listActiveNames() {
    const { data, error } = await this.supabase
      .from('members')
      .select('id, name, gameId, rank, statuses!inner(is_active)')
      .eq('statuses.is_active', true)
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /** Active members with just the stats the bulk editor changes. */
  async listActiveStats() {
    const { data, error } = await this.supabase
      .from('members')
      .select(
        `
          id,
          name,
          gameId,
          rank,
          power,
          furnace_level,
          infantry_fc_level,
          infantry_tier,
          lancer_fc_level,
          lancer_tier,
          marksman_fc_level,
          marksman_tier,
          statuses!inner(is_active),
          member_log(type, created_at)
        `,
      )
      .eq('statuses.is_active', true)
      // Only the latest power change per member, for "last updated"
      .eq('member_log.type', 'power')
      .order('created_at', { referencedTable: 'member_log', ascending: false })
      .limit(1, { referencedTable: 'member_log' })
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async create(input: DMemberInsert) {
    const { data, error } = await this.supabase.from('members').insert(input).select().single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async update(id: number, changes: DMemberUpdate) {
    const { data, error } = await this.supabase
      .from('members')
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
    const { error } = await this.supabase.from('members').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
