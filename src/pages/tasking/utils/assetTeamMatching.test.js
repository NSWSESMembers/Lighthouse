import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import {
    normAssetName, splitTeamCallsignIntoParts, tokenVariantsFromPart,
    extractTeamTokens, scoreFuzzy, computeMatchedAssetsForTeam,
    teamHqId, assetIsForTeamHq, setTeamAssets, unlinkTeam, unlinkAsset, isAssetUnmatched,
} from './assetTeamMatching.js';

describe('normAssetName', () => {
    it('lowercases and strips non-alphanumeric characters', () => {
        expect(normAssetName('SES-47 T')).toBe('ses47t');
    });

    it('returns "" for null/undefined', () => {
        expect(normAssetName(null)).toBe('');
        expect(normAssetName(undefined)).toBe('');
    });
});

describe('splitTeamCallsignIntoParts', () => {
    it('splits on "+", "&", "/", ",", ";"', () => {
        expect(splitTeamCallsignIntoParts('PAR56 + PAR18')).toEqual(['PAR56', 'PAR18']);
        expect(splitTeamCallsignIntoParts('PAR56/PAR18')).toEqual(['PAR56', 'PAR18']);
    });

    it('splits on "and"/"with" as whole words, case-insensitively', () => {
        expect(splitTeamCallsignIntoParts('PAR56 and PAR18')).toEqual(['PAR56', 'PAR18']);
        expect(splitTeamCallsignIntoParts('PAR56 WITH PAR18')).toEqual(['PAR56', 'PAR18']);
    });

    it('strips the word "team"', () => {
        expect(splitTeamCallsignIntoParts('PAR56 Team')).toEqual(['PAR56']);
    });

    it('does not split "and"/"with" as substrings of another word', () => {
        // "Andover56" should not be split just because it contains "and"
        expect(splitTeamCallsignIntoParts('Andover56')).toEqual(['Andover56']);
    });
});

describe('tokenVariantsFromPart', () => {
    it('always includes the normalised raw token', () => {
        expect(tokenVariantsFromPart('PAR56')).toContain('par56');
    });

    it('drops a trailing word after <letters><digits>', () => {
        expect(tokenVariantsFromPart('par56truck')).toContain('par56');
    });

    it('keeps a trailing single letter as part of the core token', () => {
        const variants = tokenVariantsFromPart('ses47talpha');
        expect(variants).toContain('ses47t');
    });

    it('returns [] for an empty part', () => {
        expect(tokenVariantsFromPart('')).toEqual([]);
    });
});

describe('extractTeamTokens', () => {
    it('extracts a single callsign token', () => {
        expect(extractTeamTokens({ callsign: () => 'PAR56' })).toEqual(['par56']);
    });

    it('extracts multiple tokens from a combined callsign', () => {
        expect(extractTeamTokens({ callsign: () => 'PAR18 PAR911' })).toEqual(['par18', 'par911']);
    });

    it('handles a space between letters and digits', () => {
        expect(extractTeamTokens({ callsign: () => 'PAR 56 Team' })).toEqual(['par56']);
    });

    it('handles a trailing letter suffix', () => {
        expect(extractTeamTokens({ callsign: () => 'SES47T' })).toEqual(['ses47t']);
    });

    it('returns [] for a callsign with no letters+digits pattern (falls through to the empty fallback)', () => {
        expect(extractTeamTokens({ callsign: () => '!!!' })).toEqual([]);
    });

    it('returns [] when there is no callsign', () => {
        expect(extractTeamTokens({ callsign: () => '' })).toEqual([]);
        expect(extractTeamTokens({})).toEqual([]);
    });

    it('does NOT deduplicate repeated tokens in the primary regex path (known quirk)', () => {
        // `seen` is populated in this loop but never checked before pushing --
        // only the *fallback* branch (unreachable once the primary regex finds
        // any token) actually gates on it. Harmless downstream: computeMatchedAssetsForTeam's
        // "already matched" guards mean a duplicate token is just wasted work,
        // not a wrong match. Preserving current behaviour here since this is a
        // pure relocation, not a behaviour change -- see conversation notes.
        expect(extractTeamTokens({ callsign: () => 'PAR56 PAR56' })).toEqual(['par56', 'par56']);
    });
});

describe('scoreFuzzy', () => {
    it('scores an asset name that starts with the token best (1)', () => {
        expect(scoreFuzzy('par5', 'par56')).toBe(1);
    });

    it('scores an asset name that includes the token second-best (2)', () => {
        expect(scoreFuzzy('r56', 'par56')).toBe(2);
    });

    it('scores a token that includes the asset name third (3)', () => {
        expect(scoreFuzzy('par56truck', 'par56')).toBe(3);
    });

    it('scores no relationship at all as 99 (no match)', () => {
        expect(scoreFuzzy('ses47', 'par56')).toBe(99);
    });
});

