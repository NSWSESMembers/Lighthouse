/*
  Quick messages: canned entries an operator can drop into the entry form with
  one click (optionally setting Important / Action Required and a reminder).
  Pure data handling -- the panel and editor are in features/quick-messages.js.
*/

export const QUICK_MESSAGES_STORAGE_KEY = 'lighthouseRadioQuickMessages';

export const QUICK_MESSAGE_REMINDERS = ['none', '30', '60', '120']; // matches lib/reminderPresets.js

export const DEFAULT_QUICK_MESSAGES = [
  { label: 'Radio check OK', text: 'Radio check OK.' },
  { label: 'Team deployed', text: 'Team deployed and en route.' },
  { label: 'On scene', text: 'On scene.' },
  { label: 'Job complete', text: 'Job complete.' },
  { label: 'Returning to base', text: 'Returning to base.' },
  { label: 'Welfare check OK', text: 'Welfare check -- all members OK.' },
  { label: 'Requesting assistance', text: 'Requesting assistance.', important: true, actionRequired: true, reminder: '30' },
];

/**
 * @param {unknown} list  parsed JSON of unknown quality
 * @returns {Array<{label: string, text: string, important: boolean, actionRequired: boolean, reminder: string}>}
 *          only entries with a label and text; flags coerced; a reminder only counts with Action Required
 */
export function normaliseQuickMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && typeof m.label === 'string' && typeof m.text === 'string' && m.label.trim() && m.text.trim())
    .map((m) => {
      const actionRequired = !!m.actionRequired;
      return {
        label: m.label.trim(),
        text: m.text.trim(),
        important: !!m.important,
        actionRequired,
        reminder: actionRequired && QUICK_MESSAGE_REMINDERS.includes(m.reminder) ? m.reminder : 'none',
      };
    });
}

/** @param {Storage|null} storage @returns {ReturnType<typeof normaliseQuickMessages>}  the saved list, else the defaults */
export function loadQuickMessages(storage) {
  try {
    const raw = storage.getItem(QUICK_MESSAGES_STORAGE_KEY);
    if (raw === null) return normaliseQuickMessages(DEFAULT_QUICK_MESSAGES);
    return normaliseQuickMessages(JSON.parse(raw)); // a saved empty list stays empty -- the operator removed them all
  } catch (err) {
    return normaliseQuickMessages(DEFAULT_QUICK_MESSAGES);
  }
}

/** @param {Storage|null} storage @param {ReturnType<typeof normaliseQuickMessages>} list */
export function saveQuickMessages(storage, list) {
  try {
    storage.setItem(QUICK_MESSAGES_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    // not remembered -- harmless
  }
}

/**
 * The message text after adding a quick message: it becomes the text when the
 * box is empty, follows what's already typed otherwise, and isn't added twice.
 *
 * @param {string} current
 * @param {string} quickText
 * @returns {string}
 */
export function mergeQuickMessageText(current, quickText) {
  const base = current.replace(/\s+$/, '');
  if (!base) return quickText;
  if (base.includes(quickText)) return current;
  return `${base} ${quickText}`;
}
