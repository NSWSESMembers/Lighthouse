// Layer presets: named sets of map overlays the user can switch on and off
// together, from the Layers drawer's Presets section or (for up to
// MAX_PINNED of them) a button under the Layers button. Kept in their own
// localStorage key, not in the shared tasking config.
//
// A preset is { id, name, icon, keys: string[], pinned: boolean }, where keys
// are Layers drawer overlay keys (e.g. 'online-bomRadar', 'matched-assets').
// Everything here is pure so it can be unit tested without Leaflet.

export const PRESETS_STORAGE_KEY = 'lh-layerPresets';
export const MAX_PINNED = 3;
export const MAX_NAME_LENGTH = 40;

/** Font Awesome 5 solid icons offered for a preset's button. */
export const PRESET_ICONS = [
  'fa-bookmark', 'fa-cloud-sun-rain', 'fa-road', 'fa-draw-polygon', 'fa-water',
  'fa-bolt', 'fa-fire', 'fa-wind', 'fa-car',
  'fa-users', 'fa-home', 'fa-flag', 'fa-star',
];

/** The presets that ship with Lighthouse, all pinned. */
export const DEFAULT_PRESETS = [
  {
    id: 'weather',
    name: 'Weather',
    icon: 'fa-cloud-sun-rain',
    keys: ['online-bomSevereThunderstormCells', 'online-bomRadar'],
    pinned: true,
  },
  {
    id: 'roads',
    name: 'Roads',
    icon: 'fa-road',
    keys: ['online-transport-cameras', 'online-transport-incidents'],
    pinned: true,
  },
  {
    id: 'boundaries',
    name: 'Boundaries',
    icon: 'fa-draw-polygon',
    keys: ['online-sesUnitsZonesHybrid'],
    pinned: true,
  },
];

/** "A, B and C" */
export function listNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const clonePreset = (p) => ({ ...p, keys: [...p.keys] });

/** Clean one stored preset, or null if it is unusable. */
function normalisePreset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const name = cleanName(raw.name);
  if (!id || !name) return null;
  const keys = Array.isArray(raw.keys)
    ? [...new Set(raw.keys.filter((k) => typeof k === 'string' && k))]
    : [];
  return {
    id,
    name,
    icon: PRESET_ICONS.includes(raw.icon) ? raw.icon : PRESET_ICONS[0],
    keys,
    pinned: raw.pinned === true,
  };
}

/** Trim a preset name and cap its length; '' if blank. */
export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * Parse the stored presets. Nothing stored (first run) gives the shipped
 * presets; a stored empty list stays empty (the user deleted them all).
 * At most MAX_PINNED stay pinned, first ones win.
 * @param {string|null} json
 */
export function parsePresets(json) {
  if (json === null || json === undefined) return DEFAULT_PRESETS.map(clonePreset);
  let list;
  try {
    list = JSON.parse(json);
  } catch {
    return DEFAULT_PRESETS.map(clonePreset);
  }
  if (!Array.isArray(list)) return DEFAULT_PRESETS.map(clonePreset);
  const seen = new Set();
  let pinned = 0;
  const out = [];
  for (const raw of list) {
    const p = normalisePreset(raw);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    if (p.pinned && ++pinned > MAX_PINNED) p.pinned = false;
    out.push(p);
  }
  return out;
}

export function serialisePresets(presets) {
  return JSON.stringify(presets.map(({ id, name, icon, keys, pinned }) => ({ id, name, icon, keys, pinned })));
}

/** A new id that no preset in the list uses. */
export function newPresetId(presets, now = Date.now()) {
  const ids = new Set(presets.map((p) => p.id));
  let n = now;
  while (ids.has(`p${n.toString(36)}`)) n++;
  return `p${n.toString(36)}`;
}

/**
 * How much of a preset is on the map.
 * @param {{keys: string[]}} preset
 * @param {(key: string) => boolean|null} isOn - null when the layer no longer exists
 * @returns {{state: 'on'|'partial'|'off'|'empty', on: number, total: number}}
 */
export function presetState(preset, isOn) {
  let on = 0;
  let total = 0;
  for (const key of preset.keys) {
    const v = isOn(key);
    if (v === null || v === undefined) continue;
    total++;
    if (v) on++;
  }
  const state = total === 0 ? 'empty'
    : on === total ? 'on'
      : on === 0 ? 'off' : 'partial';
  return { state, on, total };
}

/**
 * The layer changes a click on a preset makes: all of its layers off when
 * they are all on, otherwise all of them on. Other layers are left alone.
 * @returns {{key: string, on: boolean}[]}
 */
export function presetToggleChanges(preset, isOn) {
  const { state } = presetState(preset, isOn);
  const turnOn = state !== 'on';
  return preset.keys
    .filter((key) => {
      const v = isOn(key);
      return v !== null && v !== undefined && !!v !== turnOn;
    })
    .map((key) => ({ key, on: turnOn }));
}

/**
 * Pin or unpin a preset. Pinning is refused (list returned unchanged) when
 * MAX_PINNED presets are already pinned.
 */
export function setPinned(presets, id, pinned) {
  if (pinned && !presets.find((p) => p.id === id)?.pinned
    && presets.filter((p) => p.pinned).length >= MAX_PINNED) {
    return presets;
  }
  return presets.map((p) => (p.id === id ? { ...p, pinned: !!pinned } : p));
}

/** Shipped presets missing from the list (deleted by the user), by id. */
export function missingDefaults(presets) {
  const ids = new Set(presets.map((p) => p.id));
  return DEFAULT_PRESETS.filter((p) => !ids.has(p.id)).map(clonePreset);
}

/** Whether the list is exactly the shipped presets, as shipped. */
export function isDefaultPresets(presets) {
  return serialisePresets(presets) === serialisePresets(DEFAULT_PRESETS);
}

/** Add the missing shipped presets back, pinned only while a pin is free. */
export function restoreDefaults(presets) {
  let pinned = presets.filter((p) => p.pinned).length;
  const restored = missingDefaults(presets).map((p) => {
    const pin = p.pinned && pinned < MAX_PINNED;
    if (pin) pinned++;
    return { ...p, pinned: pin };
  });
  return [...presets, ...restored];
}
