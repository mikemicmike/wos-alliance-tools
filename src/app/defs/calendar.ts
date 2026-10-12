/*
 * Calendar date maths. Everything is game time (UTC) and dates are 'YYYY-MM-DD' strings,
 * so there are no timezone surprises. Weeks start on Monday.
 */

import { toHhmm } from './local-time';

export type CalendarEventKind = 'event' | 'foundry' | 'canyon-clash';

/** Result of one occurrence of a results-tracking event, e.g. one SVS. */
export interface DCalendarResult {
  event_id: number;
  occurrence_date: string;
  our_score: number | null;
  opponent: string | null;
  opponent_score: number | null;
  outcome: 'win' | 'loss' | 'draw' | null;
  notes: string | null;
}

export interface DCalendarCheckpoint {
  id: number;
  event_id: number;
  /** Days from each occurrence's start date (negative = before the event). */
  day_offset: number;
  time: string | null;
  title: string;
  notes: string | null;
  task_id: number | null;
}

export interface DCalendarEvent {
  id: number;
  title: string;
  notes: string | null;
  color: string;
  start_date: string;
  /** null = all day */
  start_time: string | null;
  end_date: string;
  end_time: string | null;
  /** null = one-off; otherwise every N days/weeks */
  repeat_every: number | null;
  repeat_unit: 'day' | 'week';
  repeat_until: string | null;
  /** Start this many minutes earlier on days that also have one of `shift_if_same_day_as`. */
  shift_minutes: number | null;
  shift_if_same_day_as: number[];
  /** 'foundry' / 'canyon-clash': each date links to that day's Foundry / CC record. */
  kind: CalendarEventKind;
  /** Regular events can record a result per date (e.g. SVS). */
  track_results: boolean;
  checkpoints: DCalendarCheckpoint[];
  /** Occurrence start dates that were skipped. */
  skips: string[];
}

export interface DOccurrence {
  event: DCalendarEvent;
  start: string;
  end: string;
  skipped: boolean;
  /** Effective times for this occurrence, after any same-day shift. */
  startTime: string | null;
  endTime: string | null;
  /** Titles of the events that caused this occurrence to start earlier. */
  shiftedFor: string[];
  /** Titles of other timed events on the same day whose times overlap this one. */
  overlapsWith: string[];
}

type DRecurrence = Pick<
  DCalendarEvent,
  'start_date' | 'repeat_every' | 'repeat_unit' | 'repeat_until'
>;

export interface DCheckpointOccurrence {
  event: DCalendarEvent;
  checkpoint: DCalendarCheckpoint;
  date: string;
  /** Start date of the event occurrence this checkpoint belongs to. */
  occurrenceStart: string;
  skipped: boolean;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Event colours. All dark enough for the white chip text; keys are stored, so never rename one. */
export const EVENT_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'blue', label: 'Blue', hex: '#0d6efd' },
  { key: 'navy', label: 'Navy', hex: '#1f3a93' },
  { key: 'indigo', label: 'Indigo', hex: '#5a32c9' },
  { key: 'purple', label: 'Purple', hex: '#6f42c1' },
  { key: 'pink', label: 'Pink', hex: '#c2255c' },
  { key: 'red', label: 'Red', hex: '#c0392b' },
  { key: 'maroon', label: 'Maroon', hex: '#7b1e34' },
  { key: 'orange', label: 'Orange', hex: '#b35900' },
  { key: 'gold', label: 'Gold', hex: '#946700' },
  { key: 'brown', label: 'Brown', hex: '#7c4a21' },
  { key: 'olive', label: 'Olive', hex: '#5f7012' },
  { key: 'green', label: 'Green', hex: '#198754' },
  { key: 'teal', label: 'Teal', hex: '#0c7c80' },
  { key: 'gray', label: 'Gray', hex: '#6c757d' },
  { key: 'black', label: 'Black', hex: '#212529' },
];

export function colorHex(p_color: string): string {
  return EVENT_COLORS.find((c) => c.key === p_color)?.hex ?? EVENT_COLORS[0].hex;
}

const DAY_MS = 86_400_000;

function toTime(p_date: string): number {
  return Date.parse(p_date + 'T00:00:00Z');
}

