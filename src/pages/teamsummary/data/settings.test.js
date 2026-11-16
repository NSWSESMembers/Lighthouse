import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings, SETTINGS_KEY, DEFAULTS } from './settings.js';

function memoryStorage(init = {}) {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe('settings', () => {
  it('starts with everything shown, three across', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULTS);
    expect(DEFAULTS).toMatchObject({ theme: 'auto', columns: 3, autoShow: true, showMembers: true });
  });

  it('round-trips what was saved', () => {
    const storage = memoryStorage();
    const chosen = { ...DEFAULTS, theme: 'dark', columns: 4, showMembers: false, autoShow: false };
    saveSettings(storage, chosen);
    expect(loadSettings(storage)).toEqual(chosen);
  });

  it('ignores junk', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: 'not json' }))).toEqual(DEFAULTS);
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ theme: 'neon', columns: 9, showMembers: 'no' }) }))).toEqual(DEFAULTS);
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: 'null' }))).toEqual(DEFAULTS);
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadSettings(broken)).toEqual(DEFAULTS);
    expect(() => saveSettings(broken, DEFAULTS)).not.toThrow();
  });
});
