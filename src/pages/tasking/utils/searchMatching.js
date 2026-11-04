/**
 * searchMatching.js
 *
 * Job and team search-box matching: the suggestion-pool builders, the
 * autosuggest dropdown's matching/highlighting, and the lists' search-term
 * filters. Extracted from main.js's VM(); all pure given (jobs, term).
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

/** A team's matched assets' names, plates and radio ids (blanks dropped). */
function teamAssetIdentifiers(tm) {
    return (tm.trackableAssets?.() || []).flatMap(a => [
        a.name(),
        a.licensePlate() === '-' ? null : a.licensePlate(),
        a.radioId()?.toString(),
    ]).filter(Boolean);
}

/**
 * Team counterpart of buildJobSuggestionPool: callsigns, member names, then
 * matched assets' names and plates.
 * @param {object[]} teams  Team view-models (typically self.filteredTeamsAgainstConfig())
 * @returns {{label: string, category: string}[]}
 */
export function buildTeamSuggestionPool(teams) {
    const seen = new Set();
    const pool = [];
    // `anywhere`: suggest on a match anywhere in the label, as the filter
    // does for callsigns and asset identifiers, not just at a word start.
    const add = (val, category, anywhere = false) => {
        if (!val) return;
        const v = String(val).trim();
        if (!v || seen.has(v.toLowerCase())) return;
        seen.add(v.toLowerCase());
        pool.push(anywhere ? { label: v, category, anywhere } : { label: v, category });
    };

    (teams || []).forEach(tm => add(tm.callsign(), 'Callsign', true));
    (teams || []).forEach(tm => {
        (tm.members() || []).forEach(m => {
            const p = m.Person || {};
            add([p.FirstName, p.LastName].filter(Boolean).join(' '), 'Member');
        });
    });
    (teams || []).forEach(tm => {
        (tm.trackableAssets?.() || []).forEach(a => {
            add(a.name(), 'Asset', true);
            if (a.licensePlate() !== '-') add(a.licensePlate(), 'Plate', true);
        });
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
 * @param {{label: string, category: string, anywhere?: boolean}[]} pool
 *   `anywhere` items match the last token anywhere, not only at a word start
 * @param {string} rawInput  the raw self.jobSearch() value
 * @returns {{suggestions: object[], showSuggestions?: boolean}}
 */
export function buildSearchSuggestions(pool, rawInput) {
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
        const hit = (rx && !item.anywhere)
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
 * Splits a search-box value into lowercase tokens and builds one matcher per
 * token, each testing a lowercase text blob.
 * @param {string} rawTerm
 * @returns {((blob: string) => boolean)[]}  empty when there's nothing to match
 */
function buildTermMatchers(rawTerm) {
    const term = (rawTerm || '').toLowerCase().trim();
    const terms = term ? term.split(/\s+/) : [];

    // Each token is matched at the START of a word (\b prefix) so
    // "tree" matches "tree", "trees", "tree-down" but NOT "street".
    // Tokens that look like plain numbers (e.g. job IDs) stay as
    // simple includes() since word boundaries around digits can be
    // surprising (e.g. "123" inside "J-00123" should still match).
    return terms.map(t => {
        if (/^\d+$/.test(t) || /[^a-z0-9]/i.test(t)) {
            // Numeric token or token containing non-alphanumeric chars (e.g. "14-7570")
            // — plain substring is more intuitive and avoids \b boundary failures
            return (blob) => blob.includes(t);
        }
        const rx = new RegExp('\\b' + escapeRegExp(t), 'i');
        return (blob) => rx.test(blob);
    });
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
    // Pre-build the matchers once per search change.
    const termMatchers = buildTermMatchers(rawTerm);
    if (termMatchers.length === 0) return jobs || [];

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

/**
 * Filters teams to those matching every whitespace-separated token in
 * `rawTerm`. A token matches when it's anywhere in the callsign or one of
 * the team's matched assets' name, plate or radio id (so partials like
 * "n13" still work), or at the start of a word in a member's name or
 * member number.
 * @param {object[]} teams  Team view-models
 * @param {string} rawTerm  typically self.teamSearch()
 * @returns {object[]}
 */
export function filterTeamsBySearchTerm(teams, rawTerm) {
    const term = (rawTerm || '').toLowerCase().trim();
    const terms = term ? term.split(/\s+/) : [];
    const termMatchers = buildTermMatchers(rawTerm);
    if (termMatchers.length === 0) return teams || [];

    return (teams || []).filter(tm => {
        const ids = [tm.callsign(), ...teamAssetIdentifiers(tm)].filter(Boolean).join(' ').toLowerCase();
        const memberBlob = (tm.members() || [])
            .flatMap(m => [m.Person?.FirstName, m.Person?.LastName, m.Person?.RegistrationNumber])
            .filter(Boolean).join(' ').toLowerCase();

        return termMatchers.every((match, i) => ids.includes(terms[i]) || match(memberBlob));
    });
}
