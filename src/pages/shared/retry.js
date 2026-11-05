/*
  When a page that refreshes itself tries again after a failed load.

  These pages are left up on screens with nobody to click Try again, so a
  failure never stops the refresh countdown: it counts to the next try
  instead, starting at `first` seconds and doubling up to `max`, and a
  success goes back to the normal `refresh` period.
*/

/**
 * Seconds until the next load.
 *
 * @param {number} failures  failed loads in a row (0 = the last one worked)
 * @param {{refresh: number, first: number, max: number}} timing  seconds
 */
export function retryDelay(failures, { refresh, first, max }) {
  if (failures <= 0) return refresh;
  return Math.min(max, first * 2 ** (failures - 1));
}
