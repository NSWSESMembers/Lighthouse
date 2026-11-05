/*
  Turns Beacon's Jobs Summary report (Reports/JobsSummary) into the figures
  the Incident Summary page shows.

  The report is one flat list of { Name, Count } rows: a row per incident
  status ("New", "Active", ...) and a row per incident type or rescue
  category ("Storm", "Flood Misc", "RCR", ...), each counting incidents in
  the range. The page sums some of them into groups (Flood, Rescue).
*/

/** Statuses of incidents still being worked on. */
export const OPEN_STATUSES = ['New', 'Active', 'Tasked', 'Referred'];
/** Statuses of incidents that are finished with. */
export const CLOSED_STATUSES = ['Complete', 'Cancelled', 'Rejected', 'Finalised'];

/**
 * The incident type tiles: each sums the report rows in `names`. `shown`
 * (default: all of `names`, when there's more than one) is listed under
 * the tile, so people know what's counted.
 */
export const TYPE_GROUPS = [
  { key: 'storm', label: 'Storm', names: ['Storm'] },
  { key: 'flood', label: 'Flood', names: ['Flood Misc', 'Medical Resupply', 'Fodder Drop', 'Resupply', 'Vet Assistance'] },
  // PAD is counted towards Rescue but not listed under the tile.
  { key: 'rescue', label: 'Rescue', names: ['RCR', 'FR', 'WR', 'VR', 'CFR', 'LAR', 'GLR', 'PAD'], shown: ['RCR', 'FR', 'WR', 'VR', 'CFR', 'LAR', 'GLR'] },
  { key: 'support', label: 'Support', names: ['Support'] },
];

const STATUS_LABELS = { Complete: 'Completed' };

/**
 * The report's rows, however Beacon wraps them: `{ result: [...] }` (what
 * the old page read), `{ Result: [...] }`, or a bare array.
 *
 * @returns {Array<{Name: string, Count: number}>}
 */
export function reportRows(report) {
  if (Array.isArray(report)) return report;
  return (report && (report.result || report.Result)) || [];
}

/**
 * @param {any} report  the JobsSummary response
 * @returns {{
 *   counts: Record<string, number>,
 *   outstanding: number, closed: number, total: number,
 *   open: Array<{key: string, label: string, count: number}>,
 *   finished: Array<{key: string, label: string, count: number}>,
 *   types: Array<{key: string, label: string, count: number, includes: string[]}>,
 * }}
 */
export function summarize(report) {
  const counts = {};
  for (const row of reportRows(report)) {
    if (!row || typeof row.Name !== 'string') continue;
    counts[row.Name] = (counts[row.Name] || 0) + (Number(row.Count) || 0);
  }
  // A row Beacon leaves out counts as none (the old page crashed instead).
  const count = (name) => counts[name] || 0;
  const status = (name) => ({ key: name.toLowerCase(), label: STATUS_LABELS[name] || name, count: count(name) });

  const open = OPEN_STATUSES.map(status);
  const finished = CLOSED_STATUSES.map(status);
  const outstanding = open.reduce((n, s) => n + s.count, 0);
  const closed = finished.reduce((n, s) => n + s.count, 0);

  return {
    counts,
    outstanding,
    closed,
    total: outstanding + closed,
    open,
    finished,
    types: TYPE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      count: g.names.reduce((n, name) => n + count(name), 0),
      includes: g.shown || (g.names.length > 1 ? g.names : []),
    })),
  };
}

/** "37%" of the total, or "—" when there's nothing to compare against. */
export function percentText(count, total) {
  if (!total || !count) return '—';
  return `${Math.round((count / total) * 100)}%`;
}
