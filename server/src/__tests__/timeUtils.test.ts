/**
 * Hard Rule #7: Tests for time/date logic.
 *
 * Strategy: All timeUtils functions accept `now: Date` as a parameter.
 * We construct specific UTC Date objects that map to desired IST times
 * without any mocking library. IST = UTC + 5h 30m.
 *
 * To get IST time T, create a UTC date at T - 5:30.
 * Example: IST 14:30:00 = UTC 09:00:00
 */

import {
  getISTDate,
  getISTTimeString,
  timeStringToSeconds,
  getWindowStatus,
  isWithinWindow,
  getWindowMessage,
} from '../lib/timeUtils';

// Helper: build a UTC Date that corresponds to a specific IST time on 2026-07-05
// IST = UTC + 5h30m  →  UTC = IST - 5h30m  →  subtract 19800 seconds
function istToUtcDate(istDateStr: string, istTimeStr: string): Date {
  const [h, m, s] = istTimeStr.split(':').map(Number);
  const istTotalSecs = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
  const utcTotalSecs = istTotalSecs - 5 * 3600 - 30 * 60; // subtract 5h30m
  const utcH = Math.floor(((utcTotalSecs % 86400) + 86400) % 86400 / 3600);
  const utcM = Math.floor((((utcTotalSecs % 86400) + 86400) % 86400 % 3600) / 60);
  const utcS = ((utcTotalSecs % 86400) + 86400) % 86400 % 60;

  // If utcTotalSecs < 0, the UTC time rolls back to the previous calendar day
  const date = new Date(istDateStr);
  const dayOffset = utcTotalSecs < 0 ? -1 : 0;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(utcH, utcM, utcS, 0);
  return date;
}

const WINDOW_START = '06:00:00';
const WINDOW_END = '23:00:00';
const TEST_DATE = '2026-07-05';

// ─── timeStringToSeconds ────────────────────────────────────────────────────

describe('timeStringToSeconds', () => {
  test('converts HH:MM:SS correctly', () => {
    expect(timeStringToSeconds('00:00:00')).toBe(0);
    expect(timeStringToSeconds('01:00:00')).toBe(3600);
    expect(timeStringToSeconds('06:00:00')).toBe(21600);
    expect(timeStringToSeconds('23:59:59')).toBe(86399);
  });

  test('handles HH:MM without seconds', () => {
    expect(timeStringToSeconds('06:00')).toBe(21600);
    expect(timeStringToSeconds('23:00')).toBe(82800);
  });
});

// ─── getISTDate ─────────────────────────────────────────────────────────────

describe('getISTDate', () => {
  test('returns correct IST date when UTC is same day', () => {
    // IST 14:30 on July 5 = UTC 09:00 on July 5
    const utcDate = new Date('2026-07-05T09:00:00Z');
    expect(getISTDate(utcDate)).toBe('2026-07-05');
  });

  test('returns next day in IST when UTC is late evening (near midnight)', () => {
    // IST 00:30 on July 6 = UTC 19:00 on July 5 (UTC 19:00 + 5:30 = 00:30 IST next day)
    const utcDate = new Date('2026-07-05T19:00:00Z');
    expect(getISTDate(utcDate)).toBe('2026-07-06');
  });

  test('returns previous day in IST when UTC is early morning', () => {
    // IST 02:00 on July 5 = UTC 20:30 on July 4
    const utcDate = new Date('2026-07-04T20:30:00Z');
    expect(getISTDate(utcDate)).toBe('2026-07-05');
  });
});

// ─── getISTTimeString ───────────────────────────────────────────────────────

describe('getISTTimeString', () => {
  test('returns IST time offset from UTC correctly', () => {
    // UTC 09:00 → IST 14:30
    const utcDate = new Date('2026-07-05T09:00:00Z');
    expect(getISTTimeString(utcDate)).toBe('14:30:00');
  });

  test('handles UTC midnight → IST 05:30', () => {
    const utcDate = new Date('2026-07-05T00:00:00Z');
    expect(getISTTimeString(utcDate)).toBe('05:30:00');
  });
});

// ─── getWindowStatus / isWithinWindow ───────────────────────────────────────

