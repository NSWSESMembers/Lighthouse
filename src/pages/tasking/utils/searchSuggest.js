/**
 * searchSuggest.js
 *
 * The autosuggest dropdown behind the toolbar search boxes (incidents and
 * teams): suggestions for the last typed token, arrow-key/Enter/Escape
 * navigation, and the fixed-position list beneath the input. What's
 * suggested comes from the caller's pool; see utils/searchMatching.js.
 */

import { buildSearchSuggestions } from './searchMatching.js';

/**
 * @param {object} ko
 * @param {object} opts
 * @param {Function} opts.search   the box's text observable
 * @param {Function} opts.pool     observable/computed of {label, category}[]
 * @param {string}   opts.inputId  id of the <input>; the list is the
 *                                 `.search-suggestions` in the same `.toolbar-search`
 */
export function createSearchSuggest(ko, { search, pool, inputId }) {
    const suggestions = ko.observableArray([]);
    const activeIndex = ko.observable(-1);
    const showSuggestions = ko.observable(false);
    const focusInput = () => document.getElementById(inputId)?.focus();
    // Text just set by pick(). The page defers KO updates, so the subscriber
    // below runs after pick() has closed the list and would reopen it.
    let picked = null;

    // React to typing — produce up to 8 suggestions
    search.subscribe(val => {
        const result = buildSearchSuggestions(pool(), val);
        suggestions(result.suggestions);
        if (val === picked) {
            picked = null;
            return;
        }
        picked = null;
        if (result.showSuggestions === false) {
            showSuggestions(false);
            return;
        }
        if (!('showSuggestions' in result)) return; // no matchable last token -- leave showSuggestions/activeIndex untouched
        activeIndex(-1);
        showSuggestions(true);
    });

    const clear = () => { search(''); suggestions([]); };

    // Pick a suggestion — replace the last token with the selected label
    const pick = function (suggestion) {
        if (suggestion.isExact) {
            // "Search" row — just dismiss the dropdown, keep current text
            showSuggestions(false);
            focusInput();
            return;
        }
        const tokens = search().trim().split(/\s+/);
        tokens[tokens.length - 1] = suggestion.label;
        picked = tokens.join(' ');
        search(picked);
        showSuggestions(false);
        focusInput();
    };

    // Keyboard navigation for suggestions
    const keyDown = function (_, e) {
        const list = suggestions();
        if (!list.length || !showSuggestions()) return true;

        if (e.key === 'ArrowDown') {
            activeIndex(Math.min(activeIndex() + 1, list.length - 1));
            e.preventDefault();
            return false;
        }
        if (e.key === 'ArrowUp') {
            activeIndex(Math.max(activeIndex() - 1, -1));
            e.preventDefault();
            return false;
        }
        if (e.key === 'Enter' && activeIndex() >= 0) {
            pick(list[activeIndex()]);
            e.preventDefault();
            return false;
        }
        if (e.key === 'Escape') {
            showSuggestions(false);
            return false;
        }
        return true;
    };

    // Position the fixed dropdown beneath the search input
    const position = function () {
        const input = document.getElementById(inputId);
        const list = input?.closest('.toolbar-search')?.querySelector('.search-suggestions');
        if (!input || !list) return;
        const rect = input.closest('.input-group')?.getBoundingClientRect() || input.getBoundingClientRect();
        list.style.top = rect.bottom + 'px';
        list.style.left = rect.left + 'px';
        list.style.width = rect.width + 'px';
    };

    // Reposition whenever suggestions are shown
    showSuggestions.subscribe(v => {
        if (v) requestAnimationFrame(position);
    });

    // Close suggestions on blur (with slight delay for click to register)
    const blur = function () {
        setTimeout(() => showSuggestions(false), 200);
    };

    const focus = function () {
        if (suggestions().length > 0) showSuggestions(true);
    };

    return { suggestions, activeIndex, showSuggestions, clear, pick, keyDown, blur, focus };
}
