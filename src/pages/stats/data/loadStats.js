/*
  Fetches everything the stats page shows: the HQ entities (for the title)
  and the jobs in range, prepared as crossfilter facts.

  The Beacon client is passed in (BeaconClient in the page, a stub in tests).
*/

import { prepareJobs, eventLabels } from './prepareJobs.js';

/**
 * Looks up each HQ id. Done once per page load, the names don't change.
 *
 * @param {{unit: {getName: Function}}} client
 * @param {string[]} hqIds  [] for all of NSW
 * @param {{host: string, userId: string, token: string}} ctx
 * @returns {Promise<object[]>}
 */
export async function loadUnits(client, hqIds, ctx) {
  const units = await Promise.all(hqIds.map((id) => client.unit.getName(id, ctx)));
  return units.filter(Boolean);
}

/**
 * @param {{job: {search: Function}}} client
 * @param {object} args
 * @param {object[]} args.units  from loadUnits; [] searches all of NSW
 * @param {Date} args.start
 * @param {Date} args.end
 * @param {object} [args.clusters]  unitClusters.json
 * @param {{host: string, userId: string, token: string, signal?: AbortSignal,
 *          onProgress?: (done: number, total: number) => void}} ctx
 * @returns {Promise<{facts: object[], events: string[], total: number}>}
 */
export async function loadJobs(client, { units, start, end, clusters = null }, ctx) {
  // job.search takes a single entity, an array, or [] for no HQ filter.
  const scope = units.length === 1 ? units[0] : units;
  const { results } = await client.job.search(scope, start, end, ctx);
  return {
    facts: prepareJobs(results, { clusters }),
    events: eventLabels(results),
    total: results.length,
  };
}

/**
 * unitClusters.json ships with the extension. A failure only costs the
 * Cluster chart (everything shows as Unknown), so it resolves to null.
 */
export async function loadClusters(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
