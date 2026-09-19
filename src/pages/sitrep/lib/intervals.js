/*
  Generic half-open interval ([start, end)) helpers used throughout the
  sitrep calculations. `end === null` means "ongoing / still open".
*/

/**
 * @param {Date} start
 * @param {Date|null} end
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {boolean}
 */
export function intervalOverlapsWindow(start, end, windowStart, windowEnd) {
  const startMs = start.getTime();
  const endMs = end === null ? Infinity : end.getTime();
  return startMs < windowEnd.getTime() && endMs > windowStart.getTime();
}

/**
 * Clamp an interval to a window, returning null if there's no overlap.
 *
 * @param {Date} start
 * @param {Date|null} end
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {{start: Date, end: Date}|null}
 */
export function clampIntervalToWindow(start, end, windowStart, windowEnd) {
  if (!intervalOverlapsWindow(start, end, windowStart, windowEnd)) return null;
  const clampedStart = start.getTime() > windowStart.getTime() ? start : windowStart;
  const endMs = end === null ? Infinity : end.getTime();
  const clampedEnd = endMs < windowEnd.getTime() ? end : windowEnd;
  return { start: clampedStart, end: clampedEnd };
}

/**
 * Intersect two possibly-open intervals; null if they don't overlap.
 *
 * @param {{start: Date, end: Date|null}} a
 * @param {{start: Date, end: Date|null}} b
 * @returns {{start: Date, end: Date|null}|null}
 */
export function intersectIntervals(a, b) {
  const startMs = Math.max(a.start.getTime(), b.start.getTime());
  const aEndMs = a.end === null ? Infinity : a.end.getTime();
  const bEndMs = b.end === null ? Infinity : b.end.getTime();
  const endMs = Math.min(aEndMs, bEndMs);
  if (startMs >= endMs) return null;
  return { start: new Date(startMs), end: endMs === Infinity ? null : new Date(endMs) };
}
