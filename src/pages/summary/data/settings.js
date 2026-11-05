/*
  The Settings dialog's choices, kept in localStorage under the old page's
  keys so people keep what they picked.

  The old page had three themes ("wob" white on black, "boo" black on
  orange, "night"); the new one follows the computer's light/dark mode
  unless told otherwise. "boo" was the light one.
*/

export const THEME_KEY = 'LighthouseSummaryTheme';
export const SOUND_KEY = 'LighthouseSummaryNewJobSound';

export const THEMES = [
  { value: 'auto', label: 'Match my computer' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Sound files are in static/pages/sounds/. */
export const SOUNDS = [
  { value: 'None', label: 'None', file: '' },
  { value: 'Chime', label: 'Chime', file: 'sounds/chime.mp3' },
  { value: 'iphone', label: 'Phone', file: 'sounds/iphone.mp3' },
  { value: 'Minion', label: 'Minion', file: 'sounds/minion.mp3' },
  { value: 'Ding', label: 'Ding', file: 'sounds/ding.mp3' },
];

const OLD_THEMES = { boo: 'light', wob: 'dark', night: 'dark' };

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {Storage} storage
 * @returns {{theme: 'auto'|'light'|'dark', sound: string}}
 */
export function loadSettings(storage) {
  const theme = read(storage, THEME_KEY);
  const sound = read(storage, SOUND_KEY);
  return {
    theme: THEMES.some((t) => t.value === theme) ? theme : OLD_THEMES[theme] || 'auto',
    sound: SOUNDS.some((s) => s.value === sound) ? sound : 'None',
  };
}

/** @param {Storage} storage */
export function saveSettings(storage, { theme, sound }) {
  try {
    storage.setItem(THEME_KEY, theme);
    storage.setItem(SOUND_KEY, sound);
  } catch {
    // Private window or blocked storage: the choice lasts until the tab closes.
  }
}

export function soundFile(value) {
  return (SOUNDS.find((s) => s.value === value) || SOUNDS[0]).file;
}
