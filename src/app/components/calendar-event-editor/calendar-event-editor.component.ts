import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';

import {
  addDays,
  CalendarEventKind,
  checkpointDayLabel,
  colorHex,
  daysBetween,
  DCalendarEvent,
  describeRecurrence,
  EVENT_COLORS,
} from '../../defs/calendar';
import { LocalTimePipe } from '../../defs/local-time';
import { CalendarService, DCheckpointInput } from '../../services/calendar.service';
import { DTask } from '../../services/tasks.service';

/** Preset repeats as "<every><unit>", e.g. '2d' = every 2 days, '4w' = every 4 weeks. */
type RepeatMode = 'none' | '1d' | '2d' | '1w' | '2w' | '4w' | 'custom';
const PRESETS: RepeatMode[] = ['1d', '2d', '1w', '2w', '4w'];

interface DCheckpointDraft extends DCheckpointInput {
  /** Stable key for @for, since new checkpoints have no id yet. */
  key: number;
}

/** What the editor was opened for. */
export interface DEditorTarget {
  event: DCalendarEvent | null;
  /** Prefilled date for a new event. */
  date: string;
  /** Start of the clicked occurrence of a repeating event, enables "skip this one". */
  occurrenceStart: string | null;
  repeating: boolean;
}

let nextKey = 1;

