/*
  Which outstanding actions should raise an alert right now.
  An action alerts once when it comes due soon (its reminder is inside the
  "due soon" window) and once when its reminder time passes; while it stays
  overdue it can repeat every N minutes. Acknowledging an action silences every
  further alert for it -- the due-soon one, the overdue one and the repeats --
  until it stops being outstanding (resolved, or its reminder moved), when it
  re-arms. Pure -- the console keeps the returned state between checks.
*/

/**
 * @typedef {object} NotifiedState
 * @property {Set<string|number>} dueSoon  announced as due soon
 * @property {Map<string|number, number>} overdue  announced as overdue -> when last announced (epoch ms)
 * @property {Set<string|number>} acknowledged  actions the operator has acknowledged (no more alerts of any kind)
 */

/** @returns {NotifiedState} */
export function emptyNotifiedState() {
  return { dueSoon: new Set(), overdue: new Map(), acknowledged: new Set() };
}

/**
 * @param {NotifiedState} state
 * @param {string|number} id
 * @returns {NotifiedState}
 */
export function acknowledgeAction(state, id) {
  return { ...state, acknowledged: new Set([...state.acknowledged, id]) };
}

/**
 * @param {Array<{id: string|number, severity: string}>} actions  outstanding actions ('overdue' | 'due-soon' | others)
 * @param {NotifiedState} state  what has already been announced
 * @param {{dueSoon: boolean, overdue: boolean, repeatMinutes: number}} prefs  which kinds the operator wants; repeatMinutes 0 = never repeat
 * @param {number} now  epoch ms
 * @returns {{toNotify: Array<{id: string|number, kind: 'due-soon'|'overdue', repeat: boolean}>, state: NotifiedState}}
 *          `state` is the new state to keep; ids no longer in a state are dropped so they can notify again later.
 *          A kind that is switched off is still recorded as seen, so switching it on later doesn't replay old actions.
 */
export function planReminderNotifications(actions, state, prefs, now) {
  const dueSoonNow = new Set(actions.filter((a) => a.severity === 'due-soon').map((a) => a.id));
  const overdueNow = new Set(actions.filter((a) => a.severity === 'overdue').map((a) => a.id));

  const next = {
    dueSoon: new Set([...state.dueSoon].filter((id) => dueSoonNow.has(id))),
    overdue: new Map([...state.overdue].filter(([id]) => overdueNow.has(id))),
    // an acknowledgement lasts while the action is still outstanding (due soon or overdue)
    acknowledged: new Set([...state.acknowledged].filter((id) => dueSoonNow.has(id) || overdueNow.has(id))),
  };

  const toNotify = [];
  dueSoonNow.forEach((id) => {
    if (next.dueSoon.has(id)) return;
    next.dueSoon.add(id);
    if (prefs.dueSoon && !next.acknowledged.has(id)) toNotify.push({ id, kind: 'due-soon', repeat: false });
  });

  const repeatMs = (prefs.repeatMinutes || 0) * 60000;
  overdueNow.forEach((id) => {
    if (!next.overdue.has(id)) {
      next.overdue.set(id, now);
      if (prefs.overdue && !next.acknowledged.has(id)) toNotify.push({ id, kind: 'overdue', repeat: false });
      return;
    }
    if (prefs.overdue && repeatMs > 0 && !next.acknowledged.has(id) && now - next.overdue.get(id) >= repeatMs) {
      next.overdue.set(id, now);
      toNotify.push({ id, kind: 'overdue', repeat: true });
    }
  });
  return { toNotify, state: next };
}
