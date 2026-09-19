import { describe, it, expect } from 'vitest';
import { DEFAULT_QUICK_MESSAGES, normaliseQuickMessages, loadQuickMessages, saveQuickMessages, mergeQuickMessageText, QUICK_MESSAGES_STORAGE_KEY } from './quickMessages.js';

const store = (initial) => {
  const data = initial === undefined ? {} : { [QUICK_MESSAGES_STORAGE_KEY]: initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, data };
};

describe('normaliseQuickMessages', () => {
  it('keeps entries with a label and text, trims, coerces flags, and only keeps a reminder alongside Action Required', () => {
    const out = normaliseQuickMessages([
      { label: ' Help ', text: ' Need help. ', important: 1, actionRequired: true, reminder: '60' },
      { label: 'No action', text: 'x', reminder: '30' },
      { label: 'Bad reminder', text: 'y', actionRequired: true, reminder: '999' },
      { label: '', text: 'no label' },
      { label: 'no text' },
      null,
    ]);
    expect(out).toEqual([
      { label: 'Help', text: 'Need help.', important: true, actionRequired: true, reminder: '60' },
      { label: 'No action', text: 'x', important: false, actionRequired: false, reminder: 'none' },
      { label: 'Bad reminder', text: 'y', important: false, actionRequired: true, reminder: 'none' },
    ]);
  });
  it('is empty for anything that is not a list', () => {
    expect(normaliseQuickMessages('nope')).toEqual([]);
    expect(normaliseQuickMessages(null)).toEqual([]);
  });
});

describe('load/save', () => {
  it('starts with the defaults, then returns what was saved (even an empty list)', () => {
    expect(loadQuickMessages(store()).map((m) => m.label)).toEqual(DEFAULT_QUICK_MESSAGES.map((m) => m.label));
    const s = store();
    saveQuickMessages(s, [{ label: 'A', text: 'a', important: false, actionRequired: false, reminder: 'none' }]);
    expect(loadQuickMessages(s).map((m) => m.label)).toEqual(['A']);
    expect(loadQuickMessages(store('[]'))).toEqual([]);
  });
  it('falls back to defaults when storage is unreadable or corrupt', () => {
    expect(loadQuickMessages(null)).toHaveLength(DEFAULT_QUICK_MESSAGES.length);
    expect(loadQuickMessages(store('{not json'))).toHaveLength(DEFAULT_QUICK_MESSAGES.length);
    expect(() => saveQuickMessages(null, [])).not.toThrow();
  });
  it('ships defaults that are all valid', () => {
    expect(normaliseQuickMessages(DEFAULT_QUICK_MESSAGES)).toHaveLength(DEFAULT_QUICK_MESSAGES.length);
  });
});

describe('mergeQuickMessageText', () => {
  it('replaces an empty box, follows typed text, and does not add the same text twice', () => {
    expect(mergeQuickMessageText('', 'On scene.')).toBe('On scene.');
    expect(mergeQuickMessageText('   ', 'On scene.')).toBe('On scene.');
    expect(mergeQuickMessageText('TAB56 reports', 'On scene.')).toBe('TAB56 reports On scene.');
    expect(mergeQuickMessageText('On scene. Two patients.', 'On scene.')).toBe('On scene. Two patients.');
  });
});
