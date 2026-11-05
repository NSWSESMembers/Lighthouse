import { describe, it, expect } from 'vitest';
import { loadChoices, saveChoices, clearChoices, CHOICES_KEY } from './choices.js';
import { DEFAULT_KEYS } from './fields.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}

describe('choices', () => {
  it('starts with the defaults', () => {
    expect(loadChoices(memoryStorage())).toEqual(DEFAULT_KEYS);
  });

  it('remembers what was ticked, dropping columns that no longer exist', () => {
    const s = memoryStorage();
    saveChoices(s, ['Identifier', 'Tags']);
    expect(loadChoices(s)).toEqual(['Identifier', 'Tags']);
    s.setItem(CHOICES_KEY, JSON.stringify(['Identifier', 'Gone']));
    expect(loadChoices(s)).toEqual(['Identifier']);
  });

  it('keeps an empty choice as empty', () => {
    const s = memoryStorage();
    saveChoices(s, []);
    expect(loadChoices(s)).toEqual([]);
  });

  it('falls back to the defaults for junk or blocked storage', () => {
    expect(loadChoices(memoryStorage({ [CHOICES_KEY]: '{not json' }))).toEqual(DEFAULT_KEYS);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadChoices(blocked)).toEqual(DEFAULT_KEYS);
    expect(() => saveChoices(blocked, ['Identifier'])).not.toThrow();
    expect(() => clearChoices(blocked)).not.toThrow();
  });

  it('clears back to the defaults', () => {
    const s = memoryStorage();
    saveChoices(s, ['Identifier']);
    clearChoices(s);
    expect(loadChoices(s)).toEqual(DEFAULT_KEYS);
  });
});
