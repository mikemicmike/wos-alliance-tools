import { Pipe, PipeTransform } from '@angular/core';

/*
 * Everything is stored and shown in UTC (game time). These helpers add the viewer's own
 * local time, worked out by their browser, e.g. "12:00 UTC (08:00)".
 */

/**
 * The browser's local time for a UTC date + time ("HH:MM", "HH:MM:SS" or a label like "12 UTC").
 * Includes the weekday when the local date differs from the UTC date.
 * Returns null when it would add nothing (browser already on UTC) or the input can't be read.
 */
export function localTime(
  p_date: string | null | undefined,
  p_time: string | null | undefined,
): string | null {
  const hhmm = toHhmm(p_time);
  if (!p_date || !hhmm) {
    return null;
  }

  const moment = new Date(`${p_date}T${hhmm}:00Z`);
  if (Number.isNaN(moment.getTime()) || moment.getTimezoneOffset() === 0) {
    return null;
  }

  const time = moment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pad = (p_value: number) => String(p_value).padStart(2, '0');
  const localDate = `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
  return localDate === p_date
    ? time
    : `${moment.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

/** "12:00:00" / "12:00" / "12 UTC" / "02:30 UTC" → "12:00"; anything else → null */
export function toHhmm(p_time: string | null | undefined): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(?:\s*UTC)?$/i.exec(p_time?.trim() ?? '');
  if (!match || Number(match[1]) > 23) {
    return null;
  }
  return `${match[1].padStart(2, '0')}:${match[2] ?? '00'}`;
}

/** \`{{ date | localTime: time }}\` - see {@link localTime}. */
@Pipe({ name: 'localTime' })
export class LocalTimePipe implements PipeTransform {
  transform(p_date: string | null | undefined, p_time: string | null | undefined): string | null {
    return localTime(p_date, p_time);
  }
}
