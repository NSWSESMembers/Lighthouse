/*
  Pure substring/ranked matcher for the HQ/unit scope field's entity
  suggestions (BeaconClient/entities.js#search results, shaped
  {Id, Name, Code?, ...}). Same ranking idea as callsignSuggestions.js:
  prefix matches before mid-string matches, alphabetical within each group.

  Matches on Name, Code (short code, e.g. "HLS"), or an exact Id -- but
  entities.js#search only searches Beacon by name server-side (there's no
  known code/id search param), so this can only recognise a code/id match
  among whatever a name query happened to return; it can't find "HLS" from
  a query of "HLS" if Beacon's own name search didn't return that entity.
  The caller's exact-match fallback (RadioConsoleViewModel.js's selectHq,
  via unit.getName) is what actually resolves a full id/code Beacon's name
  search can't reach.
*/

function nameOf(entity) {
  return (entity.Name || '').toLowerCase();
}

function codeOf(entity) {
  return (entity.Code || '').toLowerCase();
}

function idOf(entity) {
  return String(entity.Id ?? '').toLowerCase();
}

/**
 * @param {Array<{Id: string|number, Name: string, Code?: string}>} entities
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{Id: string|number, Name: string, Code?: string}>}
 */
export function rankEntitySuggestions(entities, query, limit = 8) {
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return [];

  return entities
    .filter((entity) => nameOf(entity).includes(trimmed) || codeOf(entity).includes(trimmed) || idOf(entity) === trimmed)
    .sort((a, b) => {
      const aStarts = nameOf(a).startsWith(trimmed) || codeOf(a).startsWith(trimmed) ? 0 : 1;
      const bStarts = nameOf(b).startsWith(trimmed) || codeOf(b).startsWith(trimmed) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return (a.Name || '').localeCompare(b.Name || '');
    })
    .slice(0, limit);
}

/**
 * The "autocorrect" for typed text that doesn't exactly match anything
 * obviously: if there's a search result whose name/code starts with what
 * was typed, or exactly one result at all, use it -- otherwise there's too
 * much ambiguity to guess and the caller should fall back to an exact
 * id/code lookup instead.
 *
 * @param {Array<{Id: string|number, Name: string, Code?: string}>} entities
 * @param {string} query
 * @returns {{Id: string|number, Name: string, Code?: string}|null}
 */
export function bestEntityMatch(entities, query) {
  const ranked = rankEntitySuggestions(entities, query, entities.length || 1);
  if (ranked.length === 0) return null;
  const trimmed = query.trim().toLowerCase();
  const exact = ranked.find((entity) => nameOf(entity) === trimmed || codeOf(entity) === trimmed || idOf(entity) === trimmed);
  if (exact) return exact;
  if (ranked.length === 1) return ranked[0];
  const startsWith = ranked.filter((entity) => nameOf(entity).startsWith(trimmed) || codeOf(entity).startsWith(trimmed));
  return startsWith.length === 1 ? startsWith[0] : null;
}
