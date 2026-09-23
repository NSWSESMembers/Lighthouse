/*
  Pure substring/ranked matcher for the callsign field's team suggestions.
  Free-text is always allowed -- this never blocks submission, it only
  offers known team callsigns in the current scope for faster/safer entry
  (a chosen suggestion is still just plain text in the Subject field, no
  team/incident relationship is inferred from it -- see radioLogPayload.js).
*/

/**
 * @param {Array<{Callsign: string}>} teams
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{Callsign: string}>}
 */
export function suggestCallsigns(teams, query, limit = 8) {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return [];

  return teams
    .filter((team) => (team.Callsign || '').toLowerCase().includes(trimmed))
    .sort((a, b) => {
      const aStarts = a.Callsign.toLowerCase().startsWith(trimmed) ? 0 : 1;
      const bStarts = b.Callsign.toLowerCase().startsWith(trimmed) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.Callsign.localeCompare(b.Callsign);
    })
    .slice(0, limit);
}
