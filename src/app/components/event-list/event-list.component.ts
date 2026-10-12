import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { LocalTimePipe } from '../../defs/local-time';
import { addDays, DCalendarEvent, occurrencesInRange, shortTime } from '../../defs/calendar';
import { CalendarService } from '../../services/calendar.service';
import { injectEventKind, LEGIONS, todayUtc } from '../../defs/event-kind';
import {
  assignLegionSlots,
  DEvent,
  eventPlacement,
  EventsService,
} from '../../services/events.service';

type DayStatus = 'Upcoming' | 'Today' | 'Done';

/** How far ahead calendar dates show up as "planned". */
const PLANNED_WEEKS = 8;
type StatusFilter = DayStatus | 'All';

interface DDay {
  date: string;
  status: DayStatus;
  /** Indexed by legion slot (L1, L2); `null` when that legion isn't playing. */
  legions: (DEvent | null)[];
  /** Events that don't fit a legion slot (duplicates / legacy rows). */
  extras: DEvent[];
  /** On the calendar but not set up here yet, e.g. "Foundry 14 · 14:00". */
  planned: string[];
}

@Component({
  selector: 'app-event-list',
  imports: [DecimalPipe, RouterLink, LocalTimePipe],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class EventListComponent {
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly calendarService = inject(CalendarService);

  readonly config = injectEventKind();
  readonly legions = LEGIONS;
  readonly today = todayUtc();

  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('All');
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly events = signal<DEvent[]>([]);
  /** Calendar events of this kind (admins only; empty for everyone else). */
  readonly calendarEvents = signal<DCalendarEvent[]>([]);

  /** Upcoming calendar dates for this kind that have no record yet. */
  private readonly plannedDates = computed(() => {
    const recorded = new Set(this.events().map((e) => e.date));
    const planned = new Map<string, string[]>();
    const occurrences = occurrencesInRange(
      this.calendarEvents(),
      this.today,
      addDays(this.today, PLANNED_WEEKS * 7),
    );
    for (const occurrence of occurrences) {
      if (occurrence.skipped || recorded.has(occurrence.start)) {
        continue;
      }
      const label = occurrence.event.start_time
        ? `${occurrence.event.title} · ${shortTime(occurrence.event.start_time)} UTC`
        : occurrence.event.title;
      planned.set(occurrence.start, [...(planned.get(occurrence.start) ?? []), label]);
    }
    return planned;
  });

  readonly days = computed<DDay[]>(() => {
    const byDate = new Map<string, DEvent[]>();
    for (const w_event of this.events()) {
      byDate.set(w_event.date, [...(byDate.get(w_event.date) ?? []), w_event]);
    }

    const status = (p_date: string): DayStatus =>
      p_date > this.today ? 'Upcoming' : p_date === this.today ? 'Today' : 'Done';

    const recordedDays = [...byDate.entries()].map(([date, events]) => {
      const { slots, extras } = assignLegionSlots(events);
      return { date, status: status(date), legions: slots, extras, planned: [] };
    });
    const plannedDays = [...this.plannedDates().entries()].map(([date, planned]) => ({
      date,
      status: status(date),
      legions: LEGIONS.map(() => null),
      extras: [],
      planned,
    }));
    return [...recordedDays, ...plannedDays].sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly filteredDays = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const selectedStatus = this.statusFilter();

    return this.days().filter((day) => {
      const searchableValue = [
        day.date,
        ...this.events()
          .filter((p_event) => p_event.date === day.date)
          .flatMap((p_event) => [p_event.time, p_event.opponent, p_event.opponent_2]),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = query.length === 0 || searchableValue.includes(query);
      const matchesStatus = selectedStatus === 'All' || day.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  });

  private readonly placements = computed(() =>
    this.events()
      .filter((p_event) => p_event.date <= this.today)
      .map((p_event) => eventPlacement(p_event)),
  );

  readonly wins = computed(() => this.placements().filter((p) => p === 1).length);
  readonly losses = computed(() => this.placements().filter((p) => p != null && p > 1).length);
  readonly missingResults = computed(() => this.placements().filter((p) => p == null).length);
  readonly winPercentage = computed(() => {
    const decided = this.wins() + this.losses();
    return decided === 0 ? null : (this.wins() / decided) * 100;
  });
  readonly upcomingDays = computed(
    () => this.days().filter((p_day) => p_day.status !== 'Done').length,
  );

  placement(p_event: DEvent): number | null {
    return eventPlacement(p_event);
  }

  dayClick(p_day: DDay): void {
    // Planned dates go straight to setting up registrations
    const page = p_day.planned.length ? 'manage-members' : 'manage';
    void this.router.navigate([this.config.path, page, p_day.date]);
  }

  setSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('All');
  }

  private async _load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [events, calendarEvents] = await Promise.all([
        this.eventsService.list(this.config.kind),
        // The calendar is admin-only; for everyone else this just stays empty
        this.calendarService.list().catch(() => [] as DCalendarEvent[]),
      ]);
      this.events.set(events);
      this.calendarEvents.set(calendarEvents.filter((e) => e.kind === this.config.kind));
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : `Unable to load ${this.config.plural}`,
      );
    } finally {
      this.loading.set(false);
    }
  }

  async ngOnInit() {
    await this._load();
  }
}
