/**
 * jobSweep.js
 *
 * Picks which incidents to stop tracking. Every incident the page has seen
 * stays in main.js's registry (jobs/jobsById, plus its taskings) after it
 * completes or otherwise leaves the filters, at roughly 90KB each -- over a
 * long event that's hundreds of MB per tab. The sweep drops an incident
 * once it has been outside the filters for a while and nothing on screen
 * still refers to it.
 */

// How long an incident must stay outside the filters before it's dropped.
// Long enough that a filter being edited, or a status flicking out and back
// (e.g. reopened), doesn't throw anything away.
export const SWEEP_GRACE_MS = 10 * 60 * 1000;

/**
 * @param {Array} jobs  every tracked Job
 * @param {object} opts
 * @param {number} opts.now  Date.now()
 * @param {Map} opts.outSince  Job -> when it was first seen droppable; kept between calls
 * @param {(job) => boolean} opts.keep  true while anything still needs the job
 * @param {number} [opts.graceMs]
 * @returns {Array} jobs to drop now (also removed from outSince)
 */
export function selectJobsToDrop(jobs, { now, outSince, keep, graceMs = SWEEP_GRACE_MS }) {
    const drop = [];
    const tracked = new Set(jobs);
    // Forget jobs that left the registry some other way.
    for (const job of outSince.keys()) {
        if (!tracked.has(job)) outSince.delete(job);
    }
    for (const job of jobs) {
        if (keep(job)) {
            outSince.delete(job);
            continue;
        }
        const since = outSince.get(job);
        if (since == null) {
            outSince.set(job, now);
        } else if (now - since >= graceMs) {
            outSince.delete(job);
            drop.push(job);
        }
    }
    return drop;
}
