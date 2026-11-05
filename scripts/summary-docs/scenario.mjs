/*
  Deterministic demo data for the Incident Summary page.

  Beacon's Reports/JobsSummary answers with flat { Name, Count } rows: one
  per incident status and one per incident type / rescue category. The
  mock builds those rows from a list of fake incidents (unit, received
  time, status, type), so the HQ and date filters change the counts the
  way they would in Beacon. Every value is invented; see
  scripts/page-docs/units.mjs for the fake units.
*/

import { UNITS, prng } from '../page-docs/units.mjs';

export { UNITS };

// Report rows Beacon sends even at zero (the page must cope with missing ones too).
export const STATUS_ROWS = ['New', 'Acknowledged', 'Active', 'Tasked', 'Referred', 'Complete', 'Cancelled', 'Rejected', 'Finalised'];
export const TYPE_ROWS = [
  'Storm', 'Support', 'Flood Misc', 'Medical Resupply', 'Fodder Drop', 'Resupply', 'Vet Assistance',
  'RCR', 'FR', 'WR', 'VR', 'CFR', 'LAR', 'GLR', 'PAD',
];

const TYPES = [
  ['Storm', 62], ['Support', 9], ['Flood Misc', 7], ['Resupply', 3], ['Medical Resupply', 2], ['Fodder Drop', 1],
  ['Vet Assistance', 1], ['RCR', 6], ['FR', 3], ['VR', 2], ['LAR', 2], ['CFR', 1], ['GLR', 1],
];

function pickWeighted(rand, list) {
  const total = list.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [v, w] of list) {
    if ((r -= w) < 0) return v;
  }
  return list[list.length - 1][0];
}

/** Recent incidents are mostly still open; older ones mostly closed. */
function statusFor(rand, hoursAgo) {
  if (hoursAgo < 6) return pickWeighted(rand, [['New', 3], ['Active', 4], ['Tasked', 5], ['Referred', 1], ['Complete', 3]]);
  if (hoursAgo < 24) return pickWeighted(rand, [['New', 1], ['Active', 2], ['Tasked', 3], ['Referred', 1], ['Complete', 8], ['Cancelled', 1], ['Finalised', 2]]);
  return pickWeighted(rand, [['Active', 1], ['Tasked', 1], ['Complete', 6], ['Cancelled', 1], ['Rejected', 1], ['Finalised', 8]]);
}

/**
 * @param {Date} now
 * @returns {{units: object[], incidents: Array<{unitId, received: Date, status, type}>, addNew: Function}}
 */
export function buildScenario(now) {
  const rand = prng(20261027);
  const incidents = [];
  // About 300 incidents over the last week, most of them in a storm over the last two days.
  for (let i = 0; i < 300; i++) {
    const storm = rand() < 0.65;
    const hoursAgo = storm ? rand() * 48 : rand() * 168;
    incidents.push({
      unitId: UNITS[Math.floor(rand() * UNITS.length)].Id,
      received: new Date(now.getTime() - hoursAgo * 3600e3),
      status: statusFor(rand, hoursAgo),
      type: storm ? 'Storm' : pickWeighted(rand, TYPES),
    });
  }
  return {
    units: UNITS,
    incidents,
    /** New incidents arriving now (for the new-incident alert). */
    addNew(count = 1, unitId = UNITS[0].Id) {
      for (let i = 0; i < count; i++) incidents.push({ unitId, received: new Date(now.getTime() - 60e3), status: 'New', type: 'Storm' });
    },
  };
}

/** The JobsSummary rows for some HQs ([] = all) over a range. */
export function summaryRows(scenario, { hqs, start, end }) {
  const counts = Object.fromEntries([...STATUS_ROWS, ...TYPE_ROWS].map((n) => [n, 0]));
  for (const j of scenario.incidents) {
    if (hqs.length && !hqs.includes(j.unitId)) continue;
    if (j.received < start || j.received > end) continue;
    counts[j.status]++;
    counts[j.type]++;
  }
  return Object.entries(counts).map(([Name, Count]) => ({ Name, Count }));
}
