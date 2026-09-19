/*
  Pure job classification shared by the Job Statistics page (jobparsing.js)
  and the Sitrep Generator, so both report the same "Job Types" and
  "completion time" for a job rather than each carrying their own copy of
  the rules.
*/

// Tag names that make a job one of the headline job types on the stats page.
const JOB_TYPE_TAGS = {
  Tree: ['Tree Down', 'Branch Down', 'Tree Threatening', 'Branch Threatening'],
  Damage: ['Roof Damage', 'Ceiling Damage', 'Door Damage', 'Wall Damage', 'Window Damage', 'Threat of Collapse'],
  Leak: ['Leaking Roof'],
};

/**
 * @param {{Tags?: Array<{Name: string}>}} job
 * @returns {string}  e.g. "Tree", "Damage+Tree" (sorted, combined), or "N/A" when no tag matches
 */
export function classifyJobType(job) {
  const names = new Set((job.Tags || []).map((t) => t.Name));
  const types = Object.keys(JOB_TYPE_TAGS).filter((type) => JOB_TYPE_TAGS[type].some((tag) => names.has(tag)));
  return types.length ? types.sort().join('+') : 'N/A';
}

// JobStatusTypeHistory `Type` ids
const STATUS_ACTIVE = 2;
const STATUS_COMPLETE = 6;
const COMPLETED_STATUSES = [6, 7, 8]; // Complete, Cancelled, Finalised -- the first of these is when the job "completed"

/**
 * @param {{JobStatusTypeHistory?: Array<{Type: number, Timelogged: string}>}} job
 * @returns {{completedAt: Date|null, durationMs: number}}  durationMs is first Active -> first Complete
 *          (0 when the job never had both, or they're out of order) -- the stats page's own definition
 */
export function analyseJobHistory(job) {
  let start = null;
  let end = null;
  let completedAt = null;
  (job.JobStatusTypeHistory || []).forEach((h) => {
    if (h.Type === STATUS_ACTIVE && start === null) start = new Date(h.Timelogged);
    if (h.Type === STATUS_COMPLETE && end === null) end = new Date(h.Timelogged);
    if (COMPLETED_STATUSES.includes(h.Type) && completedAt === null) completedAt = new Date(h.Timelogged);
  });
  const durationMs = start !== null && end !== null ? Math.max(end - start, 0) : 0;
  return { completedAt, durationMs };
}
