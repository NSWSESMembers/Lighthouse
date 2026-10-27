/*
  Fetches the jobs the stats page shows, prepared as crossfilter facts.
  (The HQ lookup is shared: src/pages/shared/beacon.js loadUnits.)

  The Beacon client is passed in (BeaconClient in the page, a stub in tests).
*/

import { prepareJobs, eventLabels } from './prepareJobs.js';

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