describe('computeMatchedAssetsForTeam', () => {
    function asset(id, name, resourceType = 'Vehicle') {
        return { id: () => id, name: () => name, resourceType };
    }

    it('returns an empty set when the team has no extractable tokens', () => {
        expect(computeMatchedAssetsForTeam({ callsign: () => '' }, [asset('a1', 'PAR56')])).toEqual(new Set());
    });

    it('matches an asset by exact name', () => {
        const a = asset('a1', 'PAR56');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, [a]);
        expect(matched).toEqual(new Set([a]));
    });

    it('falls back to fuzzy matching when there is no exact match', () => {
        const a = asset('a1', 'PAR56T'); // team callsign token "par56" doesn't exactly match "par56t"
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, [a]);
        expect(matched).toEqual(new Set([a]));
    });

    it('prefers an exact match over a fuzzy one when both exist', () => {
        const exact = asset('a1', 'PAR56');
        const fuzzy = asset('a2', 'PAR56T');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, [exact, fuzzy]);
        expect(matched).toEqual(new Set([exact]));
        expect(matched.has(fuzzy)).toBe(false);
    });

    it('prefers a non-Portable asset over a Portable one on an exact-name tie', () => {
        const portable = asset('a1', 'PAR56', 'Portable');
        const vehicle = asset('a2', 'PAR56', 'Vehicle');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, [portable, vehicle]);
        expect(matched).toEqual(new Set([vehicle]));
    });

    it('matches each token to a distinct asset for a multi-team callsign', () => {
        const a1 = asset('a1', 'PAR18');
        const a2 = asset('a2', 'PAR911');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR18 PAR911' }, [a1, a2]);
        expect(matched).toEqual(new Set([a1, a2]));
    });

    it('does not match the same asset to two different tokens', () => {
        const a = asset('a1', 'PAR56');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56 PAR56T' }, [a]);
        expect(matched.size).toBe(1);
        expect(matched.has(a)).toBe(true);
    });

    it('does not match an asset with no usable name', () => {
        const noName = asset('a1', '');
        const matched = computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, [noName]);
        expect(matched).toEqual(new Set());
    });

    it('treats a null/undefined allAssets as no assets', () => {
        expect(computeMatchedAssetsForTeam({ callsign: () => 'PAR56' }, null)).toEqual(new Set());
    });

    it("keeps an exercise copy's asset to teams assigned to that copy's HQ", () => {
        const sim = { ...asset('cadence-1', 'PAR56'), exerciseHqId: ko.observable('150') };
        const atHq = (id) => ({ callsign: () => 'PAR56', assignedTo: ko.observable({ id: ko.observable(id) }) });
        expect(computeMatchedAssetsForTeam(atHq(150), [sim])).toEqual(new Set([sim]));
        expect(computeMatchedAssetsForTeam(atHq(151), [sim])).toEqual(new Set());
        // A fuzzy match is held to the same rule.
        expect(computeMatchedAssetsForTeam({ ...atHq(150), callsign: () => 'PAR5' }, [sim])).toEqual(new Set([sim]));
        expect(computeMatchedAssetsForTeam({ ...atHq(151), callsign: () => 'PAR5' }, [sim])).toEqual(new Set());
    });
});

describe('teamHqId', () => {
    it("reads the id of the team's assigned HQ as a string", () => {
        expect(teamHqId({ assignedTo: ko.observable({ id: ko.observable(150) }) })).toBe('150');
        expect(teamHqId({ assignedTo: { id: '151' } })).toBe('151');
    });

    it('is empty when the HQ is unknown', () => {
        expect(teamHqId({})).toBe('');
        expect(teamHqId(null)).toBe('');
        expect(teamHqId({ assignedTo: ko.observable({ id: ko.observable(null) }) })).toBe('');
    });
});

describe('assetIsForTeamHq', () => {
    it('lets any team have an asset that belongs to no exercise HQ', () => {
        expect(assetIsForTeamHq({ exerciseHqId: ko.observable(null) }, '150')).toBe(true);
        expect(assetIsForTeamHq({}, '')).toBe(true);
    });

    it("keeps an exercise copy's asset to its own HQ", () => {
        const sim = { exerciseHqId: ko.observable('150') };
        expect(assetIsForTeamHq(sim, '150')).toBe(true);
        expect(assetIsForTeamHq(sim, '151')).toBe(false);
        expect(assetIsForTeamHq(sim, '')).toBe(false);
    });
});

