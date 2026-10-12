import {
  addDays,
  checkpointDayLabel,
  checkpointsInRange,
  daysBetween,
  DCalendarEvent,
  describeRecurrence,
  describeTimes,
  groupCheckpoints,
  layoutWeekBars,
  matchRecords,
  describeShift,
  nextOccurrenceStart,
  occurrencesInRange,
  occurrenceStarts,
  startOfWeek,
  weekdayIndex,
} from './calendar';

function event(p_changes: Partial<DCalendarEvent>): DCalendarEvent {
  return {
    id: 1,
    title: 'Test',
    notes: null,
    color: 'blue',
    start_date: '2026-10-12', // a Monday
    start_time: null,
    end_date: '2026-10-12',
    end_time: null,
    repeat_every: null,
    repeat_unit: 'week',
    repeat_until: null,
    shift_minutes: null,
    shift_if_same_day_as: [],
    kind: 'event',
    track_results: false,
    checkpoints: [],
    skips: [],
    ...p_changes,
  };
}

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-12', '2026-10-19')).toBe(7);
    expect(daysBetween('2026-10-19', '2026-10-12')).toBe(-7);
  });

  it('uses Monday as the first weekday', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-18')).toBe(6); // Sunday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
  });
});

describe('occurrenceStarts', () => {
  it('returns a one-off only when it is in range', () => {
    const oneOff = event({});
    expect(occurrenceStarts(oneOff, '2026-10-01', '2026-10-31')).toEqual(['2026-10-12']);
    expect(occurrenceStarts(oneOff, '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('repeats weekly', () => {
    expect(occurrenceStarts(event({ repeat_every: 1 }), '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });

  it('keeps the every-N-weeks rhythm when the range starts mid-series', () => {
    const biweekly = event({ repeat_every: 2 });
    // Series: Oct 12, Oct 26, Nov 9, Nov 23, Dec 7, ...
    expect(occurrenceStarts(biweekly, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-09',
      '2026-11-23',
    ]);
    expect(occurrenceStarts(event({ repeat_every: 4 }), '2026-12-01', '2027-01-31')).toEqual([
      '2026-12-07',
      '2027-01-04',
    ]);
  });

  it('includes an occurrence that starts exactly on the range edges', () => {
    expect(occurrenceStarts(event({ repeat_every: 2 }), '2026-10-26', '2026-11-09')).toEqual([
      '2026-10-26',
      '2026-11-09',
    ]);
  });

  it('never returns occurrences before the series start', () => {
    expect(occurrenceStarts(event({ repeat_every: 1 }), '2026-09-01', '2026-10-13')).toEqual([
      '2026-10-12',
    ]);
  });

  it('stops at repeat_until', () => {
    const limited = event({ repeat_every: 1, repeat_until: '2026-10-26' });
    expect(occurrenceStarts(limited, '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });
});

describe('occurrencesInRange', () => {
  it('includes a multi-day occurrence that started before the range', () => {
    const week = event({ end_date: '2026-10-18', repeat_every: 2 }); // Mon–Sun
    const result = occurrencesInRange([week], '2026-10-15', '2026-10-31');
    expect(result.map((o) => [o.start, o.end])).toEqual([
      ['2026-10-12', '2026-10-18'],
      ['2026-10-26', '2026-11-01'],
    ]);
  });

  it('flags skipped occurrences', () => {
    const weekly = event({ repeat_every: 1, skips: ['2026-10-19'] });
    expect(occurrencesInRange([weekly], '2026-10-12', '2026-10-25').map((o) => o.skipped)).toEqual([
      false,
      true,
    ]);
  });
});

describe('checkpointsInRange', () => {
  const checkpoint = (id: number, day_offset: number) => ({
    id,
    event_id: 1,
    day_offset,
    time: null,
    title: `cp${id}`,
    notes: null,
    task_id: null,
  });

  it('places checkpoints on the right day of each occurrence', () => {
    const weekly = event({ repeat_every: 1, checkpoints: [checkpoint(1, 1), checkpoint(2, 3)] });
    const result = checkpointsInRange([weekly], '2026-10-12', '2026-10-25');
    expect(result.map((c) => `${c.checkpoint.title}@${c.date}`)).toEqual([
      'cp1@2026-10-13',
      'cp2@2026-10-15',
      'cp1@2026-10-20',
      'cp2@2026-10-22',
    ]);
  });

  it('shows a "day before" checkpoint even when its event starts after the range', () => {
    const weekly = event({ repeat_every: 1, checkpoints: [checkpoint(1, -1)] });
    const result = checkpointsInRange([weekly], '2026-10-18', '2026-10-18'); // the Sunday
    expect(result.map((c) => [c.date, c.occurrenceStart])).toEqual([['2026-10-18', '2026-10-19']]);
  });

  it('marks checkpoints of skipped occurrences', () => {
    const weekly = event({
      repeat_every: 1,
      skips: ['2026-10-19'],
      checkpoints: [checkpoint(1, 0)],
    });
    expect(checkpointsInRange([weekly], '2026-10-12', '2026-10-25').map((c) => c.skipped)).toEqual([
      false,
      true,
    ]);
  });
});

describe('nextOccurrence', () => {
  it('returns the running occurrence for a multi-day event', () => {
    const week = event({ end_date: '2026-10-18', repeat_every: 2 });
    expect(nextOccurrenceStart(week, '2026-10-15')).toBe('2026-10-12');
  });

  it('jumps over skipped occurrences', () => {
    const weekly = event({ repeat_every: 1, skips: ['2026-10-19', '2026-10-26'] });
    expect(nextOccurrenceStart(weekly, '2026-10-13')).toBe('2026-11-02');
  });

  it('finds a one-off far in the future', () => {
    expect(
      nextOccurrenceStart(
        event({ start_date: '2027-03-01', end_date: '2027-03-01' }),
        '2026-10-13',
      ),
    ).toBe('2027-03-01');
  });

  it('finds the first occurrence of a series that starts months from now', () => {
    expect(
      nextOccurrenceStart(event({ start_date: '2027-03-01', repeat_every: 4 }), '2026-10-13'),
    ).toBe('2027-03-01');
  });

  it('finds the next occurrence of a long-interval series', () => {
    // every 8 weeks from Oct 12: next after Oct 13 is Dec 7
    expect(nextOccurrenceStart(event({ repeat_every: 8 }), '2026-10-13')).toBe('2026-12-07');
  });

  it('returns null when the series has ended', () => {
    expect(
      nextOccurrenceStart(event({ repeat_every: 1, repeat_until: '2026-10-19' }), '2026-11-01'),
    ).toBeNull();
    expect(nextOccurrenceStart(event({}), '2026-10-13')).toBeNull();
  });
});

describe('descriptions', () => {
  it('describes recurrence', () => {
    expect(describeRecurrence(event({}))).toBe('One-off');
    expect(describeRecurrence(event({ repeat_every: 1 }))).toBe('Weekly on Mon');
    expect(describeRecurrence(event({ repeat_every: 2, repeat_until: '2026-12-31' }))).toBe(
      'Every 2 weeks on Mon until 2026-12-31',
    );
  });

  it('describes times', () => {
    expect(describeTimes(event({}))).toBe('All day');
    expect(describeTimes(event({ end_date: '2026-10-18' }))).toBe('Mon – Sun');
    expect(describeTimes(event({ start_time: '12:00:00', end_time: '14:00:00' }))).toBe(
      '12:00 – 14:00 UTC',
    );
    expect(describeTimes(event({ start_time: '19:00:00' }))).toBe('19:00 UTC');
    expect(
      describeTimes(event({ start_time: '12:00', end_date: '2026-10-14', end_time: '14:00' })),
    ).toBe('Mon 12:00 – Wed 14:00 UTC');
  });

  it('labels checkpoint days relative to the start', () => {
    expect(checkpointDayLabel('2026-10-12', 0)).toBe('Mon · event day');
    expect(checkpointDayLabel('2026-10-12', 1)).toBe('Tue · 1 day after');
    expect(checkpointDayLabel('2026-10-12', 3)).toBe('Thu · 3 days after');
    expect(checkpointDayLabel('2026-10-12', -1)).toBe('Sun · 1 day before');
    expect(checkpointDayLabel('2026-10-12', -4)).toBe('Thu · 4 days before');
  });
});

describe('repeating in days', () => {
  it('repeats every 2 days across a month boundary', () => {
    const bear = event({ start_date: '2026-10-27', repeat_every: 2, repeat_unit: 'day' });
    expect(occurrenceStarts(bear, '2026-10-28', '2026-11-04')).toEqual([
      '2026-10-29',
      '2026-10-31',
      '2026-11-02',
      '2026-11-04',
    ]);
  });

  it('describes day repeats', () => {
    expect(describeRecurrence(event({ repeat_every: 1, repeat_unit: 'day' }))).toBe('Daily');
    expect(describeRecurrence(event({ repeat_every: 2, repeat_unit: 'day' }))).toBe('Every 2 days');
  });

  it('finds the next occurrence of a day repeat', () => {
    const bear = event({ repeat_every: 2, repeat_unit: 'day' }); // Oct 12, 14, 16...
    expect(nextOccurrenceStart(bear, '2026-10-13')).toBe('2026-10-14');
  });
});

describe('same-day shift', () => {
  // Foundry every 2 weeks on Wed Oct 14 (Oct 14, 28); Canyon Clash every 4 weeks from Fri Oct 16
  const foundry = event({
    id: 10,
    title: 'Foundry',
    start_date: '2026-10-14',
    end_date: '2026-10-14',
    start_time: '12:00:00',
    repeat_every: 2,
  });
  const canyon = event({
    id: 11,
    title: 'Canyon Clash',
    start_date: '2026-10-16',
    end_date: '2026-10-16',
    start_time: '14:00:00',
    repeat_every: 4,
  });
  // Bear every 2 days at 12:00-12:30 from Mon Oct 12: Oct 12, 14, 16, 18, ...
  const bear = event({
    id: 12,
    title: 'Bear',
    start_time: '12:00:00',
    end_time: '12:30:00',
    repeat_every: 2,
    repeat_unit: 'day',
    shift_minutes: 30,
    shift_if_same_day_as: [10, 11],
  });

  const bearDays = (p_events: DCalendarEvent[]) =>
    occurrencesInRange(p_events, '2026-10-12', '2026-10-18')
      .filter((o) => o.event.id === 12)
      .map((o) => `${o.start} ${o.startTime}-${o.endTime} ${o.shiftedFor.join('+')}`.trim());

  it('starts earlier only on days with Foundry or Canyon Clash', () => {
    expect(bearDays([foundry, canyon, bear])).toEqual([
      '2026-10-12 12:00-12:30',
      '2026-10-14 11:30-12:00 Foundry',
      '2026-10-16 11:30-12:00 Canyon Clash',
      '2026-10-18 12:00-12:30',
    ]);
  });

  it('does not shift when the other event is skipped that day', () => {
    const skippedFoundry = { ...foundry, skips: ['2026-10-14'] };
    expect(bearDays([skippedFoundry, canyon, bear])[1]).toBe('2026-10-14 12:00-12:30');
  });

  it('never moves before midnight', () => {
    const early = { ...bear, start_time: '00:15:00', end_time: null };
    const result = occurrencesInRange([foundry, early], '2026-10-14', '2026-10-14').find(
      (o) => o.event.id === 12,
    );
    expect(result?.startTime).toBe('00:00');
  });

  it('describes the rule', () => {
    expect(describeShift(bear, [foundry, canyon, bear])).toBe(
      '30 min earlier on Foundry / Canyon Clash days',
    );
    expect(describeShift(foundry, [foundry, canyon, bear])).toBeNull();
  });
});

describe('overlap warnings', () => {
  it('flags timed events whose times overlap on the same day', () => {
    const a = event({ id: 1, title: 'A', start_time: '12:00:00', end_time: '13:00:00' });
    const b = event({ id: 2, title: 'B', start_time: '12:30:00' }); // no end -> counts as an hour
    const c = event({ id: 3, title: 'C', start_time: '13:00:00', end_time: '14:00:00' }); // touches A, no overlap
    const allDay = event({ id: 4, title: 'All day' });
    const result = occurrencesInRange([a, b, c, allDay], '2026-10-12', '2026-10-12');
    expect(Object.fromEntries(result.map((o) => [o.event.title, o.overlapsWith]))).toEqual({
      'All day': [],
      A: ['B'],
      B: ['A', 'C'],
      C: ['B'],
    });
  });

  it('no longer warns once Bear has moved out of the way', () => {
    const foundry = event({
      id: 10,
      title: 'Foundry',
      start_time: '12:00:00',
      end_time: '13:00:00',
    });
    const bear = event({
      id: 12,
      title: 'Bear',
      start_time: '12:00:00',
      end_time: '12:30:00',
      shift_minutes: 30,
      shift_if_same_day_as: [10],
    });
    const result = occurrencesInRange([foundry, bear], '2026-10-12', '2026-10-12');
    expect(result.map((o) => o.overlapsWith)).toEqual([[], []]);
    const unruly = { ...bear, shift_minutes: null };
    expect(
      occurrencesInRange([foundry, unruly], '2026-10-12', '2026-10-12').map((o) => o.overlapsWith),
    ).toEqual([['Bear'], ['Foundry']]);
  });
});

describe('layoutWeekBars', () => {
  const week = '2026-10-12'; // Monday
  const occ = (p_title: string, p_start: string, p_end: string) =>
    occurrencesInRange(
      [event({ title: p_title, start_date: p_start, end_date: p_end })],
      p_start,
      p_end,
    )[0];
  const describeBars = (p_bars: ReturnType<typeof layoutWeekBars>) =>
    p_bars.map(
      (b) =>
        `${b.occurrence.event.title} ${b.colStart}-${b.colEnd} lane${b.lane}` +
        (b.continuesBefore ? ' <' : '') +
        (b.continuesAfter ? ' >' : ''),
    );

  it('draws a multi-day event as one bar, ignoring single-day ones', () => {
    const showdown = occ('Showdown', '2026-10-12', '2026-10-17'); // Mon-Sat
    const bear = occ('Bear', '2026-10-13', '2026-10-13');
    expect(describeBars(layoutWeekBars([showdown, bear], week))).toEqual(['Showdown 1-7 lane0']);
  });

  it('clips bars to the week and flags that they continue', () => {
    const svs = occ('SvS', '2026-10-09', '2026-10-21'); // Fri before -> Wed after
    expect(describeBars(layoutWeekBars([svs], week))).toEqual(['SvS 1-8 lane0 < >']);
    expect(describeBars(layoutWeekBars([svs], '2026-10-19'))).toEqual(['SvS 1-4 lane0 <']);
  });

  it('stacks overlapping bars and reuses a lane once it is free', () => {
    const a = occ('A', '2026-10-12', '2026-10-14'); // Mon-Wed
    const b = occ('B', '2026-10-13', '2026-10-16'); // Tue-Fri, overlaps A
    const c = occ('C', '2026-10-15', '2026-10-18'); // Thu-Sun, A is done by then
    expect(describeBars(layoutWeekBars([c, b, a], week))).toEqual([
      'A 1-4 lane0',
      'B 2-6 lane1',
      'C 4-8 lane0',
    ]);
  });
});

describe('groupCheckpoints', () => {
  const cp = (
    p_id: number,
    p_title: string,
    p_time: string | null,
    p_taskId: number | null,
    p_offset = -5,
  ) => ({
    id: p_id,
    event_id: 0,
    day_offset: p_offset,
    time: p_time,
    title: p_title,
    notes: null,
    task_id: p_taskId,
  });
  // Two Foundry events on the same Sunday, both with a "Signup message" 5 days before
  const foundry14 = event({
    id: 14,
    title: 'Foundry 14',
    start_date: '2026-10-18',
    end_date: '2026-10-18',
    repeat_every: 2,
    checkpoints: [cp(1, 'Signup Message', '00:00:00', null)],
  });
  const foundry19 = event({
    id: 19,
    title: 'Foundry 19',
    start_date: '2026-10-18',
    end_date: '2026-10-18',
    repeat_every: 2,
    checkpoints: [cp(2, 'signup message ', '00:00:00', null)],
  });
  const groupsOn = (p_events: DCalendarEvent[], p_date: string) =>
    groupCheckpoints(checkpointsInRange(p_events, p_date, p_date)).map(
      (g) =>
        `${g.title}: ${g.points.map((p) => p.event.title).join(' + ')}${g.skipped ? ' (skipped)' : ''}`,
    );

  it('shows the same job at the same time once, listing every event', () => {
    expect(groupsOn([foundry14, foundry19], '2026-10-13')).toEqual([
      'Signup Message: Foundry 14 + Foundry 19',
    ]);
  });

  it('keeps them apart when the time differs', () => {
    const later = { ...foundry19, checkpoints: [cp(2, 'Signup Message', '12:00:00', null)] };
    expect(groupsOn([foundry14, later], '2026-10-13')).toHaveLength(2);
  });

  it('groups by linked task even when the titles differ', () => {
    const a = { ...foundry14, checkpoints: [cp(1, 'Post signup', '00:00:00', 7)] };
    const b = { ...foundry19, checkpoints: [cp(2, 'Signup reminder', '00:00:00', 7)] };
    const c = {
      ...foundry19,
      id: 20,
      title: 'Other',
      checkpoints: [cp(3, 'Post signup', '00:00:00', 8)],
    };
    expect(groupsOn([a, b, c], '2026-10-13')).toEqual([
      'Post signup: Foundry 14 + Foundry 19',
      'Post signup: Other',
    ]);
  });

  it('is only "skipped" when every event in it is skipped', () => {
    const skipped14 = { ...foundry14, skips: ['2026-10-18'] };
    expect(groupsOn([skipped14, foundry19], '2026-10-13')).toEqual([
      'Signup Message: Foundry 14 + Foundry 19',
    ]);
    const skipped19 = { ...foundry19, skips: ['2026-10-18'] };
    expect(groupsOn([skipped14, skipped19], '2026-10-13')).toEqual([
      'Signup Message: Foundry 14 + Foundry 19 (skipped)',
    ]);
  });
});

describe('matchRecords', () => {
  const records = [
    { id: 1, date: '2026-10-18', time: '14 UTC' },
    { id: 2, date: '2026-10-18', time: '19 UTC' },
    { id: 3, date: '2026-10-25', time: '14 UTC' },
  ];

  it('picks the record on the same date at the same time', () => {
    const result = matchRecords(records, '2026-10-18', '14:00:00');
    expect(result.match?.id).toBe(1);
    expect(result.others.map((r) => r.id)).toEqual([2]);
  });

  it("lists the day's records when no time matches", () => {
    const result = matchRecords(records, '2026-10-18', '12:00:00');
    expect(result.match).toBeNull();
    expect(result.others.map((r) => r.id)).toEqual([1, 2]);
  });

  it('finds nothing on a day without records', () => {
    expect(matchRecords(records, '2026-11-01', '14:00:00')).toEqual({ match: null, others: [] });
  });

  it('only lists the day when the event has no time', () => {
    expect(matchRecords(records, '2026-10-18', null).match).toBeNull();
  });
});
