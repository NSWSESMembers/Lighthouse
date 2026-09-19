/*
  Experimental-feature switches for the radio console.

  Each optional feature (src/pages/radio/features/*.js) registers itself here
  and gets an on/off observable that is persisted in localStorage, so an
  operator can switch a feature off from Settings -- instantly, no reload --
  if it isn't working out. A feature that is off must be completely inert
  (no listeners acting, nothing shown).
*/

export const FEATURE_FLAGS_STORAGE_KEY = 'lighthouseRadioFeatures';

/**
 * @param {Storage|null|undefined} storage
 * @returns {Record<string, boolean>}  only well-formed entries; {} when nothing stored / unreadable
 */
export function readFeatureFlags(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(FEATURE_FLAGS_STORAGE_KEY));
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'boolean'));
  } catch (err) {
    return {};
  }
}

/**
 * @param {Storage|null|undefined} storage
 * @param {Record<string, boolean>} flags
 */
export function writeFeatureFlags(storage, flags) {
  try {
    storage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(flags));
  } catch (err) {
    // storage unavailable -- the switch still works for this page load, it just isn't remembered
  }
}

/**
 * @param {object} deps
 * @param {typeof import('knockout')} deps.ko
 * @param {Storage|null} [deps.storage]
 */
export function createFeatureRegistry({ ko, storage = null }) {
  const registry = { list: ko.observableArray() };

  /**
   * @param {{key: string, label: string, description?: string, defaultEnabled?: boolean}} meta
   * @returns {import('knockout').Observable<boolean>}  the feature's on/off switch
   */
  registry.register = ({ key, label, description = '', defaultEnabled = true }) => {
    const stored = readFeatureFlags(storage);
    const enabled = ko.observable(key in stored ? stored[key] : defaultEnabled);
    enabled.subscribe((on) => writeFeatureFlags(storage, { ...readFeatureFlags(storage), [key]: on }));
    registry.list.push({ key, label, description, enabled });
    return enabled;
  };

  return registry;
}
