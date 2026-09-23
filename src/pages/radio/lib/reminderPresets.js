/*
  Pure preset -> Date logic for the entry form's "Action Reminder" control,
  matching Beacon's own Ops Log entry form's four fixed intervals plus
  Custom. Labels are abbreviated (30 mins, not 30 Minutes) to read well as
  a row of pill buttons.
*/

export const REMINDER_PRESETS = [
  { key: 'none', label: 'None', minutes: null },
  { key: '30', label: '30 mins', minutes: 30 },
  { key: '60', label: '60 mins', minutes: 60 },
  { key: '120', label: '120 mins', minutes: 120 },
  { key: 'custom', label: 'Custom', minutes: null },
];

/**
 * @param {string} presetKey  one of REMINDER_PRESETS' keys
 * @param {Date} [nowDate]
 * @param {Date|null} [customDate]  used when presetKey === 'custom'
 * @returns {Date|null}
 */
export function resolveReminderTime(presetKey, nowDate = new Date(), customDate = null) {
  if (presetKey === 'custom') return customDate;
  const preset = REMINDER_PRESETS.find((p) => p.key === presetKey);
  if (!preset || preset.minutes === null) return null;
  return new Date(nowDate.getTime() + preset.minutes * 60000);
}
