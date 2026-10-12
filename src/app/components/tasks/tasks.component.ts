import { Component, computed, inject, signal } from '@angular/core';

import { MembersService } from '../../services/members.service';
import { SupabaseService } from '../../services/supabase.service';
import { DTask, DTaskAssignment, TaskRole, TasksService } from '../../services/tasks.service';

interface DAssignmentDraft {
  memberId: number | null;
  role: TaskRole;
  notes: string;
}

const EMPTY_DRAFT: DAssignmentDraft = { memberId: null, role: 'owner', notes: '' };

/** 'all', 'me' (the member linked to this login) or a member id. */
type PersonFilter = 'all' | 'me' | number;

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent {
  private readonly tasksService = inject(TasksService);
  private readonly membersService = inject(MembersService);
  private readonly supabaseService = inject(SupabaseService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly tasks = signal<DTask[]>([]);
  readonly members = signal<{ id: number; name: string; gameId: number | null }[]>([]);
  readonly search = signal('');
  readonly personFilter = signal<PersonFilter>('all');
  /** Showing the "which member are you?" picker. */
  readonly linking = signal(false);

  readonly linkedMemberId = this.supabaseService.linkedMemberId;
  readonly linkedMemberName = computed(() => this.memberName(this.linkedMemberId()));

  /** The member whose tasks are shown, or null for everyone. */
  readonly filterMemberId = computed(() => {
    const filter = this.personFilter();
    return filter === 'all' ? null : filter === 'me' ? this.linkedMemberId() : filter;
  });

  readonly newTitle = signal('');
  readonly newNotes = signal('');

  /** "Add person" form state per task. */
  readonly drafts = signal<Record<number, DAssignmentDraft>>({});

  readonly filteredTasks = computed(() => {
    const query = this.search().trim().toLowerCase();
    const memberId = this.filterMemberId();
    return this.tasks().filter(
      (p_task) =>
        (memberId === null || p_task.assignments.some((a) => a.member_id === memberId)) &&
        (!query ||
          [p_task.title, p_task.notes, ...p_task.assignments.map((a) => a.member.name)]
            .join(' ')
            .toLowerCase()
            .includes(query)),
    );
  });

  private readonly activeMemberIds = computed(() => new Set(this.members().map((m) => m.id)));

  async ngOnInit(): Promise<void> {
    try {
      const [members] = await Promise.all([this.membersService.listActiveNames(), this.refresh()]);
      this.members.set(members);
    } catch (error) {
      this.showError(error);
    } finally {
      this.loading.set(false);
    }
  }

  showAll(): void {
    this.personFilter.set('all');
    this.linking.set(false);
  }

  showMine(): void {
    this.personFilter.set('me');
    // Not linked yet: ask which member they are
    this.linking.set(this.linkedMemberId() === null);
  }

  showPerson(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.personFilter.set(value ? Number(value) : 'all');
    this.linking.set(false);
  }

  async linkMe(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) {
      return;
    }
    await this.run(async () => {
      await this.supabaseService.linkMyMember(Number(value));
      this.linking.set(false);
      this.personFilter.set('me');
    });
  }

  async unlinkMe(): Promise<void> {
    if (!confirm(`Unlink your login from ${this.linkedMemberName()}?`)) {
      return;
    }
    await this.run(async () => {
      await this.supabaseService.linkMyMember(null);
      this.personFilter.set('all');
    });
  }

  memberName(p_memberId: number | null): string {
    if (p_memberId === null) {
      return '';
    }
    return (
      this.members().find((m) => m.id === p_memberId)?.name ??
      this.tasks()
        .flatMap((t) => t.assignments)
        .find((a) => a.member_id === p_memberId)?.member.name ??
      `#${p_memberId}`
    );
  }

  owners(p_task: DTask): DTaskAssignment[] {
    return this.sortedAssignments(p_task, 'owner');
  }

  backups(p_task: DTask): DTaskAssignment[] {
    return this.sortedAssignments(p_task, 'backup');
  }

  isInactive(p_assignment: DTaskAssignment): boolean {
    return !this.activeMemberIds().has(p_assignment.member_id);
  }

  /** Active members not already on this task. */
  availableMembers(p_task: DTask) {
    const assigned = new Set(p_task.assignments.map((a) => a.member_id));
    return this.members().filter((p_member) => !assigned.has(p_member.id));
  }

  draft(p_taskId: number): DAssignmentDraft {
    return this.drafts()[p_taskId] ?? EMPTY_DRAFT;
  }

  setDraft(p_taskId: number, p_changes: Partial<DAssignmentDraft>): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [p_taskId]: { ...this.draft(p_taskId), ...p_changes },
    }));
  }

  async addTask(): Promise<void> {
    const title = this.newTitle().trim();
    if (!title) {
      return;
    }
    await this.run(async () => {
      await this.tasksService.createTask(title, this.newNotes().trim() || null);
      this.newTitle.set('');
      this.newNotes.set('');
    });
  }

  async renameTask(p_task: DTask, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const title = input.value.trim();
    if (!title) {
      input.value = p_task.title; // a task needs a title
      return;
    }
    if (title !== p_task.title) {
      await this.run(() => this.tasksService.updateTask(p_task.id, { title }));
    }
  }

  async setTaskNotes(p_task: DTask, event: Event): Promise<void> {
    const notes = (event.target as HTMLTextAreaElement).value.trim() || null;
    if (notes !== p_task.notes) {
      await this.run(() => this.tasksService.updateTask(p_task.id, { notes }));
    }
  }

  async deleteTask(p_task: DTask): Promise<void> {
    if (
      !confirm(
        `Delete the task "${p_task.title}" and its ${p_task.assignments.length} assignments?`,
      )
    ) {
      return;
    }
    await this.run(() => this.tasksService.removeTask(p_task.id));
  }

  async addAssignment(p_task: DTask): Promise<void> {
    const draft = this.draft(p_task.id);
    if (draft.memberId == null) {
      return;
    }
    await this.run(async () => {
      await this.tasksService.addAssignment({
        task_id: p_task.id,
        member_id: draft.memberId!,
        role: draft.role,
        notes: draft.notes.trim() || null,
      });
      // Keep the chosen role so several backups can be added in a row
      this.setDraft(p_task.id, { memberId: null, notes: '' });
    });
  }

  async setRole(p_assignment: DTaskAssignment, event: Event): Promise<void> {
    const role = (event.target as HTMLSelectElement).value as TaskRole;
    await this.run(() => this.tasksService.updateAssignment(p_assignment.id, { role }));
  }

  async setAssignmentNotes(p_assignment: DTaskAssignment, event: Event): Promise<void> {
    const notes = (event.target as HTMLInputElement).value.trim() || null;
    if (notes !== p_assignment.notes) {
      await this.run(() => this.tasksService.updateAssignment(p_assignment.id, { notes }));
    }
  }

  async removeAssignment(p_assignment: DTaskAssignment): Promise<void> {
    await this.run(() => this.tasksService.removeAssignment(p_assignment.id));
  }

  private sortedAssignments(p_task: DTask, p_role: TaskRole): DTaskAssignment[] {
    return p_task.assignments
      .filter((a) => a.role === p_role)
      .sort((a, b) => a.member.name.localeCompare(b.member.name));
  }

  /** Every change saves straight away, then reloads so the page shows what's stored. */
  private async run(p_action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await p_action();
      await this.refresh();
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async refresh(): Promise<void> {
    this.tasks.set(await this.tasksService.list());
  }

  private showError(error: unknown): void {
    console.error(error);
    this.error.set(error instanceof Error ? error.message : 'Something went wrong.');
  }
}
