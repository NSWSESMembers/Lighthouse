import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings, soundFile, THEME_KEY, SOUND_KEY } from './settings.js';

function memoryStorage(init = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe('loadSettings', () => {
  it('defaults to following the computer, no sound', () => {
    expect(loadSettings(memoryStorage())).toEqual({ theme: 'auto', sound: 'None' });
  });

  it('maps the old page\'s themes', () => {
    expect(loadSettings(memoryStorage({ [THEME_KEY]: 'boo' })).theme).toBe('light');
    expect(loadSettings(memoryStorage({ [THEME_KEY]: 'wob' })).theme).toBe('dark');
    expect(loadSettings(memoryStorage({ [THEME_KEY]: 'night' })).theme).toBe('dark');
  });

  it('keeps a sound picked on the old page', () => {
    expect(loadSettings(memoryStorage({ [SOUND_KEY]: 'Chime' })).sound).toBe('Chime');
    expect(loadSettings(memoryStorage({ [SOUND_KEY]: 'Klaxon' })).sound).toBe('None');
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadSettings(broken)).toEqual({ theme: 'auto', sound: 'None' });
    expect(() => saveSettings(broken, { theme: 'dark', sound: 'Ding' })).not.toThrow();
  });
});

describe('saveSettings', () => {
  it('round-trips', () => {
    const s = memoryStorage();
    saveSettings(s, { theme: 'dark', sound: 'Ding' });
    expect(loadSettings(s)).toEqual({ theme: 'dark', sound: 'Ding' });
  });
});

describe('soundFile', () => {
  it('finds the file, or none', () => {
    expect(soundFile('Chime')).toBe('sounds/chime.mp3');
    expect(soundFile('None')).toBe('');
    expect(soundFile('nope')).toBe('');
  });
});
