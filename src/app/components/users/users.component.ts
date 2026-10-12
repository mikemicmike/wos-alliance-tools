import { Component, computed, inject, signal } from '@angular/core';

import { SupabaseService } from '../../services/supabase.service';
import { DUserProfile, UserProfilesService } from '../../services/user-profiles.service';

type ProfileStatus = 'Pending' | 'Approved' | 'Rejected';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly userProfilesService = inject(UserProfilesService);
  private readonly currentUser = inject(SupabaseService).user;

  readonly loading = signal(true);
  readonly busyId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly profiles = signal<DUserProfile[]>([]);

  /** Pending sign-ups first, then by name. */
  readonly sortedProfiles = computed(() => {
    const order: Record<ProfileStatus, number> = { Pending: 0, Approved: 1, Rejected: 2 };
    return [...this.profiles()].sort(
      (a, b) =>
        order[this.status(a)] - order[this.status(b)] ||
        (a.display_name ?? '').localeCompare(b.display_name ?? ''),
    );
  });

  readonly pendingCount = computed(
    () => this.profiles().filter((p) => this.status(p) === 'Pending').length,
  );

  status(p_profile: DUserProfile): ProfileStatus {
    return p_profile.is_approved === true
      ? 'Approved'
      : p_profile.is_approved === false
        ? 'Rejected'
        : 'Pending';
  }

  isSelf(p_profile: DUserProfile): boolean {
    return p_profile.id === this.currentUser()?.id;
  }

  async setApproved(p_profile: DUserProfile, p_approved: boolean): Promise<void> {
    // Revoking access also takes away admin
    await this.updateProfile(
      p_profile,
      p_approved ? { is_approved: true } : { is_approved: false, is_admin: false },
    );
  }

  async setAdmin(p_profile: DUserProfile, p_admin: boolean): Promise<void> {
    if (
      p_admin &&
      !confirm(
        `Make ${p_profile.display_name || 'this user'} an admin? They'll be able to delete records, ` +
          'bulk edit members, manage tasks and manage other users.',
      )
    ) {
      return;
    }
    await this.updateProfile(p_profile, { is_admin: p_admin });
  }

  private async updateProfile(
    p_profile: DUserProfile,
    p_changes: { is_approved?: boolean; is_admin?: boolean },
  ): Promise<void> {
    this.busyId.set(p_profile.id);
    this.error.set(null);
    try {
      const updated = await this.userProfilesService.update(p_profile.id, p_changes);
      this.profiles.update((profiles) => profiles.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      this.busyId.set(null);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      this.profiles.set(await this.userProfilesService.list());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load users.');
    } finally {
      this.loading.set(false);
    }
  }
}
