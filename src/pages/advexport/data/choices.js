/*
  The ticked columns, remembered in localStorage between visits.
*/

import { DEFAULT_KEYS, fieldFor } from './fields.js';

export const CHOICES_KEY = 'lh-advexport-fields';

/**
 * @param {Storage} storage
 * @returns {string[]}  the saved columns (unknown ones dropped), or the defaults
 */
export function loadChoices(storage) {
  try {
    const saved = JSON.parse(storage.getItem(CHOICES_KEY));
    if (Array.isArray(saved)) return saved.filter((k) => fieldFor(k));
  } catch {
    // Nothing saved, unreadable, or storage blocked: the defaults.
  }
  return [...DEFAULT_KEYS];
}

/** @param {Storage} storage */
export function saveChoices(storage, keys) {
  try {
    storage.setItem(CHOICES_KEY, JSON.stringify(keys));
  } catch {
    // Private window or blocked storage: the choice lasts until the tab closes.
  }
}

/** @param {Storage} storage */
export function clearChoices(storage) {
  try {
    storage.removeItem(CHOICES_KEY);
  } catch {
    // as above
  }
}
