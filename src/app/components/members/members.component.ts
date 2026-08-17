import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../../services/members.service';
import { DecimalPipe } from '@angular/common';

type StatusFilter = 'Active' | 'Other_Alliance' | 'Quit' | 'Transferred' | 'All';

@Component({
  selector: 'app-members',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './members.component.html',
  styleUrl: './members.component.scss',
})
export class MembersComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly membersService = inject(MembersService);

  // Source state
  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('All');
  error = signal<string | null>(null);
  loading = signal(true);

  readonly members = signal<Awaited<ReturnType<MembersService['list']>>>([]);

  /**
   * Only one member card is expanded at a time.
   */
  readonly expandedMemberId = signal<number | null>(null);

  memberClick(memberId: number): void {
    this.router.navigate(['/member/view/', memberId]);
  }

  // Derived state
  readonly filteredMembers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const selectedStatus = this.statusFilter();

    return this.members().filter((member) => {
      const searchableValue = [
        member.id,
        member.name,
        member.rank,
        member.status,
        member.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = query.length === 0 || searchableValue.includes(query);

      const matchesStatus = selectedStatus === 'All' || member.statuses.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  });

  readonly totalMembers = computed(() => this.members().length);

  readonly activeMembers = computed(
    () => this.members().filter((member) => member.statuses.is_active).length,
  );

  readonly goneMembers = computed(
    () => this.members().filter((member) => !member.statuses.is_active).length,
  );

  readonly transferredMembers = computed(
    () => this.members().filter((member) => member.statuses.is_transferred_out).length,
  );

  setSearchTerm(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  setStatusFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value as StatusFilter);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('All');
  }

  private async _load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.members.set(await this.membersService.list());
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
