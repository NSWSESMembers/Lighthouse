/*
  Incident (Beacon "Job") counting for the reporting period. Jobs/Search's
  own StartDate/EndDate filtering semantics aren't documented as inclusive or
  exclusive, so results are always re-filtered client-side against the
  period's inclusive-start/exclusive-end boundary using JobReceived --
  the instant Beacon recorded the job, not any later status change.
*/

/**
 * @param {Array<{JobReceived: string}>} jobs
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {Array<object>}  jobs received within [windowStart, windowEnd)
 */
export function filterIncidentsReceivedInWindow(jobs, windowStart, windowEnd) {
  return jobs.filter((job) => {
    const received = new Date(job.JobReceived).getTime();
    return received >= windowStart.getTime() && received < windowEnd.getTime();
  });
}

/**
 * Optional event/sector filter -- only applied when the job carries the
 * relevant field, per "event or sector filters where supported by the
 * data": some jobs have no Sector or Event assigned, and those are left in
 * rather than silently dropped when no filter is requested.
 *
 * @param {Array<object>} jobs
 * @param {{sectorId?: string|number|null, eventId?: string|number|null}} filters
 * @returns {Array<object>}
 */
export function applyIncidentFilters(jobs, filters = {}) {
  const { sectorId, eventId } = filters;
  return jobs.filter((job) => {
    if (sectorId != null && String(job.Sector?.Id) !== String(sectorId)) return false;
    if (eventId != null && String(job.Event?.Id) !== String(eventId)) return false;
    return true;
  });
}
