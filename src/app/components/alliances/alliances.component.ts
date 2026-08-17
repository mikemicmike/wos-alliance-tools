import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlliancesService } from '../../services/alliances.service';

@Component({
  selector: 'app-alliances',
  imports: [],
  templateUrl: './alliances.component.html',
  styleUrl: './alliances.component.scss',
})
export class AlliancesComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _alliancesService = inject(AlliancesService);

  private alliances = signal<Awaited<ReturnType<AlliancesService['list']>>>([]);
  readonly searchTerm = signal('');
  error = signal<string | null>(null);
  loading = signal(true);

  // Derived state
  readonly filteredAlliances = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    return this.alliances().filter((alliance) => {
      const searchableValue = [alliance.tag, alliance.name].join(' ').toLowerCase();

      const matchesSearch = query.length === 0 || searchableValue.includes(query);

      return matchesSearch;
    });
  });

  readonly totalAlliances = computed(() => this.alliances().length);

  setSearchTerm(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  allianceClicked(p_alliance: string) {
    // this._router.navigate(['members']);
    console.log('TODO LATER');
  }
  clearFilters(): void {
    this.searchTerm.set('');
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.alliances.set(await this._alliancesService.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load alliances');
    } finally {
      this.loading.set(false);
    }
  }
  async ngOnInit(): Promise<void> {
    await this.load();
  }
}
