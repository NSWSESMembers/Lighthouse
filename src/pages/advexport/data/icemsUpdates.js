/*
  The "ICEMS - Number Of IUM Transactions" column: how many ICEMS Incident
  Update Messages each ICEMS incident has had, counted from its Ops Log.

  That's one Ops Log request per ICEMS incident, so they go four at a time
  (quicker than the old page's one at a time, still light on Beacon).
  Incidents that didn't come through ICEMS are skipped. One failed
  request leaves that incident's cell empty and carries on.
*/

export const CONCURRENCY = 4;

/** Ops Log entries that are Incident Update Messages (not their acceptances). */
export function countUpdateMessages(logs) {
  return (logs || []).filter((r) => {
    const s = r && r.Subject;
    return typeof s === 'string' && s.includes('Incident Update Message') && !s.includes('Incident Update Message Acceptance');
  }).length;
}

/** The incidents worth asking about: those with an ICEMS id. */
export function icemsIncidents(jobs) {
  return jobs.filter((j) => j.ICEMSIncidentIdentifier != null && j.ICEMSIncidentIdentifier !== '');
}

/**
 * @param {{operationslog: {search: Function}}} client
 * @param {object[]} jobs  the ICEMS incidents (icemsIncidents)
 * @param {{host: string, userId: string, token: string, signal?: AbortSignal}} ctx
 * @param {object} [opts]
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @param {number} [opts.concurrency=CONCURRENCY]
 * @returns {Promise<{counts: Map<number, number>, failed: number}>}
 */
export async function countIcemsUpdates(client, jobs, ctx, { onProgress = () => {}, concurrency = CONCURRENCY } = {}) {
  const counts = new Map();
  let failed = 0;
  let next = 0;
  let done = 0;
  onProgress(0, jobs.length);

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (ctx.signal && ctx.signal.aborted) return;
      try {
        const { results } = await client.operationslog.search(job.Id, ctx);
        counts.set(job.Id, countUpdateMessages(results));
      } catch (err) {
        if (ctx.signal && ctx.signal.aborted) return;
        console.error(`Incident Export: Ops Log for incident ${job.Id} failed`, err);
        failed++;
      }
      done++;
      onProgress(done, jobs.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return { counts, failed };
}
