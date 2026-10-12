import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  addDays,
  checkpointDayLabel,
  checkpointsInRange,
  colorHex,
  DCalendarEvent,
  DCalendarResult,
  DCheckpointGroup,
  DCheckpointOccurrence,
  describeRecurrence,
  describeTimes,
  DOccurrence,
  DWeekBar,
  EVENT_COLORS,
  layoutWeekBars,
  matchRecords,
  describeShift,
  groupCheckpoints,
  eventSpan,
  nextOccurrenceStart,
  occurrencesInRange,
  shortTime,
  startOfWeek,
  todayUtc,
  WEEKDAYS,
  weekdayIndex,
} from '../../defs/calendar';
import { localTime, LocalTimePipe } from '../../defs/local-time';
import { DEvent, eventPlacement, EventsService } from '../../services/events.service';
import { CalendarOccurrencePanelComponent } from '../calendar-occurrence-panel/calendar-occurrence-panel.component';
import { CalendarService } from '../../services/calendar.service';
import { DTask, TasksService } from '../../services/tasks.service';
import { SupabaseService } from '../../services/supabase.service';
import {
  CalendarEventEditorComponent,
  DEditorTarget,
} from '../calendar-event-editor/calendar-event-editor.component';

interface DDayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** Saturday/Sunday column - hover cards open to the left there. */
  rightEdge: boolean;
  /** Single-day occurrences only; multi-day ones are drawn as week bars. */
  occurrences: DOccurrence[];
  /** Same job at the same time on several events = one group. */
  checkpoints: DCheckpointGroup[];
}

interface DWeek {
  days: DDayCell[];
  /** Multi-day events, each drawn as one continuous bar across the week. */
  bars: DWeekBar[];
  /** Number of bar lines this week needs. */
  lanes: number;
}

const VIEW_KEY = 'calendar.view';
const SCOPE_KEY = 'calendar.scope';
const HIDDEN_COLORS_KEY = 'calendar.hiddenColors';

type Scope = 'all' | 'mine';

