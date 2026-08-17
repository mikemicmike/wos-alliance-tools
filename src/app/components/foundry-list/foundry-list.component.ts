import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FoundriesService } from '../../services/foundries.service';
import { DecimalPipe } from '@angular/common';

type StatusFilter = 'Upcoming' | 'Finished' | 'Completed' | 'All';
type LegionFilter = 0 | 1 | 2;

type DFoundry = Awaited<ReturnType<FoundriesService['list']>>[number];
@Component({
  selector: 'app-foundry-list.component',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './foundry-list.component.html',
  styleUrl: './foundry-list.component.scss',
})
export class FoundryListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly foundriesService = inject(FoundriesService);

  // Source state
  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('All');
  readonly legionFilter = signal<LegionFilter>(0);
  error = signal<string | null>(null);
  loading = signal(true);

  readonly foundries = signal<DFoundry[]>([]);

  /**
   * Only one member card is expanded at a time.
   */
  readonly expandedMemberId = signal<number | null>(null);

  foundryClick(foundry: DFoundry): void {
    this.router.navigate(['/foundries/manage/', foundry.date]);
  }

  public stringDateCurrent = computed(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Derived state
  readonly filteredFoundries = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const selectedStatus = this.statusFilter();
    const selectedLegion = this.legionFilter();

    return this.foundries().filter((foundry) => {
      const searchableValue = [foundry.opponent, foundry.legion, foundry.time, foundry.date]
        .join(' ')
        .toLowerCase();

      const matchesSearch = query.length === 0 || searchableValue.includes(query);

      const matchesStatus = selectedStatus === 'All' || foundry.status === selectedStatus;

      const matchesLegion = selectedLegion === 0 || foundry.legion === selectedLegion;

      return matchesSearch && matchesStatus && matchesLegion;
    });
  });

  readonly totalFoundries = computed(() => this.foundries().length);

  readonly winPercentage = computed(
    () => (this.wonFoundries() / (this.wonFoundries() + this.lostFoundries())) * 100,
  );

  readonly wonFoundries = computed(
    () =>
      this.foundries().filter(
        (foundry) =>
          foundry.opponent_score != null &&
          foundry.our_score != null &&
          foundry.opponent_score < foundry.our_score,
      ).length,
  );

  readonly lostFoundries = computed(
    () =>
      this.foundries().filter(
        (foundry) =>
          foundry.opponent_score != null &&
          foundry.our_score != null &&
          foundry.opponent_score > foundry.our_score,
      ).length,
  );

  readonly unknownFoundries = computed(
    () =>
      this.foundries().filter(
        (foundry) => foundry.opponent_score == null || foundry.our_score == null,
      ).length,
  );
  readonly upcomingFoundries = computed(
    () => this.foundries().filter((foundry) => foundry.status === 'Upcoming').length,
  );
  readonly finishedFoundries = computed(
    () => this.foundries().filter((foundry) => foundry.status === 'Finished').length,
  );
  readonly completedFoundries = computed(
    () => this.foundries().filter((foundry) => foundry.status === 'Completed').length,
  );

  setSearchTerm(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  setStatusFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value as StatusFilter);
  }

  setLegionFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.legionFilter.set(Number(select.value) as LegionFilter);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('All');
    this.legionFilter.set(0);
  }

  private async _load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.foundries.set(await this.foundriesService.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load Members');
    } finally {
      this.loading.set(false);
    }

    this.loading.set(false);
  }

  async ngOnInit() {
    await this._load();
  }
}
