/*
  Summaries of the incidents received in the period, using the same
  groupings as the Job Statistics page (stats.html): job type, priority,
  locality and average completion time (see lib/stats/jobClassification.js
  for the shared rules). Status counts are each job's *current* status as
  Beacon returned it -- not its status at the end of the period.
*/

import { analyseJobHistory } from '../../lib/stats/jobClassification.js';

const OUTSTANDING_STATUSES = ['new', 'active', 'tasked']; // Referred is counted on its own
const COMPLETE_STATUSES = ['complete', 'cancelled', 'rejected', 'finalised'];

/**
 * The incident's type as Beacon names it -- Storm, Support, Flood Support,
 * Tsunami, or a rescue type -- not the tag-derived grouping the stats page's
 * second pie uses.
 *
 * @param {{JobType?: {Name?: string}, Type?: string}} job
 * @returns {string}
 */
export function incidentType(job) {
  return job.JobType?.Name || job.Type || 'N/A';
}

/**
 * @param {Array<object>} jobs
 * @returns {{received: number, outstanding: number, referred: number, complete: number, other: number}}
 *          outstanding = New + Active + Tasked; referred = Referred; complete = Complete + Cancelled + Rejected + Finalised
 *          `other` = jobs whose status is in neither group (should be 0; surfaced rather than hidden)
 */
export function countByStatus(jobs) {
  const counts = { received: jobs.length, outstanding: 0, referred: 0, complete: 0, other: 0 };
  jobs.forEach((job) => {
    const status = (job.JobStatusType?.Name || '').trim().toLowerCase();
    if (OUTSTANDING_STATUSES.includes(status)) counts.outstanding += 1;
    else if (status === 'referred') counts.referred += 1;
    else if (COMPLETE_STATUSES.includes(status)) counts.complete += 1;
    else counts.other += 1;
  });
  return counts;
}

/**
 * @param {Array<object>} jobs
 * @param {(job: object) => string|null|undefined} keyOf
 * @returns {Array<{label: string, count: number}>}  most common first, ties alphabetical; blank keys are "N/A"
 */
export function tally(jobs, keyOf) {
  const counts = new Map();
  jobs.forEach((job) => {
    const label = (keyOf(job) || '').toString().trim() || 'N/A';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Mean Active -> Complete time over the jobs that have one (the stats page
 * ignores jobs with no measurable duration).
 *
 * @param {Array<object>} jobs
 * @returns {{averageMs: number|null, sampleSize: number}}
 */
export function averageCompletionTime(jobs) {
  const durations = jobs.map((job) => analyseJobHistory(job).durationMs).filter((ms) => ms > 0);
  if (durations.length === 0) return { averageMs: null, sampleSize: 0 };
  return { averageMs: durations.reduce((sum, ms) => sum + ms, 0) / durations.length, sampleSize: durations.length };
}

/**
 * @param {Array<object>} jobs  the incidents received in the period (already filtered)
 */
export function summariseIncidents(jobs) {
  return {
    ...countByStatus(jobs),
    jobTypes: tally(jobs, incidentType),
    priorities: tally(jobs, (job) => job.JobPriorityType?.Name),
    localities: tally(jobs, (job) => job.Address?.Locality),
    ...averageCompletionTime(jobs),
  };
}

/**
 * "2 hr 5 min", "1 day 3 hr", "45 min", "<1 min"
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1 min';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days && `${days} day${days === 1 ? '' : 's'}`, hours && `${hours} hr`, minutes && `${minutes} min`].filter(Boolean).join(' ');
}
