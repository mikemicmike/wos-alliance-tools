import { Component, computed, HostListener, inject, signal } from '@angular/core';

import { MembersService } from '../../services/members.service';
import { SupabaseService } from '../../services/supabase.service';
import {
  DTask,
  DTaskAssignment,
  DTaskCategory,
  TaskRole,
  TasksService,
} from '../../services/tasks.service';

interface DAssignmentDraft {
  memberId: number | null;
  role: TaskRole;
  notes: string;
}

const EMPTY_DRAFT: DAssignmentDraft = { memberId: null, role: 'owner', notes: '' };

/** 'all', 'me' (the member linked to this login) or a member id. */
type PersonFilter = 'all' | 'me' | number;

/** A category (or "Uncategorized" when null) and its tasks in order. */
interface DSection {
  key: string;
  category: DTaskCategory | null;
  /** Every task in the category, in order - used for numbering and reordering. */
  allTasks: DTask[];
  /** The ones matching the current search / person filter. */
  tasks: DTask[];
}

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
  readonly categories = signal<DTaskCategory[]>([]);
  readonly members = signal<DMemberOption[]>([]);

  /** Members grouped by rank, highest first (R4 above R3 ...), for the pickers. */
  readonly membersByRank = computed(() => groupByRank(this.members()));
  readonly search = signal('');
  readonly personFilter = signal<PersonFilter>('all');
  /** Showing the "which member are you?" picker. */
  readonly linking = signal(false);
  /** Task rows opened for editing. */
  readonly expanded = signal(new Set<number>());

  readonly newCategoryName = signal('');
  /** "Add a task" input per section. */
  readonly newTaskTitles = signal<Record<string, string>>({});
  /** "Add person" form state per task. */
  readonly drafts = signal<Record<number, DAssignmentDraft>>({});

  /** "+" popup for adding several people to one role of a task at once. */
  readonly picker = signal<{ task: DTask; role: TaskRole } | null>(null);
  readonly pickerSelected = signal(new Set<number>());
  readonly pickerSearch = signal('');
  readonly pickerNote = signal('');

  /** Members grouped by rank for the popup, filtered by its search box. */
  readonly pickerGroups = computed(() => {
    const query = this.pickerSearch().trim().toLowerCase();
    return groupByRank(
      this.members().filter((m) => !query || m.name.toLowerCase().includes(query)),
    ).filter((g) => g.members.length);
  });

  readonly linkedMemberId = this.supabaseService.linkedMemberId;
  readonly linkedMemberName = computed(() => this.memberName(this.linkedMemberId()));

  /** The member whose tasks are shown, or null for everyone. */
  readonly filterMemberId = computed(() => {
    const filter = this.personFilter();
    return filter === 'all' ? null : filter === 'me' ? this.linkedMemberId() : filter;
  });

  /** Reordering only makes sense on the full, unfiltered list. */
  readonly filtering = computed(() => !!this.search().trim() || this.filterMemberId() !== null);

  readonly sections = computed<DSection[]>(() => {
    const query = this.search().trim().toLowerCase();
    const memberId = this.filterMemberId();
    const categoryIds = new Set(this.categories().map((c) => c.id));
    const matches = (p_task: DTask) =>
      (memberId === null || p_task.assignments.some((a) => a.member_id === memberId)) &&
      (!query ||
        [p_task.title, p_task.notes, ...p_task.assignments.map((a) => a.member.name)]
          .join(' ')
          .toLowerCase()
          .includes(query));
    const ordered = (p_tasks: DTask[]) =>
      [...p_tasks].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

    const sections: DSection[] = [
      ...this.categories().map((p_category) => ({
        key: String(p_category.id),
        category: p_category,
        allTasks: ordered(this.tasks().filter((t) => t.category_id === p_category.id)),
      })),
      {
        key: 'none',
        category: null,
        allTasks: ordered(
          this.tasks().filter((t) => t.category_id === null || !categoryIds.has(t.category_id)),
        ),
      },
    ].map((p_section) => ({ ...p_section, tasks: p_section.allTasks.filter(matches) }));

    // Hide empty sections while filtering, and an empty "Uncategorized" always
    return sections.filter((s) => s.tasks.length || (!this.filtering() && s.category !== null));
  });

  readonly visibleTaskCount = computed(() =>
    this.sections().reduce((sum, s) => sum + s.tasks.length, 0),
  );

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

  // --- Whose tasks -------------------------------------------------------------------------

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

  // --- Categories ----------------------------------------------------------------------------

  async addCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) {
      return;
    }
    const last = Math.max(0, ...this.categories().map((c) => c.sort_order));
    await this.run(async () => {
      await this.tasksService.createCategory(name, last + 1);
      this.newCategoryName.set('');
    });
  }

  async renameCategory(p_category: DTaskCategory, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    if (!name) {
      input.value = p_category.name; // a category needs a name
      return;
    }
    if (name !== p_category.name) {
      await this.run(() => this.tasksService.renameCategory(p_category.id, name));
    }
  }

  async deleteCategory(p_section: DSection): Promise<void> {
    const category = p_section.category!;
    const count = p_section.allTasks.length;
    const message = count
      ? `Delete the category "${category.name}"? Its ${count} task(s) will move to Uncategorized.`
      : `Delete the category "${category.name}"?`;
    if (!confirm(message)) {
      return;
    }
    await this.run(() => this.tasksService.removeCategory(category.id));
  }

  async moveCategory(p_index: number, p_delta: -1 | 1): Promise<void> {
    const ids = this.categories().map((c) => c.id);
    await this.run(() => this.tasksService.reorderCategories(swap(ids, p_index, p_delta)));
  }

  // --- Tasks -----------------------------------------------------------------------------------

  isExpanded(p_task: DTask): boolean {
    return this.expanded().has(p_task.id);
  }

  toggle(p_task: DTask): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(p_task.id) ? next.delete(p_task.id) : next.add(p_task.id);
      return next;
    });
  }

  newTaskTitle(p_section: DSection): string {
    return this.newTaskTitles()[p_section.key] ?? '';
  }

  setNewTaskTitle(p_section: DSection, p_value: string): void {
    this.newTaskTitles.update((titles) => ({ ...titles, [p_section.key]: p_value }));
  }

  async addTask(p_section: DSection): Promise<void> {
    const title = this.newTaskTitle(p_section).trim();
    if (!title) {
      return;
    }
    const last = Math.max(0, ...p_section.allTasks.map((t) => t.sort_order));
    await this.run(async () => {
      await this.tasksService.createTask({
        title,
        notes: null,
        category_id: p_section.category?.id ?? null,
        sort_order: last + 1,
      });
      this.setNewTaskTitle(p_section, '');
    });
  }

  async moveTask(p_section: DSection, p_index: number, p_delta: -1 | 1): Promise<void> {
    const ids = p_section.allTasks.map((t) => t.id);
    await this.run(() => this.tasksService.reorderTasks(swap(ids, p_index, p_delta)));
  }

  /** Moves the task to the end of another category. */
  async setCategory(p_task: DTask, event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    const categoryId = value ? Number(value) : null;
    const target = this.sections().find((s) => (s.category?.id ?? null) === categoryId);
    const last = Math.max(0, ...(target?.allTasks ?? []).map((t) => t.sort_order));
    await this.run(() =>
      this.tasksService.updateTask(p_task.id, { category_id: categoryId, sort_order: last + 1 }),
    );
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

  // --- People on a task ----------------------------------------------------------------------

  owners(p_task: DTask): DTaskAssignment[] {
    return this.sortedAssignments(p_task, 'owner');
  }

  backups(p_task: DTask): DTaskAssignment[] {
    return this.sortedAssignments(p_task, 'backup');
  }

  isInactive(p_assignment: DTaskAssignment): boolean {
    return !this.activeMemberIds().has(p_assignment.member_id);
  }

  /** Active members not already on this task, grouped by rank (R4 first - most tasks go to them). */
  availableMembersByRank(p_task: DTask) {
    const assigned = new Set(p_task.assignments.map((a) => a.member_id));
    return groupByRank(this.members().filter((p_member) => !assigned.has(p_member.id)));
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

  openPicker(p_task: DTask, p_role: TaskRole, event: Event): void {
    event.stopPropagation(); // don't also open/close the row
    this.picker.set({ task: p_task, role: p_role });
    this.pickerSelected.set(new Set());
    this.pickerSearch.set('');
    this.pickerNote.set('');
  }

  @HostListener('document:keydown.escape')
  closePicker(): void {
    this.picker.set(null);
  }

  /** Role this member already has on the picker's task, if any. */
  existingRole(p_memberId: number): TaskRole | null {
    return this.picker()?.task.assignments.find((a) => a.member_id === p_memberId)?.role ?? null;
  }

  togglePicked(p_memberId: number, p_checked: boolean): void {
    this.pickerSelected.update((set) => {
      const next = new Set(set);
      p_checked ? next.add(p_memberId) : next.delete(p_memberId);
      return next;
    });
  }

  async savePicker(): Promise<void> {
    const picker = this.picker();
    if (!picker || !this.pickerSelected().size) {
      return;
    }
    const notes = this.pickerNote().trim() || null;
    await this.run(async () => {
      await this.tasksService.addAssignments(
        [...this.pickerSelected()].map((member_id) => ({
          task_id: picker.task.id,
          member_id,
          role: picker.role,
          notes,
        })),
      );
      this.picker.set(null);
    });
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
    const [tasks, categories] = await Promise.all([
      this.tasksService.list(),
      this.tasksService.listCategories(),
    ]);
    this.tasks.set(tasks);
    this.categories.set(categories);
  }

  private showError(error: unknown): void {
    console.error(error);
    this.error.set(error instanceof Error ? error.message : 'Something went wrong.');
  }
}

interface DMemberOption {
  id: number;
  name: string;
  gameId: number | null;
  rank: string;
}

/** Highest rank first (R5, R4, R3 ...), names alphabetical within a rank. */
function groupByRank(p_members: DMemberOption[]): { rank: string; members: DMemberOption[] }[] {
  const ranks = [...new Set(p_members.map((m) => m.rank || 'No rank'))].sort((a, b) =>
    b.localeCompare(a),
  );
  return ranks.map((rank) => ({
    rank,
    members: p_members
      .filter((m) => (m.rank || 'No rank') === rank)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Copy of `p_ids` with the item at `p_index` moved one step up (-1) or down (1). */
function swap(p_ids: number[], p_index: number, p_delta: -1 | 1): number[] {
  const ids = [...p_ids];
  const other = p_index + p_delta;
  if (other < 0 || other >= ids.length) {
    return ids;
  }
  [ids[p_index], ids[other]] = [ids[other], ids[p_index]];
  return ids;
}