@Component({
  selector: 'app-calendar',
  imports: [
    CalendarEventEditorComponent,
    CalendarOccurrencePanelComponent,
    LocalTimePipe,
    RouterLink,
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly tasksService = inject(TasksService);
  private readonly eventsService = inject(EventsService);
  private readonly supabaseService = inject(SupabaseService);

  readonly weekdays = WEEKDAYS;
  readonly colorHex = colorHex;
  readonly describeRecurrence = describeRecurrence;
  readonly describeTimes = describeTimes;
  readonly describeShift = describeShift;
  readonly shortTime = shortTime;
  readonly checkpointDayLabel = checkpointDayLabel;
  readonly today = todayUtc();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly view = signal<'calendar' | 'list'>(this.storedView());
  /** Everything, or only the checkpoints you're in charge of / backup for (and their events). */
  readonly scope = signal<Scope>(this.stored(SCOPE_KEY) === 'mine' ? 'mine' : 'all');
  readonly linkedMemberId = this.supabaseService.linkedMemberId;
  /** Colours switched off in the filter. */
  readonly hiddenColors = signal<ReadonlySet<string>>(this.storedHiddenColors());
  /** First day of the month shown. */
  readonly month = signal(this.today.slice(0, 8) + '01');
  readonly showEnded = signal(false);

  readonly events = signal<DCalendarEvent[]>([]);
  readonly tasks = signal<DTask[]>([]);
  /** Foundry / CC records and per-date results, for linked events and result badges. */
  readonly foundries = signal<DEvent[]>([]);
  readonly canyonClashes = signal<DEvent[]>([]);
  readonly results = signal<DCalendarResult[]>([]);
  /** Date panel for a linked / results-tracking event. */
  readonly panel = signal<DOccurrence | null>(null);
  readonly editor = signal<DEditorTarget | null>(null);
  /** Shared checkpoint that was clicked: pick which of its events to open. */
  readonly chooser = signal<DCheckpointGroup | null>(null);

  readonly tasksById = computed(() => new Map(this.tasks().map((t) => [t.id, t])));

  /** Tasks the linked member owns or backs up; null = no filter. */
  private readonly myTaskIds = computed(() => {
    const memberId = this.linkedMemberId();
    if (this.scope() === 'all' || memberId === null) {
      return null;
    }
    return new Set(
      this.tasks()
        .filter((t) => t.assignments.some((a) => a.member_id === memberId))
        .map((t) => t.id),
    );
  });

  /** Colours in use, in palette order, with the events using each (for the filter). */
  readonly usedColors = computed(() =>
    EVENT_COLORS.map((p_color) => ({
      ...p_color,
      titles: this.events()
        .filter((e) => colorHex(e.color) === p_color.hex)
        .map((e) => e.title),
    })).filter((c) => c.titles.length),
  );

  /** Events shown (colour filter + my tasks), or null when nothing is filtered. */
  private readonly visibleEventIds = computed(() => {
    const mine = this.myTaskIds();
    const hidden = this.hiddenColors();
    if (mine === null && !hidden.size) {
      return null;
    }
    return new Set(
      this.events()
        .filter(
          (e) =>
            !hidden.has(e.color) &&
            (mine === null || e.checkpoints.some((c) => c.task_id !== null && mine.has(c.task_id))),
        )
        .map((e) => e.id),
    );
  });

  isMyCheckpoint(p_taskId: number | null): boolean {
    const mine = this.myTaskIds();
    return mine === null || (p_taskId !== null && mine.has(p_taskId));
  }

  readonly monthLabel = computed(() =>
    new Date(this.month() + 'T00:00:00Z').toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );

  /** Whole weeks (Mon–Sun) covering the month. */
  readonly weeks = computed<DWeek[]>(() => {
    const month = this.month();
    const first = startOfWeek(month);
    const [year, monthNumber] = month.split('-').map(Number);
    // Day 0 of the next month = last day of this one
    const lastOfMonth = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const last = addDays(startOfWeek(lastOfMonth), 6);

    // Worked out on the full calendar (shifts / overlaps depend on other events), then filtered
    const shown = this.visibleEventIds();
    const occurrences = occurrencesInRange(this.events(), first, last).filter(
      (o) => shown === null || shown.has(o.event.id),
    );
    const checkpoints = checkpointsInRange(this.events(), first, last).filter(
      (c) => (shown === null || shown.has(c.event.id)) && this.isMyCheckpoint(c.checkpoint.task_id),
    );

    const weeks: DWeek[] = [];
    for (let date = first; date <= last; date = addDays(date, 7)) {
      const bars = layoutWeekBars(occurrences, date);
      weeks.push({
        bars,
        lanes: bars.reduce((max, b) => Math.max(max, b.lane + 1), 0),
        days: Array.from({ length: 7 }, (_, i) => {
          const day = addDays(date, i);
          return {
            date: day,
            day: Number(day.slice(8)),
            inMonth: day.slice(0, 7) === month.slice(0, 7),
            isToday: day === this.today,
            rightEdge: weekdayIndex(day) >= 5,
            occurrences: occurrences.filter((o) => o.start === day && o.end === day),
            checkpoints: groupCheckpoints(checkpoints.filter((c) => c.date === day)),
          };
        }),
      });
    }
    return weeks;
  });

  /** List view: soonest first, ended one-offs/series hidden unless asked for. */
  readonly listRows = computed(() =>
    this.events()
      .filter((e) => this.visibleEventIds()?.has(e.id) ?? true)
      .map((p_event) => {
        const next = nextOccurrenceStart(p_event, this.today);
        return {
          event: p_event,
          next,
          running: !!next && next <= this.today && addDays(next, eventSpan(p_event)) >= this.today,
          shift: describeShift(p_event, this.events()),
        };
      })
      .filter((p_row) => p_row.next || this.showEnded())
      .sort(
        (a, b) =>
          (a.next ?? '9999').localeCompare(b.next ?? '9999') ||
          a.event.title.localeCompare(b.event.title),
      ),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  setView(p_view: 'calendar' | 'list'): void {
    this.view.set(p_view);
    try {
      localStorage.setItem(VIEW_KEY, p_view);
    } catch {
      // storage unavailable - just don't remember it
    }
  }

  setScope(p_scope: Scope): void {
    this.scope.set(p_scope);
    try {
      localStorage.setItem(SCOPE_KEY, p_scope);
    } catch {
      // storage unavailable - just don't remember it
    }
  }

  toggleColor(p_key: string): void {
    const hidden = new Set(this.hiddenColors());
    if (!hidden.delete(p_key)) {
      hidden.add(p_key);
    }
    this.setHiddenColors(hidden);
  }

  showAllColors(): void {
    this.setHiddenColors(new Set());
  }

  private setHiddenColors(p_hidden: ReadonlySet<string>): void {
    this.hiddenColors.set(p_hidden);
    try {
      localStorage.setItem(HIDDEN_COLORS_KEY, JSON.stringify([...p_hidden]));
    } catch {
      // storage unavailable - just don't remember it
    }
  }

  shiftMonth(p_months: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + p_months, 1));
    this.month.set(date.toISOString().slice(0, 10));
  }

  goToToday(): void {
    this.month.set(this.today.slice(0, 8) + '01');
  }

  chipTitle(p_occurrence: DOccurrence): string {
    const event = p_occurrence.event;
    const time = p_occurrence.startTime
      ? `${p_occurrence.startTime}${p_occurrence.endTime ? '–' + p_occurrence.endTime : ''} UTC`
      : describeTimes(event);
    const localStart = localTime(p_occurrence.start, p_occurrence.startTime);
    const localEnd = localTime(p_occurrence.end, p_occurrence.endTime);
    const local = localStart ? ` (${localStart}${localEnd ? '–' + localEnd : ''} your time)` : '';
    return [
      `${event.title} · ${time}${local}${p_occurrence.skipped ? ' (skipped)' : ''}`,
      p_occurrence.shiftedFor.length
        ? `⇠ Moved ${event.shift_minutes} min earlier for ${p_occurrence.shiftedFor.join(' / ')}`
        : '',
      p_occurrence.overlapsWith.length
        ? `⚠ Overlaps with ${p_occurrence.overlapsWith.join(', ')}`
        : '',
      event.notes ?? '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** "08:00 – 09:00" in the viewer's time for the given occurrence, or null (all day / already UTC). */
  localWhen(p_event: DCalendarEvent, p_start: string | null): string | null {
    const start = p_start ?? p_event.start_date;
    const localStart = localTime(start, p_event.start_time);
    if (!localStart) {
      return null;
    }
    const localEnd = localTime(addDays(start, eventSpan(p_event)), p_event.end_time);
    return localEnd ? `${localStart} – ${localEnd}` : localStart;
  }

  /**
   * Row sizes for a week: dates, one row per bar lane, then the day items.
   * Built by hand because CSS rejects repeat(0, ...) for weeks without bars.
   */
  weekRows(p_week: DWeek): string {
    return ['auto', ...Array(p_week.lanes).fill('auto'), '1fr'].join(' ');
  }

  /** One event: open it. Several: ask which one. */
  openCheckpoint(p_group: DCheckpointGroup, event: Event): void {
    event.stopPropagation(); // don't also trigger "new one-off" on the day cell
    if (p_group.points.length === 1) {
      const [point] = p_group.points;
      this.openEvent(point.event, point.occurrenceStart);
    } else {
      this.chooser.set(p_group);
    }
  }

  @HostListener('document:keydown.escape')
  closeChooser(): void {
    this.chooser.set(null);
  }

  chooseEvent(p_point: DCheckpointOccurrence): void {
    this.chooser.set(null);
    this.openEvent(p_point.event, p_point.occurrenceStart);
  }

  /** The task linked to the group (they share one, or none). */
  groupTask(p_group: DCheckpointGroup): DTask | null {
    for (const point of p_group.points) {
      const task = this.taskFor(point);
      if (task) {
        return task;
      }
    }
    return null;
  }

  /** Distinct event colours for the ◆ marks. */
  groupColors(p_group: DCheckpointGroup): string[] {
    return [...new Set(p_group.points.map((p) => colorHex(p.event.color)))];
  }

  taskFor(p_checkpoint: DCheckpointOccurrence): DTask | null {
    const taskId = p_checkpoint.checkpoint.task_id;
    return taskId == null ? null : (this.tasksById().get(taskId) ?? null);
  }

  owners(p_task: DTask) {
    return p_task.assignments.filter((a) => a.role === 'owner');
  }

  backups(p_task: DTask) {
    return p_task.assignments.filter((a) => a.role === 'backup');
  }

  newEvent(p_date: string, p_repeating: boolean): void {
    this.editor.set({ event: null, date: p_date, occurrenceStart: null, repeating: p_repeating });
  }

  /** Linked Foundry / CC events and results-tracking events open the date panel; others the editor. */
  openOccurrence(p_occurrence: DOccurrence, event: Event): void {
    event.stopPropagation(); // don't also trigger "new one-off" on the day cell
    const ev = p_occurrence.event;
    if (ev.kind !== 'event' || ev.track_results) {
      this.panel.set(p_occurrence);
    } else {
      this.openEvent(ev, p_occurrence.start);
    }
  }

  async panelClosed(p_changed: boolean): Promise<void> {
    this.panel.set(null);
    if (p_changed) {
      await this.load();
    }
  }

  editFromPanel(): void {
    const occurrence = this.panel()!;
    this.panel.set(null);
    this.openEvent(occurrence.event, occurrence.start);
  }

  /** W/L (or 1st-3rd for Canyon Clash) for a date that has a result. */
  resultBadge(p_occurrence: DOccurrence): { text: string; tone: string } | null {
    const ev = p_occurrence.event;
    if (ev.kind === 'event') {
      if (!ev.track_results) {
        return null;
      }
      const result = this.results().find(
        (r) => r.event_id === ev.id && r.occurrence_date === p_occurrence.start,
      );
      const outcome = result?.outcome;
      return outcome
        ? {
            text: outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D',
            tone: outcome === 'win' ? 'success' : outcome === 'loss' ? 'danger' : 'secondary',
          }
        : null;
    }
    const records = ev.kind === 'foundry' ? this.foundries() : this.canyonClashes();
    const { match } = matchRecords(records, p_occurrence.start, ev.start_time);
    const place = match ? eventPlacement(match) : null;
    if (place === null) {
      return null;
    }
    if (ev.kind === 'foundry') {
      return place === 1 ? { text: 'W', tone: 'success' } : { text: 'L', tone: 'danger' };
    }
    return {
      text: ['1st', '2nd', '3rd'][place - 1] ?? place + 'th',
      tone: place === 1 ? 'success' : place === 2 ? 'warning' : 'danger',
    };
  }

  openEvent(p_event: DCalendarEvent, p_occurrenceStart: string | null, event?: Event): void {
    event?.stopPropagation(); // don't also trigger "new one-off" on the day cell
    this.editor.set({
      event: p_event,
      date: p_event.start_date,
      occurrenceStart: p_occurrenceStart,
      repeating: !!p_event.repeat_every,
    });
  }

  async editorClosed(p_changed: boolean): Promise<void> {
    this.editor.set(null);
    if (p_changed) {
      await this.load();
    }
  }

  private async load(): Promise<void> {
    this.error.set(null);
    try {
      const [events, tasks, foundries, canyonClashes, results] = await Promise.all([
        this.calendarService.list(),
        this.tasksService.list(),
        this.eventsService.list('foundry'),
        this.eventsService.list('canyon-clash'),
        this.calendarService.listResults(),
      ]);
      this.events.set(events);
      this.tasks.set(tasks);
      this.foundries.set(foundries);
      this.canyonClashes.set(canyonClashes);
      this.results.set(results);
    } catch (error) {
      console.error(error);
      this.error.set(error instanceof Error ? error.message : 'Unable to load the calendar.');
    } finally {
      this.loading.set(false);
    }
  }

  private storedView(): 'calendar' | 'list' {
    return this.stored(VIEW_KEY) === 'list' ? 'list' : 'calendar';
  }

  private storedHiddenColors(): ReadonlySet<string> {
    try {
      const keys: unknown = JSON.parse(this.stored(HIDDEN_COLORS_KEY) ?? '[]');
      return new Set(Array.isArray(keys) ? keys.filter((k) => typeof k === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private stored(p_key: string): string | null {
    try {
      return localStorage.getItem(p_key);
    } catch {
      return null;
    }
  }
}
