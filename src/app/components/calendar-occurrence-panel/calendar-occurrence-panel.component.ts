import { DecimalPipe } from '@angular/common';
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
import { Router } from '@angular/router';

import {
  colorHex,
  DCalendarResult,
  describeShift,
  DOccurrence,
  matchRecords,
} from '../../defs/calendar';
import { EVENT_KINDS } from '../../defs/event-kind';
import { LocalTimePipe } from '../../defs/local-time';
import { CalendarService } from '../../services/calendar.service';
import { DEvent, eventPlacement } from '../../services/events.service';

type Outcome = DCalendarResult['outcome'];

/**
 * One date of a calendar event: the matching Foundry / CC record, or the result form for
 * events that track results (e.g. SVS).
 */
@Component({
  selector: 'app-calendar-occurrence-panel',
  imports: [DecimalPipe, LocalTimePipe],
  templateUrl: './calendar-occurrence-panel.component.html',
})
export class CalendarOccurrencePanelComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly calendarService = inject(CalendarService);

  readonly occurrence = input.required<DOccurrence>();
  readonly foundries = input<DEvent[]>([]);
  readonly canyonClashes = input<DEvent[]>([]);
  readonly results = input<DCalendarResult[]>([]);
  /** `true` when something was saved and the calendar should reload. */
  readonly closed = output<boolean>();
  /** Open the series editor instead. */
  readonly edit = output<void>();

  readonly colorHex = colorHex;
  readonly placement = eventPlacement;

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly ourScore = signal<number | null>(null);
  readonly opponent = signal('');
  readonly opponentScore = signal<number | null>(null);
  readonly outcome = signal<Outcome>(null);
  readonly notes = signal('');
  /** Picked by hand, so stop guessing it from the scores. */
  private outcomeTouched = false;

  readonly event = computed(() => this.occurrence().event);

  /** Foundry / Canyon Clash settings when this event links to one. */
  readonly linkConfig = computed(() => {
    const kind = this.event().kind;
    return kind === 'foundry' || kind === 'canyon-clash' ? EVENT_KINDS[kind] : null;
  });

  /** The record played at this event's time on this date (and any others that day). */
  readonly link = computed(() => {
    const config = this.linkConfig();
    if (!config) {
      return null;
    }
    const records = config.kind === 'foundry' ? this.foundries() : this.canyonClashes();
    return matchRecords(records, this.occurrence().start, this.event().start_time);
  });

  readonly existingResult = computed(
    () =>
      this.results().find(
        (r) => r.event_id === this.event().id && r.occurrence_date === this.occurrence().start,
      ) ?? null,
  );

  /** Earlier dates of the same event, newest first. */
  readonly history = computed(() =>
    this.results()
      .filter(
        (r) => r.event_id === this.event().id && r.occurrence_date !== this.occurrence().start,
      )
      .sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date))
      .slice(0, 6),
  );

  readonly shiftNote = computed(() =>
    this.occurrence().shiftedFor.length
      ? `Moved ${this.event().shift_minutes} min earlier for ${this.occurrence().shiftedFor.join(' / ')}`
      : null,
  );

  readonly describeShift = describeShift;

  ngOnInit(): void {
    const result = this.existingResult();
    if (result) {
      this.ourScore.set(result.our_score);
      this.opponent.set(result.opponent ?? '');
      this.opponentScore.set(result.opponent_score);
      this.outcome.set(result.outcome);
      this.outcomeTouched = !!result.outcome;
      this.notes.set(result.notes ?? '');
    }
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit(false);
  }

  setScore(p_which: 'ours' | 'theirs', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (p_which === 'ours' ? this.ourScore : this.opponentScore).set(
      value === '' ? null : Number(value),
    );
    // Guess win / loss from the scores until it's picked by hand
    const ours = this.ourScore();
    const theirs = this.opponentScore();
    if (!this.outcomeTouched && ours != null && theirs != null) {
      this.outcome.set(ours > theirs ? 'win' : ours < theirs ? 'loss' : 'draw');
    }
  }

  setOutcome(p_outcome: Outcome): void {
    this.outcomeTouched = true;
    this.outcome.set(this.outcome() === p_outcome ? null : p_outcome);
  }

  async saveResult(): Promise<void> {
    await this.run(() =>
      this.calendarService.saveResult({
        event_id: this.event().id,
        occurrence_date: this.occurrence().start,
        our_score: this.ourScore(),
        opponent: this.opponent().trim() || null,
        opponent_score: this.opponentScore(),
        outcome: this.outcome(),
        notes: this.notes().trim() || null,
      }),
    );
  }

  async clearResult(): Promise<void> {
    if (!confirm(`Clear the result for ${this.occurrence().start}?`)) {
      return;
    }
    await this.run(() =>
      this.calendarService.removeResult(this.event().id, this.occurrence().start),
    );
  }

  /** Foundry / CC day page (registrations, attendance, results). */
  openDay(p_setUp = false): void {
    const config = this.linkConfig()!;
    this.closed.emit(false);
    void this.router.navigate([
      config.path,
      p_setUp ? 'manage-members' : 'manage',
      this.occurrence().start,
    ]);
  }

  private async run(p_action: () => Promise<void>): Promise<void> {
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
