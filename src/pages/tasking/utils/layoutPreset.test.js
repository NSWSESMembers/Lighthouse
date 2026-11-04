import { describe, it, expect } from 'vitest';
import { splitLayoutPreset, joinLayoutPreset, defaultLayoutPreset, LAYOUT_LISTS } from './layoutPreset.js';

describe('splitLayoutPreset / joinLayoutPreset', () => {
    it('round-trips every preset', () => {
        const presets = ['map-only', ...['right', 'left'].flatMap((side) => LAYOUT_LISTS.map((l) => `map-${side}-${l}`))];
        expect(presets).toHaveLength(11);
        for (const p of presets) {
            const { side, lists } = splitLayoutPreset(p);
            expect(joinLayoutPreset(side, lists)).toBe(p);
        }
    });

    it('splits map-only as no lists and no side', () => {
        expect(splitLayoutPreset('map-only')).toEqual({ side: null, lists: 'none' });
    });

    it('falls back to the default layout for unknown input', () => {
        expect(splitLayoutPreset('nonsense')).toEqual({ side: 'right', lists: 'teams-top' });
        expect(splitLayoutPreset(undefined)).toEqual({ side: 'right', lists: 'teams-top' });
        expect(joinLayoutPreset('up', 'sideways')).toBe('map-right-teams-top');
    });

    it('ignores the side when there are no lists', () => {
        expect(joinLayoutPreset('left', 'none')).toBe('map-only');
    });

    it('defaults to tabbed on a touch-first device, stacked otherwise', () => {
        const mm = (coarse) => (q) => ({ matches: q === '(pointer: coarse)' && coarse });
        expect(defaultLayoutPreset(mm(true))).toBe('map-right-tabbed');
        expect(defaultLayoutPreset(mm(false))).toBe('map-right-teams-top');
        expect(defaultLayoutPreset(undefined)).toBe('map-right-teams-top');
    });
});
