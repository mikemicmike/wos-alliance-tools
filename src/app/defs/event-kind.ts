import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

export type EventKind = 'foundry' | 'canyon-clash';

export interface EventKindConfig {
  kind: EventKind;
  label: string;
  plural: string;
  /** Base route, e.g. `/foundries` */
  path: string;
  times: string[];
  /** Canyon Clash is a three-way fight, so it tracks a second opponent. */
  opponents: 1 | 2;
  /** Per-player scores are only meaningful in Canyon Clash (Foundry scores get inflated by zeroing). */
  playerScores: boolean;
}

export const LEGIONS = [1, 2] as const;

export const EVENT_KINDS: Record<EventKind, EventKindConfig> = {
  foundry: {
    kind: 'foundry',
    label: 'Foundry',
    plural: 'Foundries',
    path: '/foundries',
    times: ['02 UTC', '12 UTC', '14 UTC', '19 UTC'],
    opponents: 1,
    playerScores: false,
  },
  'canyon-clash': {
    kind: 'canyon-clash',
    label: 'Canyon Clash',
    plural: 'Canyon Clashes',
    path: '/canyon-clashes',
    times: ['02 UTC', '12 UTC', '14 UTC', '19 UTC', '21 UTC'],
    opponents: 2,
    playerScores: true,
  },
};

/** Reads the `kind` from the current route's data. */
export function injectEventKind(): EventKindConfig {
  const kind = inject(ActivatedRoute).snapshot.data['kind'] as EventKind;
  return EVENT_KINDS[kind];
}

/** Game dates are UTC. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