export function addDays(p_date: string, p_days: number): string {
  return new Date(toTime(p_date) + p_days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `p_from` to `p_to` (negative when `p_to` is earlier). */
export function daysBetween(p_from: string, p_to: string): number {
  return Math.round((toTime(p_to) - toTime(p_from)) / DAY_MS);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(p_date: string): number {
  return (new Date(toTime(p_date)).getUTCDay() + 6) % 7;
}

export function startOfWeek(p_date: string): string {
  return addDays(p_date, -weekdayIndex(p_date));
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days an occurrence lasts beyond its start day (0 for a single-day event). */
export function eventSpan(p_event: Pick<DCalendarEvent, 'start_date' | 'end_date'>): number {
  return Math.max(0, daysBetween(p_event.start_date, p_event.end_date));
}

/** Days between occurrences, or null for a one-off. */
export function repeatPeriodDays(p_event: DRecurrence): number | null {
  if (!p_event.repeat_every) {
    return null;
  }
  return p_event.repeat_every * (p_event.repeat_unit === 'day' ? 1 : 7);
}

/**
 * Start dates of the event's occurrences that fall within [from, to] (inclusive),
 * respecting the repeat interval and `repeat_until`. Skipped ones are included.
 */
export function occurrenceStarts(p_event: DRecurrence, p_from: string, p_to: string): string[] {
  const last = p_event.repeat_until && p_event.repeat_until < p_to ? p_event.repeat_until : p_to;
  const period = repeatPeriodDays(p_event);

  if (!period) {
    return p_event.start_date >= p_from && p_event.start_date <= last ? [p_event.start_date] : [];
  }

  const firstIndex = Math.max(0, Math.ceil(daysBetween(p_event.start_date, p_from) / period));
  const starts: string[] = [];
  for (let index = firstIndex; ; index++) {
    const start = addDays(p_event.start_date, index * period);
    if (start > last) {
      break;
    }
    starts.push(start);
  }
  return starts;
}

/**
 * Finds the Foundry / CC record(s) for a calendar occurrence: same date, and the same time when
 * the record's time (e.g. "14 UTC") matches the event's start time. `others` are the rest of that
 * day's records, shown when there's no exact time match.
 */
export function matchRecords<T extends { date: string; time: string }>(
  p_records: T[],
  p_date: string,
  p_startTime: string | null,
): { match: T | null; others: T[] } {
  const sameDay = p_records.filter((r) => r.date === p_date);
  const wanted = toHhmm(p_startTime);
  const match = (wanted && sameDay.find((r) => toHhmm(r.time) === wanted)) || null;
  return { match, others: sameDay.filter((r) => r !== match) };
}

/** Checkpoints shown as one chip: same day, same time and the same task. */
export interface DCheckpointGroup {
  key: string;
  date: string;
  time: string | null;
  title: string;
  /** Every event occurrence this checkpoint belongs to (usually just one). */
  points: DCheckpointOccurrence[];
  /** All of them are on skipped occurrences. */
  skipped: boolean;
}

/**
 * Merges checkpoints that are really the same job - e.g. "Signup message" at 00:00 on both the
 * Foundry 14 and Foundry 19 events - into one group. "Same job" = same day and time, and the same
 * linked task (or, when there's no task, the same title).
 */
export function groupCheckpoints(p_points: DCheckpointOccurrence[]): DCheckpointGroup[] {
  const groups = new Map<string, DCheckpointGroup>();
  for (const point of p_points) {
    const { checkpoint } = point;
    const job =
      checkpoint.task_id != null
        ? `task:${checkpoint.task_id}`
        : `title:${checkpoint.title.trim().toLowerCase()}`;
    const key = `${point.date}|${checkpoint.time ?? ''}|${job}`;
    const group = groups.get(key);
    if (group) {
      group.points.push(point);
      group.skipped = group.skipped && point.skipped;
    } else {
      groups.set(key, {
        key,
        date: point.date,
        time: checkpoint.time,
        title: checkpoint.title,
        points: [point],
        skipped: point.skipped,
      });
    }
  }
  return [...groups.values()];
}

/** A multi-day occurrence drawn as one bar across a week row. */
export interface DWeekBar {
  occurrence: DOccurrence;
  /** 1-based grid columns (Mon = 1); \`colEnd\` is exclusive, like CSS grid lines. */
  colStart: number;
  colEnd: number;
  /** 0-based line the bar sits on, so overlapping bars stack instead of colliding. */
  lane: number;
  /** The bar carries on from the previous week / into the next one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Lays out the multi-day occurrences touching the week that starts on \`p_weekStart\` (a Monday):
 * each becomes one bar, clipped to the week, placed on the first free lane.
 * Longer bars are placed first so they stay on the upper lanes.
 */
export function layoutWeekBars(p_occurrences: DOccurrence[], p_weekStart: string): DWeekBar[] {
  const weekEnd = addDays(p_weekStart, 6);
  const bars = p_occurrences
    .filter((o) => o.start !== o.end && o.start <= weekEnd && o.end >= p_weekStart)
    .map((occurrence) => {
      const start = occurrence.start < p_weekStart ? p_weekStart : occurrence.start;
      const end = occurrence.end > weekEnd ? weekEnd : occurrence.end;
      return {
        occurrence,
        colStart: daysBetween(p_weekStart, start) + 1,
        colEnd: daysBetween(p_weekStart, end) + 2,
        lane: 0,
        continuesBefore: occurrence.start < p_weekStart,
        continuesAfter: occurrence.end > weekEnd,
      };
    })
    .sort(
      (a, b) =>
        a.colStart - b.colStart ||
        b.colEnd - b.colStart - (a.colEnd - a.colStart) ||
        a.occurrence.event.title.localeCompare(b.occurrence.event.title),
    );

  // Each lane remembers the column where it becomes free again
  const laneFreeFrom: number[] = [];
  for (const bar of bars) {
    let lane = laneFreeFrom.findIndex((p_freeFrom) => p_freeFrom <= bar.colStart);
    if (lane === -1) {
      lane = laneFreeFrom.length;
    }
    laneFreeFrom[lane] = bar.colEnd;
    bar.lane = lane;
  }
  return bars;
}

/** Whether the event has a (non-skipped) occurrence running on the given day. */
export function isOnDay(p_event: DCalendarEvent, p_date: string): boolean {
  return occurrenceStarts(p_event, addDays(p_date, -eventSpan(p_event)), p_date).some(
    (p_start) => !p_event.skips.includes(p_start),
  );
}

/**
 * Occurrences overlapping [from, to], including ones that started earlier and are still running.
 * `p_allEvents` (defaults to `p_events`) is what same-day shift rules are checked against.
 */
export function occurrencesInRange(
  p_events: DCalendarEvent[],
  p_from: string,
  p_to: string,
  p_allEvents: DCalendarEvent[] = p_events,
): DOccurrence[] {
  const occurrences = p_events
    .flatMap((p_event) => {
      const span = eventSpan(p_event);
      return occurrenceStarts(p_event, addDays(p_from, -span), p_to).map((start) =>
        buildOccurrence(p_event, start, p_allEvents),
      );
    })
    .sort((a, b) => a.start.localeCompare(b.start) || compareTimes(a.startTime, b.startTime));
  markOverlaps(occurrences);
  return occurrences;
}

function buildOccurrence(
  p_event: DCalendarEvent,
  p_start: string,
  p_allEvents: DCalendarEvent[],
): DOccurrence {
  // Same-day rule, e.g. Bear moves 30 minutes earlier on Foundry / Canyon Clash days
  const shiftedFor =
    p_event.shift_minutes && p_event.start_time
      ? p_allEvents
          .filter((p_other) => p_other.id !== p_event.id)
          .filter((p_other) => p_event.shift_if_same_day_as.includes(p_other.id))
          .filter((p_other) => isOnDay(p_other, p_start))
          .map((p_other) => p_other.title)
      : [];
  const shift = shiftedFor.length ? p_event.shift_minutes! : 0;
  const move = (p_time: string | null) =>
    p_time ? fromMinutes(Math.max(0, toMinutes(p_time) - shift)) : null;

  return {
    event: p_event,
    start: p_start,
    end: addDays(p_start, eventSpan(p_event)),
    skipped: p_event.skips.includes(p_start),
    startTime: move(p_event.start_time),
    endTime: move(p_event.end_time),
    shiftedFor,
    overlapsWith: [],
  };
}

/**
 * Flags timed, single-day occurrences on the same day whose times overlap.
 * An event without an end time counts as lasting an hour.
 */
export function markOverlaps(p_occurrences: DOccurrence[]): void {
  const timed = p_occurrences.filter((o) => !o.skipped && o.startTime && o.start === o.end);
  const range = (o: DOccurrence) => {
    const start = toMinutes(o.startTime!);
    const end = o.endTime && toMinutes(o.endTime) > start ? toMinutes(o.endTime) : start + 60;
    return [start, end];
  };
  for (const a of timed) {
    const [aStart, aEnd] = range(a);
    a.overlapsWith = timed
      .filter((b) => b !== a && b.start === a.start)
      .filter((b) => {
        const [bStart, bEnd] = range(b);
        return aStart < bEnd && bStart < aEnd;
      })
      .map((b) => b.event.title);
  }
}

/** Checkpoints whose date falls within [from, to], even when their occurrence starts outside it. */
export function checkpointsInRange(
  p_events: DCalendarEvent[],
  p_from: string,
  p_to: string,
): DCheckpointOccurrence[] {
  return p_events
    .flatMap((p_event) =>
      p_event.checkpoints.flatMap((p_checkpoint) =>
        occurrenceStarts(
          p_event,
          addDays(p_from, -p_checkpoint.day_offset),
          addDays(p_to, -p_checkpoint.day_offset),
        ).map((occurrenceStart) => ({
          event: p_event,
          checkpoint: p_checkpoint,
          date: addDays(occurrenceStart, p_checkpoint.day_offset),
          occurrenceStart,
          skipped: p_event.skips.includes(occurrenceStart),
        })),
      ),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || compareTimes(a.checkpoint.time, b.checkpoint.time),
    );
}

/** Start date of the occurrence that's running today or the next one coming up (skips ignored). */
export function nextOccurrenceStart(p_event: DCalendarEvent, p_today: string): string | null {
  const from = addDays(p_today, -eventSpan(p_event));
  const period = repeatPeriodDays(p_event);

  if (!period) {
    return p_event.start_date >= from && !p_event.skips.includes(p_event.start_date)
      ? p_event.start_date
      : null;
  }

  // From whichever is later - today or the series start - look far enough ahead to get past
  // a run of skipped occurrences
  const base = p_event.start_date > from ? p_event.start_date : from;
  const horizon = addDays(base, period * (p_event.skips.length + 1));
  return (
    occurrenceStarts(p_event, from, horizon).find((p_start) => !p_event.skips.includes(p_start)) ??
    null
  );
}

export function describeRecurrence(p_event: DRecurrence): string {
  if (!p_event.repeat_every) {
    return 'One-off';
  }
  const n = p_event.repeat_every;
  const weekday = WEEKDAYS[weekdayIndex(p_event.start_date)];
  const every =
    p_event.repeat_unit === 'day'
      ? n === 1
        ? 'Daily'
        : `Every ${n} days`
      : (n === 1 ? 'Weekly' : `Every ${n} weeks`) + ` on ${weekday}`;
  const until = p_event.repeat_until ? ` until ${p_event.repeat_until}` : '';
  return every + until;
}

/** e.g. "30 min earlier on Foundry / Canyon Clash days", or null when there's no rule. */
export function describeShift(
  p_event: DCalendarEvent,
  p_allEvents: DCalendarEvent[],
): string | null {
  const titles = p_allEvents
    .filter((p_other) => p_event.shift_if_same_day_as.includes(p_other.id))
    .map((p_other) => p_other.title);
  return p_event.shift_minutes && titles.length
    ? `${p_event.shift_minutes} min earlier on ${titles.join(' / ')} days`
    : null;
}

/** e.g. "Mon 12:00 – Wed 14:00", "All day", "Mon – Sun" */
export function describeTimes(
  p_event: Pick<DCalendarEvent, 'start_date' | 'start_time' | 'end_date' | 'end_time'>,
): string {
  const multiDay = p_event.end_date !== p_event.start_date;
  const day = (p_date: string) => (multiDay ? WEEKDAYS[weekdayIndex(p_date)] + ' ' : '');
  const time = (p_time: string | null) => (p_time ? shortTime(p_time) : '');

  if (!p_event.start_time && !p_event.end_time) {
    return multiDay
      ? `${WEEKDAYS[weekdayIndex(p_event.start_date)]} – ${WEEKDAYS[weekdayIndex(p_event.end_date)]}`
      : 'All day';
  }
  const start = (day(p_event.start_date) + time(p_event.start_time)).trim();
  const end = (day(p_event.end_date) + time(p_event.end_time)).trim();
  return end && end !== start ? `${start} – ${end} UTC` : `${start} UTC`;
}

/** "12:00:00" → "12:00" */
export function shortTime(p_time: string): string {
  return p_time.slice(0, 5);
}

/**
 * Label for a checkpoint day relative to the event start, e.g. "Thu · 3 days before",
 * "Sun · event day", "Tue · 2 days after" - always saying before/after so the same weekday
 * on either side of the event can't be mixed up.
 */
export function checkpointDayLabel(p_startDate: string, p_offset: number): string {
  const weekday = WEEKDAYS[weekdayIndex(addDays(p_startDate, p_offset))];
  if (p_offset === 0) {
    return `${weekday} · event day`;
  }
  const days = Math.abs(p_offset);
  return `${weekday} · ${days} day${days === 1 ? '' : 's'} ${p_offset < 0 ? 'before' : 'after'}`;
}

/** "12:30:00" → 750 */
function toMinutes(p_time: string): number {
  const [hours, minutes] = p_time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 690 → "11:30" */
function fromMinutes(p_minutes: number): string {
  const hours = String(Math.floor(p_minutes / 60)).padStart(2, '0');
  return `${hours}:${String(p_minutes % 60).padStart(2, '0')}`;
}

/** All-day (null) sorts first. */
function compareTimes(a: string | null, b: string | null): number {
  return (a ?? '').localeCompare(b ?? '');
}
