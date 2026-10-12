import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { tabDownColumn } from '../../defs/grid-keyboard';
import { MemberLogService } from '../../services/member-log.service';
import { DMemberUpdate, MembersService } from '../../services/members.service';

type StatKey =
  | 'power'
  | 'furnace_level'
  | 'infantry_fc_level'
  | 'infantry_tier'
  | 'lancer_fc_level'
  | 'lancer_tier'
  | 'marksman_fc_level'
  | 'marksman_tier';

type DStats = Record<StatKey, number | null>;

interface StatColumn {
  key: StatKey;
  label: string;
  /** Header shown above the column, e.g. "Infantry" over FC / Tier. */
  group: string | null;
  max: number | null;
  integer: boolean;
}

/** Same ranges as the single-member form. */
const STAT_COLUMNS: StatColumn[] = [
  { key: 'power', label: 'Power (Mil)', group: null, max: null, integer: false },
  { key: 'furnace_level', label: 'Furnace', group: null, max: 40, integer: true },
  { key: 'infantry_fc_level', label: 'FC', group: 'Infantry', max: 10, integer: true },
  { key: 'infantry_tier', label: 'Tier', group: 'Infantry', max: 12, integer: true },
  { key: 'lancer_fc_level', label: 'FC', group: 'Lancer', max: 10, integer: true },
  { key: 'lancer_tier', label: 'Tier', group: 'Lancer', max: 12, integer: true },
  { key: 'marksman_fc_level', label: 'FC', group: 'Marksman', max: 10, integer: true },
  { key: 'marksman_tier', label: 'Tier', group: 'Marksman', max: 12, integer: true },
];

interface DRow {
  id: number;
  name: string;
  gameId: number | null;
  rank: string;
  original: DStats;
  values: DStats;
}

@Component({
  selector: 'app-members-bulk-edit',
  templateUrl: './members-bulk-edit.component.html',
  styleUrl: './members-bulk-edit.component.scss',
})
export class MembersBulkEditComponent {
  private readonly router = inject(Router);
  private readonly membersService = inject(MembersService);
  private readonly memberLogService = inject(MemberLogService);

  readonly columns = STAT_COLUMNS;
  readonly groups = ['Infantry', 'Lancer', 'Marksman'];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly progress = signal('');
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly rows = signal<DRow[]>([]);
  readonly search = signal('');

  readonly visibleRows = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.rows().filter(
      (p_row) =>
        !query ||
        p_row.name.toLowerCase().includes(query) ||
        String(p_row.gameId ?? '').includes(query),
    );
  });

  readonly changedRows = computed(() =>
    this.rows().filter((p_row) => STAT_COLUMNS.some((c) => this.isChanged(p_row, c.key))),
  );

  readonly invalidCount = computed(
    () =>
      this.rows().flatMap((p_row) => STAT_COLUMNS.filter((c) => this.isInvalid(p_row, c))).length,
  );

  /** Tab moves down a column (e.g. everyone's power) instead of across the row. */
  protected readonly gridKeydown = tabDownColumn;

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const members = await this.membersService.listActiveStats();
      this.rows.set(
        members
          .map((p_member) => {
            const stats = Object.fromEntries(
              STAT_COLUMNS.map((c) => [c.key, p_member[c.key]]),
            ) as DStats;
            return {
              id: p_member.id,
              name: p_member.name,
              gameId: p_member.gameId,
              rank: p_member.rank,
              original: stats,
              values: { ...stats },
            };
          })
          // Highest saved power first (no power last). Uses the saved value so rows don't
          // jump around while typing; the order refreshes after saving.
          .sort(
            (a, b) =>
              (b.original.power ?? -Infinity) - (a.original.power ?? -Infinity) ||
              a.name.localeCompare(b.name),
          ),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load members.');
    } finally {
      this.loading.set(false);
    }
  }

  isChanged(p_row: DRow, p_key: StatKey): boolean {
    return p_row.values[p_key] !== p_row.original[p_key];
  }

  isInvalid(p_row: DRow, p_column: StatColumn): boolean {
    const value = p_row.values[p_column.key];
    return (
      value != null &&
      (Number.isNaN(value) ||
        value < 0 ||
        (p_column.max != null && value > p_column.max) ||
        (p_column.integer && !Number.isInteger(value)))
    );
  }

  /** On `change` rather than `input`, so half-typed numbers aren't wiped out mid-typing. */
  valueChanged(p_rowId: number, p_key: StatKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value === '' ? (input.validity.badInput ? NaN : null) : Number(input.value);
    this.success.set(null);
    this.rows.update((rows) =>
      rows.map((p_row) =>
        p_row.id === p_rowId ? { ...p_row, values: { ...p_row.values, [p_key]: value } } : p_row,
      ),
    );
  }

  async save(): Promise<void> {
    this.error.set(null);
    this.success.set(null);

    if (this.invalidCount()) {
      this.error.set('Some values are out of range (highlighted in red). Fix them before saving.');
      return;
    }

    const changed = this.changedRows();
    this.saving.set(true);
    let saved = 0;

    try {
      for (const w_row of changed) {
        this.progress.set(`Saving ${saved + 1} of ${changed.length}…`);

        const keys = STAT_COLUMNS.map((c) => c.key).filter((p_key) => this.isChanged(w_row, p_key));
        const changes: DMemberUpdate = Object.fromEntries(
          keys.map((p_key) => [p_key, w_row.values[p_key]]),
        );

        await this.membersService.update(w_row.id, changes);
        // Same history entries the single-member edit writes
        await this.memberLogService.createMany(
          keys.map((p_key) => ({
            member_id: w_row.id,
            type: p_key,
            previous_value_num: w_row.original[p_key],
            new_value_num: w_row.values[p_key],
          })),
        );
        saved++;
      }

      this.success.set(`Updated ${saved} member${saved === 1 ? '' : 's'}.`);
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.error.set(
        `${error instanceof Error ? error.message : 'Unable to save.'} ` +
          `${saved} of ${changed.length} members were saved before the error.`,
      );
    } finally {
      this.saving.set(false);
      this.progress.set('');
    }
  }

  discard(): void {
    if (this.changedRows().length && !confirm('Discard your unsaved changes?')) {
      return;
    }
    this.rows.update((rows) => rows.map((p_row) => ({ ...p_row, values: { ...p_row.original } })));
  }

  back(): void {
    if (this.changedRows().length && !confirm('Discard your unsaved changes?')) {
      return;
    }
    void this.router.navigate(['/members']);
  }
}
