import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { injectEventKind, LEGIONS, todayUtc } from '../../defs/event-kind';
import {
  assignLegionSlots,
  DEvent,
  eventPlacement,
  EventsService,
} from '../../services/events.service';

type DayStatus = 'Upcoming' | 'Today' | 'Done';
type StatusFilter = DayStatus | 'All';

interface DDay {
  date: string;
  status: DayStatus;
  /** Indexed by legion slot (L1, L2); `null` when that legion isn't playing. */
  legions: (DEvent | null)[];
  /** Events that don't fit a legion slot (duplicates / legacy rows). */
  extras: DEvent[];
}

@Component({
  selector: 'app-event-list',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class EventListComponent {
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);

  readonly config = injectEventKind();
  readonly legions = LEGIONS;
  readonly today = todayUtc();

  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('All');
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly events = signal<DEvent[]>([]);

  readonly days = computed<DDay[]>(() => {
    const byDate = new Map<string, DEvent[]>();
    for (const w_event of this.events()) {
      byDate.set(w_event.date, [...(byDate.get(w_event.date) ?? []), w_event]);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, events]) => {
        const { slots, extras } = assignLegionSlots(events);
        return {
          date,
          status: date > this.today ? 'Upcoming' : date === this.today ? 'Today' : 'Done',
          legions: slots,
          extras,
        };
      });
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
    void this.router.navigate([this.config.path, 'manage', p_day.date]);
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
      this.events.set(await this.eventsService.list(this.config.kind));
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
