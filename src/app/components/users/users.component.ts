import { Component, computed, inject, signal } from '@angular/core';

import { MembersService } from '../../services/members.service';
import { SupabaseService } from '../../services/supabase.service';
import { DUserProfile, UserProfilesService } from '../../services/user-profiles.service';

type ProfileStatus = 'Pending' | 'Approved' | 'Rejected';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly userProfilesService = inject(UserProfilesService);
  private readonly membersService = inject(MembersService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly currentUser = this.supabaseService.user;

  readonly loading = signal(true);
  readonly busyId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly profiles = signal<DUserProfile[]>([]);
  readonly members = signal<{ id: number; name: string }[]>([]);

  /** member id -> display name of the login it's linked to */
  private readonly linkedBy = computed(
    () =>
      new Map(
        this.profiles()
          .filter((p) => p.member_id != null)
          .map((p) => [p.member_id!, p.display_name || '(no name)']),
      ),
  );

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

  /** True when the linked member is no longer active (so it's not in the dropdown list). */
  linkedToInactive(p_profile: DUserProfile): boolean {
    const id = p_profile.member_id;
    return id != null && !this.members().some((m) => m.id === id);
  }

  /** Who else already has this member, so the dropdown can grey it out. */
  takenBy(p_memberId: number, p_profile: DUserProfile): string | null {
    return p_profile.member_id === p_memberId ? null : (this.linkedBy().get(p_memberId) ?? null);
  }

  async setMember(p_profile: DUserProfile, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const memberId = select.value ? Number(select.value) : null;
    if (memberId === p_profile.member_id) {
      return;
    }
    const ok = await this.updateProfile(p_profile, { member_id: memberId });
    if (!ok) {
      select.value = String(p_profile.member_id ?? ''); // put the dropdown back
    } else if (this.isSelf(p_profile)) {
      await this.supabaseService.getProfile(); // so "My tasks" follows straight away
    }
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

  /** Returns whether the change was saved. */
  private async updateProfile(
    p_profile: DUserProfile,
    p_changes: { is_approved?: boolean; is_admin?: boolean; member_id?: number | null },
  ): Promise<boolean> {
    this.busyId.set(p_profile.id);
    this.error.set(null);
    try {
      const updated = await this.userProfilesService.update(p_profile.id, p_changes);
      this.profiles.update((profiles) => profiles.map((p) => (p.id === updated.id ? updated : p)));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update user.';
      this.error.set(
        message.includes('user_profiles_member_id_key')
          ? 'That member is already linked to another account.'
          : message,
      );
      return false;
    } finally {
      this.busyId.set(null);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const [profiles, members] = await Promise.all([
        this.userProfilesService.list(),
        this.membersService.listActiveNames(),
      ]);
      this.profiles.set(profiles);
      this.members.set(members);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load users.');
    } finally {
      this.loading.set(false);
    }
  }
}
