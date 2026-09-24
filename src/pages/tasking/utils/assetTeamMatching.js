import ko from 'knockout';

/**
 * assetTeamMatching.js
 *
 * Fuzzy-matches trackable radio/telematics assets to teams by callsign.
 * Extracted from main.js's VM() -- these were already pure (no `self`
 * dependency), only closing over each other and the module-level `ko`.
 */

export function normAssetName(v) {
    // asset names are like PAR56 / SES47 / SES47T (no spaces)
    const s = (v == null) ? '' : String(v);
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function splitTeamCallsignIntoParts(v) {
    const s0 = (v == null) ? '' : String(v);

    // Make separators explicit BEFORE stripping spaces
    // e.g. "PAR56 + PAR18" => ["PAR56", "PAR18"]
    // also handle "and"
    const s1 = s0
        .replace(/\bteam\b/ig, ' ')
        .replace(/\s+\+\s+/g, '|')
        .replace(/[+&/,;]+/g, '|')
        .replace(/\s+\band\b\s+/ig, '|')
        .replace(/\s+\bwith\b\s+/ig, '|');

    return s1.split('|').map(p => p.trim()).filter(Boolean);
}

export function tokenVariantsFromPart(part) {
    // produce a small set of candidate tokens from one callsign part
    const raw = normAssetName(part);
    if (!raw) return [];

    const out = new Set();

    // 1) raw as-is (already no spaces / punctuation)
    out.add(raw);

    // 2) if looks like <letters><digits><many letters>, drop the trailing word
    //    e.g. "par56truck" => "par56"
    const mLongSuffix = raw.match(/^([a-z]+[0-9]+)[a-z]{2,}$/);
    if (mLongSuffix) out.add(mLongSuffix[1]);

    // 3) if contains <letters><digits><optional single letter>, keep that prefix too
    //    e.g. "ses47talpha" => "ses47t"
    const mCore = raw.match(/^([a-z]+[0-9]+[a-z]?)$/) || raw.match(/^([a-z]+[0-9]+[a-z]?)/);
    if (mCore && mCore[1]) out.add(mCore[1]);

    // prune empties
    return [...out].map(x => x.trim()).filter(Boolean);
}

export function extractTeamTokens(team) {
    const cs = team?.callsign?.();
    if (!cs) return [];

    const s = String(cs);

    // 1) Primary: extract ALL occurrences of <letters><optional space><digits><optional letter>
    //    Handles: "PAR18 PAR911", "PAR 56 Team", "PAR56 + PAR18", "SES47T"
    const re = /[a-z]{2,6}\s*\d+[a-z]?/ig;
    const seen = new Set();
    const tokens = [];

    for (const m of s.matchAll(re)) {
        const tok = normAssetName(m[0]); // strips spaces/punct => "par56"
        if (!tok) continue;
        seen.add(tok);
        tokens.push(tok);
    }

    // If we found any, we're done (prevents weird whitespace-only splitting issues).
    if (tokens.length) return tokens;

    // 2) Fallback: previous behaviour (kept for edge cases)
    const parts = splitTeamCallsignIntoParts(s);
    for (const p of parts) {
        for (const t of tokenVariantsFromPart(p)) {
            if (!t || seen.has(t)) continue;
            seen.add(t);
            tokens.push(t);
        }
    }
    return tokens;
}

export function scoreFuzzy(token, assetName) {
    // Lower is better.
    // Exact matches are handled before fuzzy, so no 0 here.
    if (assetName.startsWith(token)) return 1;
    if (assetName.includes(token)) return 2;
    if (token.includes(assetName)) return 3;
    return 99;
}

export function computeMatchedAssetsForTeam(team, allAssets) {
    const tokens = extractTeamTokens(team);
    if (!tokens.length) return new Set();

    // Map assetName -> list of assets (usually 1)
    const byName = new Map();
    for (const a of (allAssets || [])) {
        const n = normAssetName(a?.name?.());
        if (!n) continue;
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n).push(a);
    }

    const matchedAssetIds = new Set();
    const matchedAssets = new Set();
    const usedTokens = new Set();

    // 1) EXACT first: token === assetName (one match per token)
    //    If multiple exact matches exist, prefer non-Portable resourceType
    for (const tok of tokens) {
        const exactList = byName.get(tok);
        if (!exactList || !exactList.length) continue;

        // Filter to unmatched candidates
        const candidates = exactList.filter(a => !matchedAssetIds.has(a.id()));
        if (!candidates.length) continue;

        // Sort so that Portable resourceType comes last (least preferable)
        candidates.sort((a, b) => {
            const aPortable = (ko.unwrap(a.resourceType) || '').toLowerCase() === 'portable' ? 1 : 0;
            const bPortable = (ko.unwrap(b.resourceType) || '').toLowerCase() === 'portable' ? 1 : 0;
            return aPortable - bPortable;
        });

        const best = candidates[0];
        matchedAssetIds.add(best.id());
        matchedAssets.add(best);
        usedTokens.add(tok);
    }

    // 2) FUZZY second (token consumed once; asset matched once)
    //    This is what prevents "SES59" matching "SES59T" when "SES59" exists:
    //    the exact pass consumes "ses59" and matches SES59 before fuzzy runs.
    for (const tok of tokens) {
        if (usedTokens.has(tok)) continue;

        let best = null;
        let bestScore = 999;

        for (const [assetName, list] of byName.entries()) {
            const score = scoreFuzzy(tok, assetName);
            if (score >= 99) continue;

            // prefer shortest assetName on ties (reduces suffix grabs like SES59T)
            // and skip assets already matched
            for (const a of list) {
                if (matchedAssetIds.has(a.id())) continue;

                const tieBreaker = best ? (assetName.length - normAssetName(best.name()).length) : 0;
                const better =
                    (score < bestScore) ||
                    (score === bestScore && best && assetName.length < normAssetName(best.name()).length) ||
                    (score === bestScore && !best);

                if (better && tieBreaker <= 0) {
                    best = a;
                    bestScore = score;
                }
            }
        }

        if (best) {
            usedTokens.add(tok);
            matchedAssetIds.add(best.id());
            matchedAssets.add(best);
        }
    }

    return matchedAssets;
}
