import { describe, it, expect } from 'vitest';
import {
    isMacPlatform,
    matchesHotkeyEvent,
    isModifierKey,
    hasModifier,
    captureComboFromEvent,
    formatHotkeyCombo,
} from './hotkeyMatch.js';

describe('isMacPlatform', () => {
    it('detects Mac from platform', () => {
        expect(isMacPlatform({ platform: 'MacIntel', userAgent: '' })).toBe(true);
    });

    it('detects Mac from userAgent when platform is missing', () => {
        expect(isMacPlatform({ platform: '', userAgent: 'iPhone' })).toBe(true);
    });

    it('returns false for non-Mac platforms', () => {
        expect(isMacPlatform({ platform: 'Win32', userAgent: 'Windows' })).toBe(false);
    });

    it('returns false when navigator is missing', () => {
        expect(isMacPlatform(null)).toBe(false);
    });
});

describe('matchesHotkeyEvent', () => {
    it('returns false with no event', () => {
        expect(matchesHotkeyEvent(null, null)).toBe(false);
    });

    describe('default combo (null)', () => {
        it('matches Cmd+K', () => {
            expect(matchesHotkeyEvent(null, { key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
        });

        it('matches Ctrl+K', () => {
            expect(matchesHotkeyEvent(null, { key: 'K', metaKey: false, ctrlKey: true })).toBe(true);
        });

        it('is case-insensitive on the key', () => {
            expect(matchesHotkeyEvent(null, { key: 'K', metaKey: true })).toBe(true);
        });

        it('rejects K with no modifier', () => {
            expect(matchesHotkeyEvent(null, { key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
        });

        it('rejects a different key even with a modifier', () => {
            expect(matchesHotkeyEvent(null, { key: 'p', metaKey: true })).toBe(false);
        });
    });

    describe('custom combo', () => {
        const combo = { key: 'p', ctrl: true, meta: false, shift: true, alt: false };

        it('matches when every modifier lines up exactly', () => {
            expect(matchesHotkeyEvent(combo, {
                key: 'P', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false,
            })).toBe(true);
        });

        it('rejects a missing modifier', () => {
            expect(matchesHotkeyEvent(combo, {
                key: 'p', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false,
            })).toBe(false);
        });

        it('rejects an extra modifier', () => {
            expect(matchesHotkeyEvent(combo, {
                key: 'p', ctrlKey: true, metaKey: true, shiftKey: true, altKey: false,
            })).toBe(false);
        });

        it('rejects a different key', () => {
            expect(matchesHotkeyEvent(combo, {
                key: 'q', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false,
            })).toBe(false);
        });
    });
});

describe('isModifierKey', () => {
    it.each(['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'OS'])('flags %s as a modifier', (key) => {
        expect(isModifierKey(key)).toBe(true);
    });

    it('does not flag a regular key', () => {
        expect(isModifierKey('k')).toBe(false);
    });
});

describe('hasModifier', () => {
    it('is false for null', () => {
        expect(hasModifier(null)).toBe(false);
    });

    it('is false when no modifier flags are set', () => {
        expect(hasModifier({ key: 'k', ctrl: false, meta: false, shift: true, alt: false })).toBe(false);
    });

    it('is true when ctrl is set', () => {
        expect(hasModifier({ key: 'k', ctrl: true })).toBe(true);
    });

    it('is true when meta is set', () => {
        expect(hasModifier({ key: 'k', meta: true })).toBe(true);
    });

    it('is true when alt is set', () => {
        expect(hasModifier({ key: 'k', alt: true })).toBe(true);
    });
});

describe('captureComboFromEvent', () => {
    it('lowercases a single-character key', () => {
        const combo = captureComboFromEvent({ key: 'P', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false });
        expect(combo).toEqual({ key: 'p', ctrl: true, meta: false, shift: false, alt: false });
    });

    it('preserves multi-character key names as-is', () => {
        const combo = captureComboFromEvent({ key: 'F5', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
        expect(combo.key).toBe('F5');
    });
});

describe('formatHotkeyCombo', () => {
    it('formats the default combo on Mac', () => {
        expect(formatHotkeyCombo(null, true)).toBe('⌘K');
    });

    it('formats the default combo off Mac', () => {
        expect(formatHotkeyCombo(null, false)).toBe('Ctrl+K');
    });

    it('formats a custom combo on Mac with symbols and no separators', () => {
        const combo = { key: 'p', ctrl: true, meta: true, shift: true, alt: true };
        expect(formatHotkeyCombo(combo, true)).toBe('⌃⌥⇧⌘P');
    });

    it('formats a custom combo off Mac with + separators', () => {
        const combo = { key: 'p', ctrl: true, meta: false, shift: true, alt: false };
        expect(formatHotkeyCombo(combo, false)).toBe('Ctrl+Shift+P');
    });

    it('uppercases a single-character key label', () => {
        expect(formatHotkeyCombo({ key: 'j', ctrl: true }, false)).toBe('Ctrl+J');
    });

    it('leaves a multi-character key label untouched', () => {
        expect(formatHotkeyCombo({ key: 'F5', ctrl: true }, false)).toBe('Ctrl+F5');
    });
});
