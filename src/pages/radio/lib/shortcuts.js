/*
  Keyboard shortcuts for the radio console: the table, matching a keydown to
  a shortcut, and the "am I typing in a field" check. Pure -- the actions and
  the help overlay are in features/shortcuts.js.

  Shortcuts use Alt + a key, matched on the physical key (event.code) so Option
  on a Mac (which types a different character) still works.
*/

/** @typedef {{id: string, code: string, keys: string, label: string}} Shortcut */

/** @type {Shortcut[]} */
export const BASE_SHORTCUTS = [
  { id: 'focus-new-log', code: 'KeyN', keys: 'Alt+N', label: 'Jump to the New Radio Log' },
  { id: 'focus-callsign', code: 'KeyC', keys: 'Alt+C', label: 'Go to Callsign' },
  { id: 'focus-message', code: 'KeyM', keys: 'Alt+M', label: 'Go to Message' },
  { id: 'focus-incident', code: 'KeyI', keys: 'Alt+I', label: 'Go to Incident' },
  { id: 'focus-talkgroup', code: 'KeyT', keys: 'Alt+T', label: 'Go to Talkgroup' },
  { id: 'toggle-important', code: 'KeyY', keys: 'Alt+Y', label: 'Toggle Important' },
  { id: 'toggle-action', code: 'KeyA', keys: 'Alt+A', label: 'Toggle Action Required' },
  { id: 'reset-form', code: 'KeyR', keys: 'Alt+R', label: 'Reset (clear) the New Radio Log' },
  { id: 'focus-search', code: 'KeyK', keys: 'Alt+K', label: 'Search the log' },
  { id: 'toggle-pause', code: 'KeyP', keys: 'Alt+P', label: 'Pause / resume the log' },
  { id: 'jump-latest', code: 'KeyJ', keys: 'Alt+J', label: 'Jump to latest' },
  { id: 'open-settings', code: 'KeyS', keys: 'Alt+S', label: 'Open Settings' },
];

/**
 * @param {Array<{label: string}>} quickMessages  the visible quick-message buttons, if that feature is on
 * @returns {Shortcut[]}  Alt+1..9 for the first nine quick messages
 */
export function quickMessageShortcuts(quickMessages) {
  return quickMessages.slice(0, 9).map((q, i) => ({
    id: `quick-${i + 1}`,
    code: `Digit${i + 1}`,
    keys: `Alt+${i + 1}`,
    label: `Quick message: ${q.label}`,
  }));
}

/**
 * @param {{code: string, altKey: boolean, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean}} event
 * @param {Shortcut[]} shortcuts
 * @returns {Shortcut|null}  Alt alone (no Ctrl/Cmd/Shift) plus the key
 */
export function matchShortcut(event, shortcuts) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  return shortcuts.find((s) => s.code === event.code) || null;
}

/** "?" on its own (Shift+/) -- for opening the help when not typing in a field */
export function isHelpKey(event) {
  return event.code === 'Slash' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/** @param {{tagName?: string, isContentEditable?: boolean}|null} el @returns {boolean} */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
}
