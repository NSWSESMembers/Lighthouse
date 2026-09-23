/*
  The in-page alert banners (outstanding actions coming due, callsign checks going
  overdue): a newest-first list with one entry per key, plus the chime's notes.
  Pure -- the banner markup and the audio are in the view model / radiocon.html.
*/

/**
 * @template {{key: string}} T
 * @param {T[]} list
 * @param {T} alert
 * @returns {T[]}  newest first; an alert with the same key replaces (and moves above) the old one
 */
export function upsertAlert(list, alert) {
  return [alert, ...list.filter((a) => a.key !== alert.key)];
}

/**
 * Drops alerts of one kind (key prefix) whose subject is no longer in that state -- e.g. an
 * action that was resolved -- and leaves every other kind alone.
 *
 * @template {{key: string}} T
 * @param {T[]} list
 * @param {string} prefix
 * @param {Set<string>} activeKeys  keys (of that kind) that should stay
 * @returns {T[]}
 */
export function retainAlerts(list, prefix, activeKeys) {
  return list.filter((a) => !a.key.startsWith(prefix) || activeKeys.has(a.key));
}

/**
 * @param {'overdue'|'due-soon'} severity
 * @returns {Array<{frequency: number, start: number, duration: number, type: OscillatorType, gain: number}>}  notes (seconds):
 *          yellow (due soon) = the three-note chime; red (overdue / urgent) = a faster, higher, harsher
 *          alternating two-tone alarm, repeated, that can't be mistaken for it
 */
export function chimeNotes(severity) {
  if (severity === 'overdue') {
    const notes = [];
    for (let i = 0; i < 6; i += 1) {
      notes.push({ frequency: i % 2 === 0 ? 1175 : 880, start: i * 0.16, duration: 0.14, type: 'square', gain: 0.16 });
    }
    return notes;
  }
  return [
    { frequency: 880, start: 0, duration: 0.2, type: 'sine', gain: 0.3 },
    { frequency: 660, start: 0.25, duration: 0.2, type: 'sine', gain: 0.3 },
    { frequency: 880, start: 0.5, duration: 0.32, type: 'sine', gain: 0.3 },
  ];
}
