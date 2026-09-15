/**
 * searchMatching.js
 *
 * Job search-box matching: the suggestion-pool builder, the autosuggest
 * dropdown's matching/highlighting, and the main table's search-term
 * filter. Extracted from main.js's VM(); all pure given (jobs, term).
 */

/** Escapes regex metacharacters so a raw search token is safe to embed in a RegExp. */
export function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the deduplicated {label, category} pool the autosuggest dropdown
 * matches against.
 * @param {object[]} jobs  Job view-models (typically self.filteredJobsAgainstConfig())
 * @returns {{label: string, category: string}[]}
 */
export function buildJobSuggestionPool(jobs) {
    const seen = new Set();
    const pool = [];
    const add = (val, category) => {
        if (!val) return;
        const v = String(val).trim();
        if (!v || seen.has(v.toLowerCase())) return;
        seen.add(v.toLowerCase());
        pool.push({ label: v, category });
    };

    (jobs || []).forEach(jb => {
        add(jb.identifierTrimmed(), 'Identifier');
        add(jb.id(), 'Identifier');
        add(jb.address.prettyAddress(), 'Address');
        add(jb.lga(), 'LGA');
        add(jb.entityAssignedTo?.code(), 'HQ');
        add(jb.situationOnScene(), 'Situation');
        add(jb.contactFirstName() + ' ' + jb.contactLastName(), 'Contact');
        add(jb.icemsIncidentIdentifier(), 'ICEMS');
    });
    return pool;
}

/**
 * Builds the autosuggest dropdown's contents for the current search-box
 * text. Mirrors main.js's `self.jobSearch.subscribe` callback exactly,
 * including which observables it does/doesn't touch in each branch:
 *  - empty input: `{ suggestions: [], showSuggestions: false }`
 *  - input with no matchable last token (defensive, not normally reachable
 *    once `raw` is non-empty): `{ suggestions: [] }` -- no `showSuggestions`
 *    key, signalling the caller should leave that observable untouched.
 *  - otherwise: `{ suggestions: [...], showSuggestions: true }`.
 *
 * @param {{label: string, category: string}[]} pool
 * @param {string} rawInput  the raw self.jobSearch() value
 * @returns {{suggestions: object[], showSuggestions?: boolean}}
 */
export function buildJobSearchSuggestions(pool, rawInput) {
    const raw = (rawInput || '').toLowerCase().trim();
    if (!raw) {
        return { suggestions: [], showSuggestions: false };
    }

    // Match last token for suggestions (supports multi-word queries)
    const tokens = raw.split(/\s+/);
    const lastToken = tokens[tokens.length - 1];
    if (!lastToken) {
        return { suggestions: [] };
    }

    const rx = (/^\d+$/.test(lastToken) || /[^a-z0-9]/i.test(lastToken))
        ? null // numeric or contains non-alphanumeric (e.g. "14-7570") — use includes
        : new RegExp('\\b' + escapeRegExp(lastToken), 'i');

    // Helper: escape HTML entities so label text is safe for innerHTML
    const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Build a regex that finds the matched portion for bolding
    const highlightRx = rx
        ? new RegExp('(' + escapeRegExp(lastToken) + ')', 'i')
        : new RegExp('(' + escapeRegExp(lastToken) + ')', 'ig');

    const matches = [];
    for (let i = 0; i < pool.length && matches.length < 8; i++) {
        const item = pool[i];
        const hit = rx
            ? rx.test(item.label)
            : item.label.toLowerCase().includes(lastToken);
        if (hit) {
            // Wrap matched portion in <strong>
            const hl = escHtml(item.label).replace(highlightRx, '<strong>$1</strong>');
            matches.push({ label: item.label, highlightedLabel: hl, category: item.category });
        }
    }

    return {
        suggestions: [
            // First item echoes the current search text so the user can click to dismiss
            { label: raw, highlightedLabel: '<i class="fa fa-search me-1"></i>' + escHtml(raw), category: 'Search', isExact: true },
            ...matches,
        ],
        showSuggestions: true,
    };
}

/**
 * Filters jobs to those whose searchable text matches every whitespace-
 * separated token in `rawTerm` (all tokens must match, possibly in
 * different fields).
 * @param {object[]} jobs
 * @param {string} rawTerm  typically self.jobSearch()
 * @returns {object[]}
 */
export function filterJobsBySearchTerm(jobs, rawTerm) {
    const term = (rawTerm || '').toLowerCase().trim();
    const terms = term ? term.split(/\s+/) : [];

    if (terms.length === 0) return jobs || [];

    // Pre-build word-boundary regexes once per search change.
    // Each token is matched at the START of a word (\b prefix) so
    // "tree" matches "tree", "trees", "tree-down" but NOT "street".
    // Tokens that look like plain numbers (e.g. job IDs) stay as
    // simple includes() since word boundaries around digits can be
    // surprising (e.g. "123" inside "J-00123" should still match).
    const termMatchers = terms.map(t => {
        if (/^\d+$/.test(t) || /[^a-z0-9]/i.test(t)) {
            // Numeric token or token containing non-alphanumeric chars (e.g. "14-7570")
            // — plain substring is more intuitive and avoids \b boundary failures
            return (blob) => blob.includes(t);
        }
        const rx = new RegExp('\\b' + escapeRegExp(t), 'i');
        return (blob) => rx.test(blob);
    });

    return (jobs || []).filter(jb => {
        // Build a searchable blob once per job (avoids repeated toLowerCase calls per term)
        const parts = [
            jb.identifier(),
            jb.id()?.toString(),
            jb.situationOnScene(),
            jb.address.prettyAddress(),
            jb.tagsCsv(),
            jb.lga(),
            jb.contactFirstName(),
            jb.contactLastName(),
            jb.callerFirstName(),
            jb.callerLastName(),
            jb.incidentContactNumber(),
            jb.entityAssignedTo?.code(),
            jb.icemsIncidentIdentifier(),
        ];
        const blob = parts.filter(Boolean).join(' ').toLowerCase();

        return termMatchers.every(match => match(blob));
    });
}
