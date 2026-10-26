/*
  What the first-load ring shows (stats.html, #stats-loading).

  Nearly all of a load is the incident search: 100 incidents per request,
  one request after another, and Beacon only says how many there are once
  the first page is back. So the ring spins until then, then counts
  incidents, with the page it's on and a time estimate from how long the
  pages so far took.
*/

export const PAGE_SIZE = 100; // BeaconClient job.search
export const SLOW_AFTER_MS = 10000;
export const MAX_PAGE_DOTS = 12;
export const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 in the 120x120 viewBox

/**
 * Font size for the ring's centre number, so it fits inside the ring
 * (inner width ~90 of the 120 viewBox) at any count: "311" to "120,316".
 */
export function centreValueSize(text) {
  const n = String(text).length;
  if (n <= 3) return '30px';
  if (n <= 5) return '24px';
  if (n <= 6) return '20px';
  return '17px';
}

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
 * @param {'starting'|'incidents'|'charts'} s.phase
 * @param {number} s.loaded   incidents received so far
 * @param {number|null} s.total  Beacon's total (null until the first page)
 * @param {number} s.startedAt  ms timestamps
 * @param {number|null} s.firstPageAt
 * @param {number|null} s.lastPageAt
 * @param {number} s.now
 */
export function describeLoad({ phase, loaded, total, startedAt, firstPageAt = null, lastPageAt = null, now }) {
  if (phase === 'starting' || total === null) {
    const waited = Math.max(0, now - startedAt);
    const slow = waited >= SLOW_AFTER_MS;
    return {
      indeterminate: true,
      ringOffset: RING_CIRCUMFERENCE * 0.75,
      centreValue: '',
      centreValueSize: '30px',
      centreLabel: '',
      centreLabel2: '',
      title: slow ? 'Still waiting for Beacon' : 'Asking Beacon for incidents…',
      meta: `waiting ${Math.floor(waited / 1000)} s`,
      slow,
      pageDots: [],
      showPageBar: false,
      pageBarPct: 0,
      ariaNow: 0,
      ariaMax: 100,
    };
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagesDone = Math.min(pages, Math.ceil(loaded / PAGE_SIZE));
  const fraction = total ? Math.min(1, loaded / total) : 1;
  const charts = phase === 'charts';
  const left = charts ? null : estimateMsLeft({ pagesDone, pages, firstPageAt, lastPageAt, now });
  const many = pages > MAX_PAGE_DOTS;

  return {
    indeterminate: false,
    ringOffset: RING_CIRCUMFERENCE * (1 - (charts ? 1 : fraction)),
    centreValue: (charts ? total : loaded).toLocaleString(),
    centreValueSize: centreValueSize((charts ? total : loaded).toLocaleString()),
    // Two short lines: "of 20,316" / "incidents" fits where one line doesn't.
    centreLabel: `of ${total.toLocaleString()}`,
    centreLabel2: total === 1 ? 'incident' : 'incidents',
    title: charts ? 'Building charts…' : 'Loading incidents',
    meta: charts
      ? `${total.toLocaleString()} ${total === 1 ? 'incident' : 'incidents'} loaded`
      : `page ${Math.max(1, pagesDone)} of ${pages}${left ? ' · ' + etaText(left) : ''}`,
    slow: false,
    pageDots: many ? [] : Array.from({ length: pages }, (_, i) => ({ done: i < pagesDone })),
    showPageBar: many,
    pageBarPct: Math.round((pagesDone / pages) * 100),
    ariaNow: Math.round(fraction * 100),
    ariaMax: 100,
  };
}
