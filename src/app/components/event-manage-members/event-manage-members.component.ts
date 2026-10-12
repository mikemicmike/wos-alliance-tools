import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { injectEventKind, LEGIONS } from '../../defs/event-kind';
import { assignLegionSlots, DEvent, EventsService } from '../../services/events.service';
import { MembersService } from '../../services/members.service';

/** One per legion; L1 is always slot 0 (left), L2 slot 1 (right). */
interface DSlot {
  id: number | null;
  legion: number;
  time: string;
  /** Registrations already saved for this slot, used to warn before deleting it. */
  savedParticipants: number;
}

interface DAssignment {
  regular: boolean;
  sub: boolean;
  registered: boolean;
}

interface DMemberRow {
  memberId: number;
  gameId: number | null;
  name: string;
  /** Registered on this date but no longer has an active status. */
  inactive: boolean;
  previousPower: number | null;
  previousPowerDate: string | null;
  power: number | null;
  assignments: DAssignment[];
}

@Component({
  selector: 'app-event-manage-members',
  imports: [DecimalPipe],
  templateUrl: './event-manage-members.component.html',
  styleUrl: './event-manage-members.component.scss',
})
export class EventManageMembersComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly membersService = inject(MembersService);

  readonly config = injectEventKind();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly error = signal<string | null>(null);

  readonly date = signal('');
  readonly slots = signal<DSlot[]>([]);
  readonly members = signal<DMemberRow[]>([]);
  readonly extras = signal<DEvent[]>([]);

  readonly search = signal('');
  readonly assignedOnly = signal(false);

  readonly visibleMembers = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.members().filter(
      (p_member) =>
        (!query ||
          p_member.name.toLowerCase().includes(query) ||
          String(p_member.gameId ?? '').includes(query)) &&
        (!this.assignedOnly() || p_member.assignments.some((a) => a.regular || a.sub)),
    );
  });

  readonly counts = computed(() =>
    this.slots().map((_, slotIndex) => {
      const assignments = this.members().map((p_member) => p_member.assignments[slotIndex]);
      const regular = assignments.filter((a) => a.regular).length;
      const subs = assignments.filter((a) => a.sub).length;
      return {
        regular,
        subs,
        registered: assignments.filter((a) => a.registered).length,
        total: regular + subs,
      };
    }),
  );

  constructor() {
    // Changing the date updates the URL, which reuses this component - reload on every param change.
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.date.set(params.get('date')?.trim() ?? '');
      void this.loadData();
    });
  }

  timeOptions(p_slot: DSlot): string[] {
    // Keep legacy/unknown times selectable so loading old data doesn't blank them out
    return p_slot.time && !this.config.times.includes(p_slot.time)
      ? [p_slot.time, ...this.config.times]
      : this.config.times;
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.dirty.set(false);

    const date = this.date();

    try {
      const [activeMembers, events] = await Promise.all([
        this.membersService.getActiveMembers(),
        date ? this.eventsService.listForDate(this.config.kind, date) : Promise.resolve([]),
      ]);

      const { slots: slotEvents, extras } = assignLegionSlots(events);

      this.slots.set(
        slotEvents.map((p_event, slotIndex) => ({
          id: p_event?.id ?? null,
          legion: LEGIONS[slotIndex],
          time: p_event?.time ?? '',
          savedParticipants: p_event?.participants.length ?? 0,
        })),
      );
      this.extras.set(extras);

      const participations = slotEvents.flatMap((p_event, slotIndex) =>
        (p_event?.participants ?? []).map((p_participant) => ({ slotIndex, ...p_participant })),
      );

      const rows: DMemberRow[] = activeMembers.map((p_member) => {
        const history = [
          ...p_member.foundry_participants.map((p) => ({ date: p.foundries.date, power: p.power })),
          ...p_member.canyon_clash_participants.map((p) => ({
            date: p.canyon_clashes.date,
            power: p.power,
          })),
        ]
          .filter((p) => p.power != null && p.date < date)
          .sort((a, b) => b.date.localeCompare(a.date));

        return {
          memberId: p_member.id,
          gameId: p_member.gameId,
          name: p_member.name,
          inactive: false,
          previousPower: history[0]?.power ?? null,
          previousPowerDate: history[0]?.date ?? null,
          power: null,
          assignments: [],
        };
      });

      // Keep people who are registered here but have since gone inactive, otherwise saving would drop them
      for (const w_participation of participations) {
        if (!rows.some((p_row) => p_row.memberId === w_participation.member_id)) {
          rows.push({
            memberId: w_participation.member_id,
            gameId: w_participation.member.gameId,
            name: w_participation.member.name,
            inactive: true,
            previousPower: null,
            previousPowerDate: null,
            power: null,
            assignments: [],
          });
        }
      }

      for (const w_row of rows) {
        const own = participations.filter((p) => p.member_id === w_row.memberId);
        w_row.power = own.find((p) => p.power != null)?.power ?? null;
        w_row.assignments = slotEvents.map((_, slotIndex) => {
          const participation = own.find((p) => p.slotIndex === slotIndex);
          return {
            regular: !!participation && !participation.is_substitute,
            sub: !!participation && participation.is_substitute,
            registered: !!participation?.registered,
          };
        });
      }

      this.members.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set(error instanceof Error ? error.message : 'Unable to load.');
    } finally {
      this.loading.set(false);
    }
  }

  async dateChanged(event: Event): Promise<void> {
    const date = (event.target as HTMLInputElement).value;
    if (!date || date === this.date()) {
      return;
    }
    if (this.dirty() && !confirm('Discard your unsaved changes?')) {
      (event.target as HTMLInputElement).value = this.date();
      return;
    }
    await this.router.navigate([this.config.path, 'manage-members', date], { replaceUrl: true });
  }

  timeChanged(p_slotIndex: number, event: Event): void {
    const time = (event.target as HTMLSelectElement).value;
    this.slots.update((slots) =>
      slots.map((p_slot, slotIndex) => (slotIndex === p_slotIndex ? { ...p_slot, time } : p_slot)),
    );
    this.dirty.set(true);
  }

  powerChanged(p_memberId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateMember(p_memberId, (p_member) => ({
      ...p_member,
      power: value === '' ? null : Number(value),
    }));
  }

  assignmentChanged(
    p_memberId: number,
    p_slotIndex: number,
    p_type: 'regular' | 'sub',
    p_value: boolean,
  ): void {
    this.updateMember(p_memberId, (p_member) => ({
      ...p_member,
      // A member can only be in one legion, as either a regular or a sub
      assignments: p_member.assignments.map((p_assignment, slotIndex) => {
        if (slotIndex !== p_slotIndex) {
          return { regular: false, sub: false, registered: false };
        }
        return {
          regular: p_type === 'regular' && p_value,
          sub: p_type === 'sub' && p_value,
          // Keep the in-game flag when only switching between regular/sub in the same legion
          registered: p_value && p_assignment.registered,
        };
      }),
    }));
  }

  registeredChanged(p_memberId: number, p_slotIndex: number, p_value: boolean): void {
    this.updateMember(p_memberId, (p_member) => ({
      ...p_member,
      assignments: p_member.assignments.map((p_assignment, slotIndex) =>
        slotIndex === p_slotIndex ? { ...p_assignment, registered: p_value } : p_assignment,
      ),
    }));
  }

  async deleteExtra(p_event: DEvent): Promise<void> {
    const confirmed = confirm(
      `Delete the extra ${this.config.label} record (L${p_event.legion}, ${p_event.time || 'no time'})` +
        ` and its ${p_event.participants.length} registrations?`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.eventsService.removeEvent(this.config.kind, p_event.id);
      await this.loadData();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to delete.');
    }
  }

  async save(): Promise<void> {
    this.error.set(null);

    const slots = this.slots();
    const members = this.members();

    const times = slots.map((p_slot) => p_slot.time).filter(Boolean);
    if (new Set(times).size !== times.length) {
      this.error.set('Both legions are set to the same time.');
      return;
    }

    for (const [slotIndex, w_slot] of slots.entries()) {
      if (!w_slot.time && this.counts()[slotIndex].total > 0) {
        this.error.set(
          `Legion ${w_slot.legion} has members assigned but no time. Pick a time or unassign them.`,
        );
        return;
      }
      if (
        !w_slot.time &&
        w_slot.id &&
        !confirm(
          `Legion ${w_slot.legion} has no time anymore - its saved ${this.config.label} will be deleted. Continue?`,
        )
      ) {
        return;
      }
    }

    this.saving.set(true);

    try {
      await this.eventsService.updateDay(this.config.kind, {
        date: this.date(),
        events: slots.map((p_slot, slotIndex) => ({
          id: p_slot.id,
          time: p_slot.time,
          legion: p_slot.legion,
          participants: members
            .filter((p_member) => {
              const assignment = p_member.assignments[slotIndex];
              return assignment.regular || assignment.sub;
            })
            .map((p_member) => ({
              member_id: p_member.memberId,
              is_substitute: p_member.assignments[slotIndex].sub,
              power: p_member.power,
              registered: p_member.assignments[slotIndex].registered,
            })),
        })),
      });

      this.dirty.set(false);
      await this.router.navigate([this.config.path, 'manage', this.date()]);
    } catch (error) {
      console.error(error);
      this.error.set(
        (error instanceof Error ? error.message : 'Unable to save.') +
          ' Some changes may have been saved - reload to see the current state.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    if (this.dirty() && !confirm('Discard your unsaved changes?')) {
      return;
    }
    void this.router.navigate([this.config.path]);
  }

  /**
   * Tab moves down the current column (e.g. through every L1 "Regular") instead of across the row.
   * At the end of a column it continues at the top of the next one; past the last column the
   * browser's normal Tab takes over (on to the Save button).
   */
  gridKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (event.key !== 'Tab' || !target.dataset['col']) {
      return;
    }

    const grid = event.currentTarget as HTMLElement;
    const inputs = (p_col: number) =>
      [...grid.querySelectorAll<HTMLInputElement>(`input[data-col="${p_col}"]`)].filter(
        (p_input) => !p_input.disabled,
      );
    const step = event.shiftKey ? -1 : 1;
    const lastCol = 3 * this.slots().length;

    let col = Number(target.dataset['col']);
    let column = inputs(col);
    let next = column[column.indexOf(target as HTMLInputElement) + step];

    while (!next) {
      col += step;
      if (col < 0 || col > lastCol) {
        return;
      }
      column = inputs(col);
      next = step > 0 ? column[0] : column[column.length - 1];
    }

    event.preventDefault();
    next.focus();
  }

  private updateMember(p_memberId: number, p_fn: (p_member: DMemberRow) => DMemberRow): void {
    this.members.update((members) =>
      members.map((p_member) => (p_member.memberId === p_memberId ? p_fn(p_member) : p_member)),
    );
    this.dirty.set(true);
  }
}
