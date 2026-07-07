/**
 * Timezone: ALL check-in windows are standardized to IST (Asia/Kolkata, UTC+5:30).
 * The check_in_window_start and check_in_window_end columns in the database are
 * treated as IST times. This file provides pure utility functions for that conversion.
 *
 * Pure functions (accept `now: Date` parameter) so they are trivially testable
 * without any mocking — just pass a specific UTC Date that maps to the desired IST time.
 */

/**
 * Returns the current date in IST as 'YYYY-MM-DD'.
 * Uses 'sv-SE' locale which naturally produces ISO format.
 */
export function getISTDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
  }).format(now);
}

/**
 * Returns the current time in IST as 'HH:MM:SS'.
 */
export function getISTTimeString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

/**
 * Converts a time string ('HH:MM:SS' or 'HH:MM') to total seconds since midnight.
 * Used for numeric comparison of time-of-day values.
 */
export function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Returns the status of the check-in window for a given IST time.
 *
 * - 'before_window': current time is before window_start (reject, too early)
 * - 'in_window':     current time is within [window_start, window_end] inclusive
 * - 'after_window':  current time is past window_end (reject, too late — auto-fail territory)
 *
 * NOTE: Assumes the window does not span midnight. window_end must be > window_start.
 * All times are IST.
 */
export function getWindowStatus(
  windowStart: string,   // 'HH:MM:SS' in IST
  windowEnd: string,     // 'HH:MM:SS' in IST
  currentISTTime: string // 'HH:MM:SS' in IST
): 'before_window' | 'in_window' | 'after_window' {
  const startSecs = timeStringToSeconds(windowStart);
  const endSecs = timeStringToSeconds(windowEnd);
  const currentSecs = timeStringToSeconds(currentISTTime);

  if (currentSecs < startSecs) return 'before_window';
  if (currentSecs > endSecs) return 'after_window';
  return 'in_window';
}

/**
 * Returns true if the given IST time falls within the check-in window (inclusive).
 */
export function isWithinWindow(
  windowStart: string,
  windowEnd: string,
  currentISTTime: string
): boolean {
  return getWindowStatus(windowStart, windowEnd, currentISTTime) === 'in_window';
}

/**
 * Returns a human-readable countdown string for the frontend.
 * e.g. "Opens in 2h 15m", "Closes in 43m", "Window closed"
 */
export function getWindowMessage(
  windowStart: string,
  windowEnd: string,
  now: Date = new Date()
): { status: 'before_window' | 'in_window' | 'after_window'; message: string } {
  const currentIST = getISTTimeString(now);
  const status = getWindowStatus(windowStart, windowEnd, currentIST);

  const currentSecs = timeStringToSeconds(currentIST);
  const startSecs = timeStringToSeconds(windowStart);
  const endSecs = timeStringToSeconds(windowEnd);

  const fmtDuration = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (status === 'before_window') {
    return { status, message: `Window opens in ${fmtDuration(startSecs - currentSecs)}` };
  }
  if (status === 'after_window') {
    return { status, message: 'Window closed — missed today' };
  }
  return { status, message: `Window closes in ${fmtDuration(endSecs - currentSecs)}` };
}