describe('getWindowStatus — window 06:00:00 to 23:00:00 IST', () => {

  // ── HARD RULE #7: Test 1 — On-time check-in (within window)
  test('check-in at 14:30 IST is in_window', () => {
    const now = istToUtcDate(TEST_DATE, '14:30:00');
    const status = getWindowStatus(WINDOW_START, WINDOW_END, getISTTimeString(now));
    expect(status).toBe('in_window');
    expect(isWithinWindow(WINDOW_START, WINDOW_END, getISTTimeString(now))).toBe(true);
  });

  // ── HARD RULE #7: Test 2 — Check-in 1 minute before window opens
  test('check-in at 05:59:00 IST (1 min before open) is before_window', () => {
    const now = istToUtcDate(TEST_DATE, '05:59:00');
    const status = getWindowStatus(WINDOW_START, WINDOW_END, getISTTimeString(now));
    expect(status).toBe('before_window');
    expect(isWithinWindow(WINDOW_START, WINDOW_END, getISTTimeString(now))).toBe(false);
  });

  // ── HARD RULE #7: Test 3 — Check-in 1 minute after window closes
  test('check-in at 23:01:00 IST (1 min after close) is after_window', () => {
    const now = istToUtcDate(TEST_DATE, '23:01:00');
    const status = getWindowStatus(WINDOW_START, WINDOW_END, getISTTimeString(now));
    expect(status).toBe('after_window');
    expect(isWithinWindow(WINDOW_START, WINDOW_END, getISTTimeString(now))).toBe(false);
  });

  // ── HARD RULE #7: Test 4 — Exactly at window_start boundary (inclusive)
  test('check-in exactly at 06:00:00 IST (window_start) is in_window', () => {
    const now = istToUtcDate(TEST_DATE, '06:00:00');
    const status = getWindowStatus(WINDOW_START, WINDOW_END, getISTTimeString(now));
    expect(status).toBe('in_window');
  });

  // ── HARD RULE #7: Test 5 — Exactly at window_end boundary (inclusive)
  test('check-in exactly at 23:00:00 IST (window_end) is in_window', () => {
    const now = istToUtcDate(TEST_DATE, '23:00:00');
    const status = getWindowStatus(WINDOW_START, WINDOW_END, getISTTimeString(now));
    expect(status).toBe('in_window');
  });

  // ── HARD RULE #7: Timezone edge case — UTC midnight maps to IST 05:30
  test('UTC midnight (IST 05:30) is before_window (window opens at 06:00 IST)', () => {
    const utcMidnight = new Date('2026-07-05T00:00:00Z'); // IST = 05:30
    const istTime = getISTTimeString(utcMidnight);
    expect(istTime).toBe('05:30:00');
    expect(getWindowStatus(WINDOW_START, WINDOW_END, istTime)).toBe('before_window');
  });

  // ── HARD RULE #7: Timezone edge case — UTC 17:30 = IST 23:00 (exactly at boundary)
  test('UTC 17:30:00 maps to IST 23:00:00 and is exactly at window_end', () => {
    const utcDate = new Date('2026-07-05T17:30:00Z'); // IST = 23:00
    const istTime = getISTTimeString(utcDate);
    expect(istTime).toBe('23:00:00');
    expect(getWindowStatus(WINDOW_START, WINDOW_END, istTime)).toBe('in_window');
  });

  // ── HARD RULE #7: Timezone edge case — UTC 17:31:00 = IST 23:01:00 (1s past end)
  test('UTC 17:31:00 maps to IST 23:01:00 and is after_window', () => {
    const utcDate = new Date('2026-07-05T17:31:00Z');
    const istTime = getISTTimeString(utcDate);
    expect(istTime).toBe('23:01:00');
    expect(getWindowStatus(WINDOW_START, WINDOW_END, istTime)).toBe('after_window');
  });
});

// ─── getWindowMessage ───────────────────────────────────────────────────────

describe('getWindowMessage', () => {
  test('returns countdown before window opens', () => {
    const now = istToUtcDate(TEST_DATE, '04:00:00'); // 2h before 06:00
    const result = getWindowMessage(WINDOW_START, WINDOW_END, now);
    expect(result.status).toBe('before_window');
    expect(result.message).toMatch(/opens in/i);
    expect(result.message).toContain('2h');
  });

  test('returns countdown to close while in window', () => {
    const now = istToUtcDate(TEST_DATE, '22:00:00'); // 1h before 23:00
    const result = getWindowMessage(WINDOW_START, WINDOW_END, now);
    expect(result.status).toBe('in_window');
    expect(result.message).toMatch(/closes in/i);
  });

  test('returns missed message after window closes', () => {
    const now = istToUtcDate(TEST_DATE, '23:30:00');
    const result = getWindowMessage(WINDOW_START, WINDOW_END, now);
    expect(result.status).toBe('after_window');
    expect(result.message).toMatch(/missed/i);
  });
});
