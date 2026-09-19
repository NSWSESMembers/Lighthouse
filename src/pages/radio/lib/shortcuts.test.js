import { describe, it, expect } from 'vitest';
import { BASE_SHORTCUTS, quickMessageShortcuts, matchShortcut, isHelpKey, isTypingTarget } from './shortcuts.js';

const key = (code, mods = {}) => ({ code, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

describe('matchShortcut', () => {
  it('matches Alt + the physical key, whatever character it types', () => {
    expect(matchShortcut(key('KeyC', { altKey: true }), BASE_SHORTCUTS)?.id).toBe('focus-callsign');
    expect(matchShortcut(key('KeyM', { altKey: true }), BASE_SHORTCUTS)?.id).toBe('focus-message');
  });
  it('Alt+R resets the New Radio Log', () => {
    expect(matchShortcut({ code: 'KeyR', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }, BASE_SHORTCUTS)?.id).toBe('reset-form');
  });

  it('Alt+N jumps to the New Radio Log', () => {
    expect(matchShortcut(key('KeyN', { altKey: true }), BASE_SHORTCUTS)?.id).toBe('focus-new-log');
  });
  it('needs Alt, and ignores combinations with Ctrl / Cmd / Shift', () => {
    expect(matchShortcut(key('KeyC'), BASE_SHORTCUTS)).toBeNull();
    expect(matchShortcut(key('KeyC', { altKey: true, ctrlKey: true }), BASE_SHORTCUTS)).toBeNull();
    expect(matchShortcut(key('KeyC', { altKey: true, metaKey: true }), BASE_SHORTCUTS)).toBeNull();
    expect(matchShortcut(key('KeyC', { altKey: true, shiftKey: true }), BASE_SHORTCUTS)).toBeNull();
  });
  it('returns null for an unassigned key', () => {
    expect(matchShortcut(key('KeyZ', { altKey: true }), BASE_SHORTCUTS)).toBeNull();
  });
  it('has no two shortcuts on the same key', () => {
    const codes = BASE_SHORTCUTS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('quickMessageShortcuts', () => {
  it('numbers the first nine quick messages Alt+1..9', () => {
    const list = quickMessageShortcuts(Array.from({ length: 12 }, (_, i) => ({ label: `Q${i + 1}` })));
    expect(list).toHaveLength(9);
    expect(list[0]).toMatchObject({ id: 'quick-1', code: 'Digit1', keys: 'Alt+1', label: 'Quick message: Q1' });
    expect(matchShortcut(key('Digit3', { altKey: true }), list)?.id).toBe('quick-3');
  });
  it('is empty with no quick messages', () => {
    expect(quickMessageShortcuts([])).toEqual([]);
  });
});

describe('isHelpKey / isTypingTarget', () => {
  it('recognises ? and not other slashes', () => {
    expect(isHelpKey(key('Slash', { shiftKey: true }))).toBe(true);
    expect(isHelpKey(key('Slash'))).toBe(false);
    expect(isHelpKey(key('Slash', { shiftKey: true, ctrlKey: true }))).toBe(false);
  });
  it('treats inputs, textareas, selects and editable content as typing', () => {
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('browser-reserved keys', () => {
  it('avoids Alt+F / Alt+E / Alt+D, which Chrome and Edge keep for their own menu and address bar on Windows/Linux', () => {
    const codes = BASE_SHORTCUTS.map((s) => s.code);
    ['KeyF', 'KeyE', 'KeyD'].forEach((reserved) => expect(codes).not.toContain(reserved));
  });
});
