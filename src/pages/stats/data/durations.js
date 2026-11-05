/*
  Completion-time figures for the "how long do jobs take" panel.
*/

import { quantileSorted, mean } from 'd3';
import humanizeDuration from 'humanize-duration';

/**
 * @param {number[]} durationsMs  time-to-complete per job; zeros (never
 *        completed, or no Active->Complete history) are ignored
 * @returns {{count: number, fastMean: number|undefined, typicalMean: number|undefined,
 *            slowMean: number|undefined, p25: number|undefined, p50: number|undefined,
 *            p75: number|undefined}}
 */
export function summarizeDurations(durationsMs) {
  const sorted = durationsMs.filter((d) => d > 0).sort((a, b) => a - b);
  const n = sorted.length;
  // Quickest 20%, slowest 20%, and the 60% in between (all of them when
  // there are too few jobs for a middle band).
  const fast = sorted.slice(0, Math.ceil(n * 0.2));
  const slow = sorted.slice(Math.floor(n * 0.8));
  let middle = sorted.slice(Math.ceil(n * 0.2), Math.floor(n * 0.8));
  if (!middle.length) middle = sorted;
  return {
    count: n,
    fastMean: mean(fast),
    typicalMean: mean(middle),
    slowMean: mean(slow),
    p25: quantileSorted(sorted, 0.25),
    p50: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
  };
}

/** "2 hours, 15 minutes"; an em dash when there's nothing to show. */
export function formatDuration(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return '—';
  return humanizeDuration(ms, { round: true, largest: 2, units: ['d', 'h', 'm'] });
}
