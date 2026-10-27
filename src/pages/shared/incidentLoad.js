/*
  What the first-load ring shows on the pages that load a whole incident
  search (Incident Statistics, Incident Export).

  Nearly all of a load is the incident search: 100 incidents per request,
  one request after another, and Beacon only says how many there are once
  the first page is back. So the ring spins until then, then counts
  incidents, with the page it's on and a time estimate from how long the
  pages so far took, then shows a full ring while the page finishes up
  (`finishingTitle`: "Building charts…").
*/

import { SLOW_AFTER_MS, RING_CIRCUMFERENCE, centreValueSize, waitingRing } from './loadRing.js';

export { SLOW_AFTER_MS, RING_CIRCUMFERENCE, centreValueSize };

export const PAGE_SIZE = 100; // BeaconClient job.search
export const MAX_PAGE_DOTS = 12;

/** "about 6 s left", "about 2 min left". */
export function etaText(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `about ${s} s left`;
  return `about ${Math.round(s / 60)} min left`;
}

/**
 * Seconds-to-go estimate, once two pages have arrived: the average time
 * per page since the first, times the pages left, less the time since
 * the last one arrived.
 */
export function estimateMsLeft({ pagesDone, pages, firstPageAt, lastPageAt, now }) {
  if (pagesDone < 2 || pagesDone >= pages || firstPageAt == null || lastPageAt == null) return null;
  const perPage = (lastPageAt - firstPageAt) / (pagesDone - 1);
  return Math.max(1000, perPage * (pages - pagesDone) - (now - lastPageAt));
}

/**
 * @param {object} s
 * @param {'starting'|'incidents'|'finishing'} s.phase
 * @param {number} s.loaded   incidents received so far
 * @param {number|null} s.total  Beacon's total (null until the first page)
 * @param {number} s.startedAt  ms timestamps
 * @param {number|null} s.firstPageAt
 * @param {number|null} s.lastPageAt
 * @param {number} s.now
 * @param {string} [s.finishingTitle='Finishing…']  the title once every incident is in
 */
export function describeLoad({ phase, loaded, total, startedAt, firstPageAt = null, lastPageAt = null, now, finishingTitle = 'Finishing…' }) {
  if (phase === 'starting' || total === null) {
    return waitingRing({ startedAt, now, title: 'Asking Beacon for incidents…' });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagesDone = Math.min(pages, Math.ceil(loaded / PAGE_SIZE));
  const fraction = total ? Math.min(1, loaded / total) : 1;
  const finishing = phase === 'finishing';
  const left = finishing ? null : estimateMsLeft({ pagesDone, pages, firstPageAt, lastPageAt, now });
  const many = pages > MAX_PAGE_DOTS;

  return {
    indeterminate: false,
    ringOffset: RING_CIRCUMFERENCE * (1 - (finishing ? 1 : fraction)),
    centreValue: (finishing ? total : loaded).toLocaleString(),
    centreValueSize: centreValueSize((finishing ? total : loaded).toLocaleString()),
    // Two short lines: "of 20,316" / "incidents" fits where one line doesn't.
    centreLabel: `of ${total.toLocaleString()}`,
    centreLabel2: total === 1 ? 'incident' : 'incidents',
    title: finishing ? finishingTitle : 'Loading incidents',
    meta: finishing
      ? `${total.toLocaleString()} ${total === 1 ? 'incident' : 'incidents'} loaded`
      : `page ${Math.max(1, pagesDone)} of ${pages}${left ? ' · ' + etaText(left) : ''}`,
    slow: false,
    pageDots: many ? [] : Array.from({ length: pages }, (_, i) => ({ done: i < pagesDone })),
    showPageBar: many,
    pageBarPct: Math.round((pagesDone / pages) * 100),
    pageBarStyle: { width: Math.round((pagesDone / pages) * 100) + '%' },
    ariaNow: Math.round(fraction * 100),
    ariaMax: 100,
  };
}
