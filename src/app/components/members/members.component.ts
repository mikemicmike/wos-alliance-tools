import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../../services/members.service';
import { SupabaseService } from '../../services/supabase.service';
import { DecimalPipe } from '@angular/common';

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
  readonly isAdmin = inject(SupabaseService).isAdminUser;

  // Source state
  readonly searchTerm = signal('');
  readonly statusFilter = signal('All');
  error = signal<string | null>(null);
  loading = signal(true);

  selectedSection = signal('ACTIVE');
  readonly members = signal<Awaited<ReturnType<MembersService['list']>>>([]);

  memberClick(memberId: number): void {
    this.router.navigate(['/member/view/', memberId]);
  }

  // Derived state
  readonly filteredMembers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const selectedStatus = this.statusFilter();

    return this.members().filter((member) => {
      const searchableValue = [
        member.gameId,
        member.name,
        member.rank,
        member.statuses.status,
        member.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = query.length === 0 || searchableValue.includes(query);

      const matchesStatus = selectedStatus === 'All' || member.statuses.status === selectedStatus;

      const w_section = this.selectedSection();
      const matchesSection = w_section === 'ALL' || w_section === this.getMemberStatus(member);

      return matchesSearch && matchesStatus && matchesSection;
    });
  });

  /** Built from the data so it always matches the statuses table. */
  readonly statusOptions = computed(() =>
    [...new Set(this.members().map((member) => member.statuses.status))].sort(),
  );

  readonly totalMembers = computed(() => this.members().length);

  readonly activeMembers = computed(
    () => this.members().filter((member) => this.getMemberStatus(member) === 'ACTIVE').length,
  );

  readonly goneMembers = computed(
    () => this.members().filter((member) => this.getMemberStatus(member) === 'GONE').length,
  );

  readonly transferredMembers = computed(
    () => this.members().filter((member) => this.getMemberStatus(member) === 'TRANSFERRED').length,
  );

  setSearchTerm(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  setStatusFilter(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value);
  }

  getMemberStatus(member: ReturnType<MembersComponent['members']>[number]) {
    if (member.statuses.is_active) {
      return 'ACTIVE';
    } else if (member.statuses.is_transferred_out) {
      return 'TRANSFERRED';
    }
    return 'GONE';
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
  }

  async ngOnInit() {
    await this._load();
  }
}
