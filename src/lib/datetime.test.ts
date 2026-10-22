import { describe, expect, it } from 'vitest';

import { dhakaBusinessDate, formatDhakaDate, formatDhakaDateTime } from './datetime';

/**
 * The shop is in Dhaka, the database is in UTC. A sale made at 00:30 local must
 * show as that day, not the day before — this is the difference between a
 * correct daily report and a wrong one (PROJECT_RULES 5.2).
 */
describe('Dhaka time', () => {
  it('rolls the date over at midnight Dhaka time, not UTC', () => {
    // 18:30 UTC on the 15th is 00:30 on the 16th in Dhaka.
    expect(formatDhakaDate('2026-01-15T18:30:00.000Z', 'en')).toBe('16 Jan 2026');
    expect(dhakaBusinessDate(new Date('2026-01-15T18:30:00.000Z'))).toBe('2026-01-16');
  });

  it('keeps an evening sale on the same day', () => {
    // 17:59 UTC is 23:59 in Dhaka — still the 15th.
    expect(formatDhakaDate('2026-01-15T17:59:00.000Z', 'en')).toBe('15 Jan 2026');
    expect(dhakaBusinessDate(new Date('2026-01-15T17:59:00.000Z'))).toBe('2026-01-15');
  });

  it('shows Bangla digits when asked', () => {
    expect(formatDhakaDate('2026-01-15T06:00:00.000Z', 'bn')).toBe('১৫ Jan ২০২৬');
  });

  it('includes the time for a receipt', () => {
    // 06:05 UTC is 12:05 pm in Dhaka (UTC+6).
    expect(formatDhakaDateTime('2026-01-15T06:05:00.000Z', 'en')).toBe('15 Jan 2026, 12:05 pm');
  });

  it('never throws on a broken timestamp', () => {
    expect(formatDhakaDate('not-a-date', 'en')).toBe('not-a-date');
  });
});
