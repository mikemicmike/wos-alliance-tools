import { Component, computed, inject, signal } from '@angular/core';

import {
  addDays,
  checkpointDayLabel,
  checkpointsInRange,
  colorHex,
  DCalendarEvent,
  DCheckpointOccurrence,
  describeRecurrence,
  describeTimes,
  DOccurrence,
  describeShift,
  eventSpan,
  nextOccurrenceStart,
  occurrencesInRange,
  shortTime,
  startOfWeek,
  todayUtc,
  WEEKDAYS,
  weekdayIndex,
} from '../../defs/calendar';
import { CalendarService } from '../../services/calendar.service';
import { DTask, TasksService } from '../../services/tasks.service';
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
  occurrences: DOccurrence[];
  checkpoints: DCheckpointOccurrence[];
}

const VIEW_KEY = 'calendar.view';

@Component({
  selector: 'app-calendar',
  imports: [CalendarEventEditorComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly tasksService = inject(TasksService);

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
  /** First day of the month shown. */
  readonly month = signal(this.today.slice(0, 8) + '01');
  readonly showEnded = signal(false);

  readonly events = signal<DCalendarEvent[]>([]);
  readonly tasks = signal<DTask[]>([]);
  readonly editor = signal<DEditorTarget | null>(null);

  readonly tasksById = computed(() => new Map(this.tasks().map((t) => [t.id, t])));

  readonly monthLabel = computed(() =>
    new Date(this.month() + 'T00:00:00Z').toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );

  /** Whole weeks (Mon–Sun) covering the month. */
  readonly weeks = computed<DDayCell[][]>(() => {
    const month = this.month();
    const first = startOfWeek(month);
    const [year, monthNumber] = month.split('-').map(Number);
    // Day 0 of the next month = last day of this one
    const lastOfMonth = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const last = addDays(startOfWeek(lastOfMonth), 6);

    const occurrences = occurrencesInRange(this.events(), first, last);
    const checkpoints = checkpointsInRange(this.events(), first, last);

    const weeks: DDayCell[][] = [];
    for (let date = first; date <= last; date = addDays(date, 7)) {
      weeks.push(
        Array.from({ length: 7 }, (_, i) => {
          const day = addDays(date, i);
          return {
            date: day,
            day: Number(day.slice(8)),
            inMonth: day.slice(0, 7) === month.slice(0, 7),
            isToday: day === this.today,
            rightEdge: weekdayIndex(day) >= 5,
            occurrences: occurrences.filter((o) => o.start <= day && o.end >= day),
            checkpoints: checkpoints.filter((c) => c.date === day),
          };
        }),
      );
    }
    return weeks;
  });

  /** List view: soonest first, ended one-offs/series hidden unless asked for. */
  readonly listRows = computed(() =>
    this.events()
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

  shiftMonth(p_months: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + p_months, 1));
    this.month.set(date.toISOString().slice(0, 10));
  }

  goToToday(): void {
    this.month.set(this.today.slice(0, 8) + '01');
  }

  isStartOrWeekStart(p_occurrence: DOccurrence, p_date: string): boolean {
    return p_occurrence.start === p_date || weekdayIndex(p_date) === 0;
  }

  chipTitle(p_occurrence: DOccurrence): string {
    const event = p_occurrence.event;
    const time = p_occurrence.startTime
      ? `${p_occurrence.startTime}${p_occurrence.endTime ? '–' + p_occurrence.endTime : ''} UTC`
      : describeTimes(event);
    return [
      `${event.title} · ${time}${p_occurrence.skipped ? ' (skipped)' : ''}`,
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
      const [events, tasks] = await Promise.all([
        this.calendarService.list(),
        this.tasksService.list(),
      ]);
      this.events.set(events);
      this.tasks.set(tasks);
    } catch (error) {
      console.error(error);
      this.error.set(error instanceof Error ? error.message : 'Unable to load the calendar.');
    } finally {
      this.loading.set(false);
    }
  }

  private storedView(): 'calendar' | 'list' {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'calendar';
    } catch {
      return 'calendar';
    }
  }
}
