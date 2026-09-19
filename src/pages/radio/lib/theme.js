/*
  Pure resolution of the effective light/dark theme from a mode setting +
  the OS/browser preference -- same 'auto'|'light'|'dark' convention as
  tasking/viewmodels/Config.js's own darkModeMode, for consistency.
*/

/**
 * @param {'light'|'dark'|'system'} mode
 * @param {boolean} systemPrefersDark
 * @returns {boolean}  true if dark mode should be applied
 */
export function resolveIsDark(mode, systemPrefersDark) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemPrefersDark; // 'system'
}
