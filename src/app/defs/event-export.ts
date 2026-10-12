import { DEvent } from '../services/events.service';
import { EventKindConfig } from './event-kind';

/** Plain-text roster, formatted for pasting into Discord. */
export function rosterText(p_config: EventKindConfig, p_date: string, p_events: DEvent[]): string {
  const lines = [`**${p_config.label} ${p_date}**`];

  for (const w_event of p_events) {
    const regulars = w_event.participants.filter((p) => !p.is_substitute);
    const subs = w_event.participants.filter((p) => p.is_substitute);
    const opponents = [w_event.opponent, w_event.opponent_2].filter(Boolean).join(' & ');

    lines.push('');
    lines.push(
      `__Legion ${w_event.legion} — ${w_event.time}__` +
        (opponents ? ` vs ${opponents}` : '') +
        ` (${regulars.length} + ${subs.length} subs)`,
    );
    regulars.forEach((p, i) => lines.push(`${i + 1}. ${p.member.name}${powerSuffix(p.power)}`));
    if (subs.length) {
      lines.push(`Subs: ${subs.map((p) => p.member.name + powerSuffix(p.power)).join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function rosterCsv(p_date: string, p_events: DEvent[]): string {
  const header = [
    'date',
    'legion',
    'time',
    'game_id',
    'name',
    'role',
    'power',
    'registered_in_game',
    'showed_up',
    'score',
    'remarks',
  ];
  const rows = p_events.flatMap((p_event) =>
    p_event.participants.map((p) => [
      p_date,
      p_event.legion,
      p_event.time,
      p.member.gameId,
      p.member.name,
      p.is_substitute ? 'Sub' : 'Regular',
      p.power,
      p.registered ? 'yes' : 'no',
      p.showed_up == null ? '' : p.showed_up ? 'yes' : 'no',
      p.score,
      p.notes,
    ]),
  );

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadFile(p_name: string, p_content: string, p_type = 'text/csv'): void {
  // BOM so Excel opens UTF-8 names correctly
  const url = URL.createObjectURL(new Blob(['﻿' + p_content], { type: p_type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = p_name;
  link.click();
  URL.revokeObjectURL(url);
}

function powerSuffix(p_power: number | null): string {
  return p_power == null ? '' : ` (${p_power})`;
}

function csvCell(p_value: unknown): string {
  const text = p_value == null ? '' : String(p_value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
