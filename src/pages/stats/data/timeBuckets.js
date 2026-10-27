/*
  Bucketing for the received/closed-over-time charts.
*/

import { timeHour, timeHours, timeDay, timeDays } from 'd3';

const DAY_MS = 24 * 3600 * 1000;

// Up to two weeks shows hourly bars; longer ranges get daily bars.
const HOURLY_LIMIT_DAYS = 14;

// Stand-in date for jobs that aren't closed yet, so crossfilter dimensions
// keyed on the close time stay all-Date. It sits outside every chart domain.
export const NOT_CLOSED = new Date(0);

/**
 * @param {Date} start
 * @param {Date} end
 * @returns {{label: 'Hour'|'Day', floor: Function, units: Function}}
 */
export function bucketFor(start, end) {
  const days = Math.round(Math.abs(end - start) / DAY_MS);
  return days <= HOURLY_LIMIT_DAYS
    ? { label: 'Hour', floor: timeHour, units: timeHours }
    : { label: 'Day', floor: timeDay, units: timeDays };
}

/**
 * Bucket key for when an incident closed: its close time floored to the
 * bucket, or NOT_CLOSED itself while it's open. The placeholder is never
 * floored -- a Sydney-time day floor moves it, and open incidents would then
 * slip past the NOT_CLOSED filters and count as closed.
 *
 * @param {(d: Date) => Date} floor  bucketFor(...).floor
 */
export const closedBucket = (floor) => (fact) => (fact.closed ? floor(fact.closed) : NOT_CLOSED);

/**
 * Wraps a crossfilter group so all() returns running totals, skipping the
 * NOT_CLOSED bucket.
 */
export function cumulativeGroup(group) {
  return {
    all() {
      let total = 0;
      return group.all()
        .filter((d) => +d.key !== +NOT_CLOSED)
        .map((d) => {
          total += d.value;
          return { key: d.key, value: total };
        });
    },
  };
}

/** Wraps a group so all() drops empty bins and the zero key. */
export function withoutEmptyBins(group) {
  return {
    all() {
      return group.all().filter((d) => d.value !== 0 && d.key !== 0);
    },
  };
}

/** Round up to the nearest `step` (0.1 -> one decimal place). */
export function roundUp(value, step = 1) {
  const inv = 1 / step;
  return Math.ceil(value * inv) / inv;
}
