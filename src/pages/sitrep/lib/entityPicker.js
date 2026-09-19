/*
  A single-select HQ/unit picker: type-ahead search against Beacon's entity
  search, keyboard nav (Arrow/Enter/Escape), and a "resolve the typed text
  as an exact id/code" fallback when nothing in the suggestion list matches
  -- the same shape the HQ/unit scope field originally had written inline
  (RadioConsoleViewModel.js's old selectHq/onUnitIdInputKeydown), pulled out
  so a second field (the entry/logging HQ) can reuse it instead of
  duplicating another near-identical keydown handler.
*/

import { rankEntitySuggestions, bestEntityMatch } from './entitySuggestions.js';

/**
 * @param {object} deps
 * @param {typeof import('knockout')} deps.ko
 * @param {(fn: Function, ms: number) => Function} deps.debounce
 * @param {(query: string, ctx: object) => Promise<{results: object[]}>} deps.searchEntities  entities.search
 * @param {(idOrCode: string|number, ctx: object) => Promise<{Id, Name, Code}>} deps.resolveEntity  unit.getName
 * @param {() => Promise<object>} deps.ctx  resolves the Beacon request context
 * @param {string|number|null} [deps.initialId]
 * @param {string} [deps.initialName]
 * @param {(id: string|number|null, name: string, entity?: object) => void} [deps.onChange]  fired whenever the selection changes (set or cleared), e.g. to persist it; `entity` is the raw Beacon record when one was picked/resolved
 * @param {string} [deps.notFoundHint]  appended to the "could not find" error, e.g. pointing at where the id/code came from
 */
export function createEntityPicker({
  ko,
  debounce,
  searchEntities,
  resolveEntity,
  ctx,
  initialId = null,
  initialName = '',
  onChange,
  notFoundHint = '',
}) {
  const picker = {};
  picker.id = ko.observable(initialId);
  picker.name = ko.observable(initialName);
  picker.input = ko.observable('');
  picker.loadError = ko.observable('');
  picker.suggestions = ko.observableArray();
  picker.suggestionIndex = ko.observable(-1);
  // Set on any explicit dismissal (blur, Escape, a pick) and cleared the
  // moment typing resumes -- guards a debounced search response that
  // resolves *after* the field was already dismissed from silently
  // reopening the dropdown (e.g. tabbing away mid-search).
  picker.suggestionsDismissed = ko.observable(false);

  function set(id, name, entity) {
    picker.id(id);
    picker.name(name);
    onChange?.(id, name, entity);
  }

  picker.clear = () => set(null, '');

  // Selects by whatever's typed: an exact/unambiguous name match from the
  // live suggestions is preferred ("autocorrect" for a partial or
  // slightly-off name); a chosen suggestion always wins; failing both, the
  // text is tried as a literal entity id/code via resolveEntity. Always
  // replaces any existing selection -- this is a 1:1 choice, not an add.
  picker.select = async function () {
    const typed = picker.input().trim();
    if (!typed) return;

    const chosen =
      picker.suggestionIndex() >= 0 ? picker.suggestions()[picker.suggestionIndex()] : bestEntityMatch(picker.suggestions(), typed);

    picker.input('');
    picker.suggestions([]);
    picker.suggestionIndex(-1);
    picker.suggestionsDismissed(true);
    picker.loadError('');

    if (chosen) {
      set(chosen.Id, chosen.Name, chosen);
      return;
    }

    try {
      // The selection stored/persisted must always be the real numeric Id
      // from the response, never the typed text -- storing raw typed text
      // here is what caused EntityIds[0]=hls to be sent straight to a
      // Beacon search and rejected as a 400 (see git history).
      const resolved = await resolveEntity(typed, await ctx());
      if (!resolved || !resolved.Id) throw new Error('not found');
      set(resolved.Id, resolved.Name || resolved.Code || `HQ ${resolved.Id}`, resolved);
    } catch (err) {
      picker.loadError(`Couldn't find a unit matching "${typed}". Try a shorter name or its short code.${notFoundHint}`);
      console.error('Entity picker: unit lookup failed', err);
    }
  };

  let searchSeq = 0;
  const runSearch = debounce(async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      picker.suggestions([]);
      return;
    }
    const mySeq = ++searchSeq;
    try {
      const result = await searchEntities(trimmed, await ctx());
      if (mySeq !== searchSeq) return; // a newer keystroke's search already landed -- drop this stale response
      if (picker.suggestionsDismissed()) return; // dismissed (blur/Escape/pick) while this was in flight
      picker.suggestions(rankEntitySuggestions(result.results, query));
    } catch (err) {
      if (mySeq !== searchSeq) return;
      console.error('Entity picker: search failed', err);
      picker.suggestions([]);
    }
  }, 250);

  picker.onInput = function () {
    picker.suggestionIndex(-1);
    picker.suggestionsDismissed(false);
    runSearch(picker.input());
  };

  picker.pickSuggestion = function (suggestion) {
    set(suggestion.Id, suggestion.Name, suggestion);
    picker.input('');
    picker.suggestions([]);
    picker.suggestionIndex(-1);
    picker.suggestionsDismissed(true);
  };

  // Delay lets a click on a dropdown item fire (mousedown/click land before
  // blur's handler runs) before the dropdown is hidden -- same shape as
  // LAD/tasking's own Config.js closeDropdown.
  picker.onBlur = function () {
    setTimeout(() => {
      picker.suggestionsDismissed(true);
      picker.suggestions([]);
    }, 150);
  };

  picker.onInputKeydown = function (_data, event) {
    const suggestions = picker.suggestions();
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      picker.suggestionIndex(Math.min(picker.suggestionIndex() + 1, suggestions.length - 1));
      return false;
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      picker.suggestionIndex(Math.max(picker.suggestionIndex() - 1, -1));
      return false;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      picker.select();
      return false;
    }
    if (event.key === 'Escape') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      picker.suggestions([]);
      picker.suggestionIndex(-1);
      picker.suggestionsDismissed(true);
      return false;
    }
    return true;
  };

  return picker;
}