@Component({
  selector: 'app-calendar-event-editor',
  imports: [LocalTimePipe],
  templateUrl: './calendar-event-editor.component.html',
  styleUrl: './calendar-event-editor.component.scss',
})
export class CalendarEventEditorComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);

  readonly target = input.required<DEditorTarget>();
  readonly tasks = input<DTask[]>([]);
  /** All calendar events, for the "same day as" rule. */
  readonly events = input<DCalendarEvent[]>([]);
  /** `true` when something was saved/deleted and the calendar should reload. */
  readonly closed = output<boolean>();

  readonly colors = EVENT_COLORS;
  readonly colorHex = colorHex;

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly dirty = signal(false);

  readonly title = signal('');
  readonly notes = signal('');
  readonly color = signal('blue');
  readonly kind = signal<CalendarEventKind>('event');
  readonly trackResults = signal(false);
  /** Most events only need a date (and maybe a time); the end is opt-in. */
  readonly showEnd = signal(false);
  readonly startDate = signal('');
  readonly startTime = signal('');
  readonly endDate = signal('');
  readonly endTime = signal('');
  readonly repeatMode = signal<RepeatMode>('none');
  readonly customEvery = signal(3);
  readonly customUnit = signal<'day' | 'week'>('week');
  readonly repeatUntil = signal('');
  readonly shiftEnabled = signal(false);
  readonly shiftMinutes = signal(30);
  readonly shiftEventIds = signal<number[]>([]);
  readonly checkpoints = signal<DCheckpointDraft[]>([]);

  /** No start time = all day. */
  readonly allDay = computed(() => !this.startTime());

  readonly isNew = computed(() => !this.target().event);
  readonly occurrenceSkipped = computed(() => {
    const { event, occurrenceStart } = this.target();
    return !!event && !!occurrenceStart && event.skips.includes(occurrenceStart);
  });

  readonly repeat = computed<{ every: number | null; unit: 'day' | 'week' }>(() => {
    const mode = this.repeatMode();
    if (mode === 'none') {
      return { every: null, unit: 'week' };
    }
    if (mode === 'custom') {
      return { every: this.customEvery(), unit: this.customUnit() };
    }
    return { every: Number(mode.slice(0, -1)), unit: mode.endsWith('d') ? 'day' : 'week' };
  });

  readonly recurrencePreview = computed(() =>
    this.startDate()
      ? describeRecurrence({
          start_date: this.startDate(),
          repeat_every: this.repeat().every,
          repeat_unit: this.repeat().unit,
          repeat_until: this.repeatUntil() || null,
        })
      : '',
  );

  /** Other events this one can make way for. */
  readonly otherEvents = computed(() =>
    this.events()
      .filter((p_event) => p_event.id !== this.target().event?.id)
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  /** Checkpoint days from a week before the start to the end of the event (at least a full week). */
  readonly dayOptions = computed(() => {
    const start = this.startDate();
    if (!start) {
      return [];
    }
    const span = Math.max(6, daysBetween(start, this.endDate() || start));
    const offsets = Array.from({ length: span + 8 }, (_, i) => i - 7);
    // The real date of the first occurrence makes "Thursday before" vs "after" obvious
    return offsets.map((offset) => ({
      offset,
      label: `${checkpointDayLabel(start, offset)} (${addDays(start, offset)})`,
    }));
  });

  ngOnInit(): void {
    const { event, date } = this.target();
    if (!event) {
      this.startDate.set(date);
      this.endDate.set(date);
      this.repeatMode.set(this.target().repeating ? '1w' : 'none');
      return;
    }

    this.title.set(event.title);
    this.notes.set(event.notes ?? '');
    this.color.set(event.color);
    this.kind.set(event.kind ?? 'event');
    this.trackResults.set(!!event.track_results);
    this.showEnd.set(event.end_date !== event.start_date || !!event.end_time);
    this.startDate.set(event.start_date);
    this.startTime.set(event.start_time?.slice(0, 5) ?? '');
    this.endDate.set(event.end_date);
    this.endTime.set(event.end_time?.slice(0, 5) ?? '');
    const preset = `${event.repeat_every}${event.repeat_unit === 'day' ? 'd' : 'w'}` as RepeatMode;
    if (!event.repeat_every) {
      this.repeatMode.set('none');
    } else if (PRESETS.includes(preset)) {
      this.repeatMode.set(preset);
    } else {
      this.repeatMode.set('custom');
      this.customEvery.set(event.repeat_every);
      this.customUnit.set(event.repeat_unit);
    }
    this.repeatUntil.set(event.repeat_until ?? '');
    this.shiftEnabled.set(!!event.shift_minutes);
    this.shiftMinutes.set(event.shift_minutes ?? 30);
    this.shiftEventIds.set([...event.shift_if_same_day_as]);
    this.checkpoints.set(
      event.checkpoints.map((p_checkpoint) => ({
        key: nextKey++,
        id: p_checkpoint.id,
        day_offset: p_checkpoint.day_offset,
        time: p_checkpoint.time?.slice(0, 5) ?? null,
        title: p_checkpoint.title,
        notes: p_checkpoint.notes,
        task_id: p_checkpoint.task_id,
      })),
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  /** Small helper so the template can update any field and mark the form dirty. */
  set<T>(p_signal: { set(value: T): void }, p_value: T): void {
    p_signal.set(p_value);
    this.dirty.set(true);
  }

  startDateChanged(p_value: string): void {
    if (!p_value) {
      return;
    }
    // Keep the event's length when moving its start
    const span =
      this.startDate() && this.endDate() ? daysBetween(this.startDate(), this.endDate()) : 0;
    this.set(this.startDate, p_value);
    this.endDate.set(this.showEnd() ? addDays(p_value, Math.max(0, span)) : p_value);
  }

  toggleShiftEvent(p_id: number, p_checked: boolean): void {
    this.set(
      this.shiftEventIds,
      p_checked
        ? [...this.shiftEventIds(), p_id]
        : this.shiftEventIds().filter((p_existing) => p_existing !== p_id),
    );
  }

  addEnd(): void {
    this.showEnd.set(true);
    if (!this.endDate()) {
      this.endDate.set(this.startDate());
    }
    this.dirty.set(true);
  }

  removeEnd(): void {
    this.showEnd.set(false);
    this.endDate.set(this.startDate());
    this.endTime.set('');
    this.dirty.set(true);
  }

  addCheckpoint(): void {
    this.checkpoints.update((list) => [
      ...list,
      {
        key: nextKey++,
        id: null,
        day_offset: 0,
        time: null,
        title: '',
        notes: null,
        task_id: null,
      },
    ]);
    this.dirty.set(true);
  }

  updateCheckpoint(p_key: number, p_changes: Partial<DCheckpointDraft>): void {
    this.checkpoints.update((list) =>
      list.map((p_checkpoint) =>
        p_checkpoint.key === p_key ? { ...p_checkpoint, ...p_changes } : p_checkpoint,
      ),
    );
    this.dirty.set(true);
  }

  removeCheckpoint(p_key: number): void {
    this.checkpoints.update((list) => list.filter((p_checkpoint) => p_checkpoint.key !== p_key));
    this.dirty.set(true);
  }

  async save(): Promise<void> {
    const problem = this.validate();
    if (problem) {
      this.error.set(problem);
      return;
    }

    const allDay = this.allDay();
    const shift = this.shiftEnabled() && !allDay;
    await this.run(async () => {
      await this.calendarService.save(
        {
          id: this.target().event?.id ?? null,
          title: this.title().trim(),
          notes: this.notes().trim() || null,
          color: this.color(),
          kind: this.kind(),
          // Foundry / CC results live on their own pages
          track_results: this.kind() === 'event' && this.trackResults(),
          start_date: this.startDate(),
          start_time: allDay ? null : this.startTime(),
          end_date: this.showEnd() ? this.endDate() : this.startDate(),
          end_time: this.showEnd() && !allDay ? this.endTime() || null : null,
          repeat_every: this.repeat().every,
          repeat_unit: this.repeat().unit,
          repeat_until: this.repeat().every ? this.repeatUntil() || null : null,
          shift_minutes: shift ? this.shiftMinutes() : null,
          shift_if_same_day_as: shift ? this.shiftEventIds() : [],
        },
        this.checkpoints().map(({ key, ...p_checkpoint }) => ({
          ...p_checkpoint,
          title: p_checkpoint.title.trim(),
          notes: p_checkpoint.notes?.trim() || null,
          time: p_checkpoint.time || null,
        })),
      );
    });
  }

  async deleteEvent(): Promise<void> {
    const event = this.target().event;
    if (!event) {
      return;
    }
    const what = event.repeat_every ? 'this event and ALL its repeats' : 'this event';
    if (!confirm(`Delete ${what} ("${event.title}")? This cannot be undone.`)) {
      return;
    }
    await this.run(() => this.calendarService.remove(event.id));
  }

  async toggleOccurrence(): Promise<void> {
    const { event, occurrenceStart } = this.target();
    if (!event || !occurrenceStart) {
      return;
    }
    await this.run(() =>
      this.occurrenceSkipped()
        ? this.calendarService.restoreOccurrence(event.id, occurrenceStart)
        : this.calendarService.skipOccurrence(event.id, occurrenceStart),
    );
  }

  cancel(): void {
    if (this.dirty() && !confirm('Discard your changes to this event?')) {
      return;
    }
    this.closed.emit(false);
  }

  private validate(): string | null {
    if (!this.title().trim()) {
      return 'Give the event a title.';
    }
    if (!this.startDate()) {
      return 'Pick a date.';
    }
    if (this.showEnd() && !this.endDate()) {
      return 'Pick an end date, or remove the end.';
    }
    if (this.showEnd() && this.endDate() < this.startDate()) {
      return 'The end date is before the start date.';
    }
    if (
      this.showEnd() &&
      !this.allDay() &&
      this.endDate() === this.startDate() &&
      this.startTime() &&
      this.endTime() &&
      this.endTime() < this.startTime()
    ) {
      return 'The end time is before the start time.';
    }
    const { every, unit } = this.repeat();
    const max = unit === 'day' ? 365 : 52;
    if (every !== null && (!Number.isInteger(every) || every < 1 || every > max)) {
      return `Repeat every 1 to ${max} ${unit}s.`;
    }
    if (every && this.repeatUntil() && this.repeatUntil() < this.startDate()) {
      return '"Repeat until" is before the start date.';
    }
    if (this.shiftEnabled() && !this.allDay()) {
      const minutes = this.shiftMinutes();
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
        return 'Move it 1 to 720 minutes earlier.';
      }
      if (!this.shiftEventIds().length) {
        return 'Pick which events it should make way for, or untick "Start earlier".';
      }
    }
    if (this.checkpoints().some((p_checkpoint) => !p_checkpoint.title.trim())) {
      return 'Every checkpoint needs a description.';
    }
    return null;
  }

  private async run(p_action: () => Promise<unknown>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await p_action();
      this.closed.emit(true);
    } catch (error) {
      console.error(error);
      this.error.set(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      this.saving.set(false);
    }
  }
}
