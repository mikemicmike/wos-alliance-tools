import { localTime } from './local-time';

// Specs run in Node, where changing TZ at runtime changes the "browser" time zone
declare const process: { env: Record<string, string | undefined> };

/** Runs the assertions with the "browser" set to a given timezone. */
function inTimezone(p_zone: string, p_test: () => void): void {
  const previous = process.env['TZ'];
  process.env['TZ'] = p_zone;
  try {
    p_test();
  } finally {
    process.env['TZ'] = previous;
  }
}

// Formatting follows the runtime's locale (12h vs 24h), so compare digits only
const digits = (p_value: string | null) => p_value?.replace(/[^\d:]/g, '') ?? null;

describe('localTime', () => {
  it('adds nothing when the browser is on UTC', () => {
    inTimezone('UTC', () => {
      expect(localTime('2026-10-12', '12:00')).toBeNull();
    });
  });

  it('converts to the browser time zone, including daylight saving', () => {
    inTimezone('America/Toronto', () => {
      // EDT (UTC-4) in October, EST (UTC-5) in December
      expect(digits(localTime('2026-10-12', '12:00:00'))).toMatch(/^0?8:00$/);
      expect(digits(localTime('2026-12-14', '12:00'))).toMatch(/^0?7:00$/);
    });
  });

  it('reads Foundry-style labels like "12 UTC"', () => {
    inTimezone('America/Toronto', () => {
      expect(digits(localTime('2026-10-12', '12 UTC'))).toMatch(/^0?8:00$/);
      expect(digits(localTime('2026-10-12', '02:30 UTC'))).toMatch(/^10:30$/);
    });
  });

  it('names the day when the local date is different', () => {
    // Weekday names as this runtime's locale writes them
    const weekday = (p_iso: string) =>
      new Date(p_iso).toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' });
    const monday = weekday('2026-10-12T12:00:00Z');
    const tuesday = weekday('2026-10-13T12:00:00Z');
    const sunday = weekday('2026-10-11T12:00:00Z');

    inTimezone('Asia/Tokyo', () => {
      // Mon 19:00 UTC = Tue 04:00 in Tokyo
      const nextDay = localTime('2026-10-12', '19:00')!;
      expect(nextDay.startsWith(tuesday + ' ')).toBe(true);
      expect(digits(nextDay)).toMatch(/0?4:00$/);
      // Mon 01:00 UTC = Mon 10:00 in Tokyo: same day, so no weekday
      const sameDay = localTime('2026-10-12', '01:00')!;
      expect([monday, tuesday, sunday].some((d) => sameDay.startsWith(d + ' '))).toBe(false);
    });
    inTimezone('America/Toronto', () => {
      // Mon 02:00 UTC = Sun 22:00 in Toronto
      const previousDay = localTime('2026-10-12', '02:00')!;
      expect(previousDay.startsWith(sunday + ' ')).toBe(true);
    });
  });

  it('ignores missing or unreadable times', () => {
    inTimezone('America/Toronto', () => {
      expect(localTime('2026-10-12', null)).toBeNull();
      expect(localTime(null, '12:00')).toBeNull();
      expect(localTime('2026-10-12', 'whenever')).toBeNull();
      expect(localTime('2026-10-12', '25:00')).toBeNull();
    });
  });
});
