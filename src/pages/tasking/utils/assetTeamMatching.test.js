import { describe, it, expect } from 'vitest';
import {
    normAssetName, splitTeamCallsignIntoParts, tokenVariantsFromPart,
    extractTeamTokens, scoreFuzzy, computeMatchedAssetsForTeam,
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
});
