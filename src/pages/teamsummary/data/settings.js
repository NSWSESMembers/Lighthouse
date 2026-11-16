/*
  The Team Filter and Settings dialogs' choices, kept in localStorage. The
  old page forgot them on every reload; its options are kept, with the
  same defaults (everything shown, three teams across).
*/

export const SETTINGS_KEY = 'LighthouseTeamSummarySettings';

export const THEMES = [
  { value: 'auto', label: 'Match my computer' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Teams across the screen (fewer on a narrow window: teamsummary.css). */
export const COLUMN_CHOICES = [2, 3, 4];

/** The parts of a card that can be hidden, with the old Team Filter dialog's labels. */
export const SECTIONS = [
  { value: 'showSummary', id: 'show-summary', label: 'Show team summary:' },
  { value: 'showResources', id: 'show-resources', label: 'Show team resources:' },
  { value: 'showMembers', id: 'show-members', label: 'Show team members:' },
  { value: 'showPosition', id: 'show-position', label: 'Show team location:' },
  { value: 'showMemberChanges', id: 'show-member-changes', label: 'Show team member history:' },
];

export const DEFAULTS = {
  theme: 'auto',
  columns: 3,
  autoShow: true,
  showSummary: true,
  showResources: true,
  showMembers: true,
  showPosition: true,
  showMemberChanges: true,
};

/**
 * @param {Storage} storage
 * @returns {typeof DEFAULTS}
 */
export function loadSettings(storage) {
  let saved = {};
  try {
    saved = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  const out = { ...DEFAULTS };
  if (THEMES.some((t) => t.value === saved.theme)) out.theme = saved.theme;
  if (COLUMN_CHOICES.includes(Number(saved.columns))) out.columns = Number(saved.columns);
  for (const key of ['autoShow', ...SECTIONS.map((s) => s.value)]) {
    if (typeof saved[key] === 'boolean') out[key] = saved[key];
  }
  return out;
}

/** @param {Storage} storage */
export function saveSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private window or blocked storage: the choice lasts until the tab closes.
  }
}
