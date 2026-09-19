/*
  Pure substring/ranked matcher for the entry form's optional incident
  association (BeaconClient/job.js#search results). Same ranking idea as
  callsignSuggestions.js/entitySuggestions.js: prefix matches on the job's
  Identifier before mid-string matches, then by address as a tiebreak so the
  list has a stable order.

  Field shape (Identifier/Address.PrettyAddress/JobType.Name) is confirmed
  from job.get()'s response (see teamsummary.js's job popup); job.search()
  uses a different ViewModelType and hasn't been confirmed to return exactly
  the same shape -- guarded with optional chaining everywhere so a missing
  field degrades to "not shown", never a crash.
*/

/**
 * @param {Array<object>} jobs
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function rankJobSuggestions(jobs, query, limit = 8) {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return [];

  return jobs
    .filter((job) => {
      const identifier = (job.Identifier || '').toLowerCase();
      const address = (job.Address?.PrettyAddress || '').toLowerCase();
      const id = String(job.Id ?? '').toLowerCase();
      return identifier.includes(trimmed) || address.includes(trimmed) || id.includes(trimmed);
    })
    .sort((a, b) => {
      const aId = (a.Identifier || '').toLowerCase();
      const bId = (b.Identifier || '').toLowerCase();
      const aStarts = aId.startsWith(trimmed) ? 0 : 1;
      const bStarts = bId.startsWith(trimmed) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aId.localeCompare(bId);
    })
    .slice(0, limit);
}