// Teams and assets carry their links in observable arrays, as in LAD.
function linkedAsset(name) {
    return { name: () => name, matchingTeams: ko.observableArray() };
}
function linkedTeam(callsign) {
    return { callsign: () => callsign, trackableAssets: ko.observableArray() };
}

describe('setTeamAssets', () => {
    it("adds the assets to the team and the team to each asset", () => {
        const team = linkedTeam('PAR33');
        const a = linkedAsset('PAR33');
        setTeamAssets(team, new Set([a]));
        expect(team.trackableAssets()).toEqual([a]);
        expect(a.matchingTeams()).toEqual([team]);
    });

    it('removes assets no longer wanted from both sides', () => {
        const team = linkedTeam('PAR33');
        const keep = linkedAsset('PAR33');
        const drop = linkedAsset('PAR56');
        setTeamAssets(team, new Set([keep, drop]));
        setTeamAssets(team, new Set([keep]));
        expect(team.trackableAssets()).toEqual([keep]);
        expect(drop.matchingTeams()).toEqual([]);
        expect(keep.matchingTeams()).toEqual([team]);
    });

    it('does not link an asset twice', () => {
        const team = linkedTeam('PAR33');
        const a = linkedAsset('PAR33');
        setTeamAssets(team, new Set([a]));
        setTeamAssets(team, new Set([a]));
        expect(team.trackableAssets()).toHaveLength(1);
        expect(a.matchingTeams()).toHaveLength(1);
    });

    it("leaves the asset's links to other teams alone", () => {
        const team = linkedTeam('PAR33');
        const other = linkedTeam('PAR33 + PAR56');
        const a = linkedAsset('PAR33');
        setTeamAssets(team, new Set([a]));
        setTeamAssets(other, new Set([a]));
        setTeamAssets(team, new Set());
        expect(a.matchingTeams()).toEqual([other]);
    });
});

describe('unlinkTeam', () => {
    it('frees every asset the team held, so they count as unmatched again', () => {
        const team = linkedTeam('PAR33 + PAR56');
        const a = linkedAsset('PAR33');
        const b = linkedAsset('PAR56');
        setTeamAssets(team, new Set([a, b]));
        unlinkTeam(team);
        expect(team.trackableAssets()).toEqual([]);
        expect(a.matchingTeams()).toEqual([]);
        expect(b.matchingTeams()).toEqual([]);
    });
});

describe('isAssetUnmatched', () => {
    it('is unmatched with no teams', () => {
        expect(isAssetUnmatched(linkedAsset('PAR33'), new Set())).toBe(true);
    });

    it('is matched when one of its teams is shown', () => {
        const shown = linkedTeam('PAR33');
        const a = linkedAsset('PAR33');
        setTeamAssets(shown, new Set([a]));
        expect(isAssetUnmatched(a, new Set([shown]))).toBe(false);
    });

    it("is unmatched when its only teams aren't shown (e.g. known only from a tasking)", () => {
        const hidden = linkedTeam('PAR33');
        const a = linkedAsset('PAR33');
        setTeamAssets(hidden, new Set([a]));
        expect(isAssetUnmatched(a, new Set())).toBe(true);
    });

    it('is matched when any one of several teams is shown', () => {
        const hidden = linkedTeam('PAR33');
        const shown = linkedTeam('PAR33 + PAR56');
        const a = linkedAsset('PAR33');
        setTeamAssets(hidden, new Set([a]));
        setTeamAssets(shown, new Set([a]));
        expect(isAssetUnmatched(a, new Set([shown]))).toBe(false);
    });
});

describe('unlinkAsset', () => {
    it('removes the asset from every team it was on, and clears its teams', () => {
        // matchingTeams is a Knockout observable array (a function, not an
        // array), as on a real Asset.
        const t1 = linkedTeam('PAR33');
        const t2 = linkedTeam('PAR33 + PAR56');
        const a = linkedAsset('PAR33');
        const other = linkedAsset('PAR56');
        setTeamAssets(t1, new Set([a]));
        setTeamAssets(t2, new Set([a, other]));
        unlinkAsset(a);
        expect(a.matchingTeams()).toEqual([]);
        expect(t1.trackableAssets()).toEqual([]);
        expect(t2.trackableAssets()).toEqual([other]);
    });

    it('does nothing for an asset with no teams', () => {
        const a = linkedAsset('PAR33');
        unlinkAsset(a);
        expect(a.matchingTeams()).toEqual([]);
    });
});
