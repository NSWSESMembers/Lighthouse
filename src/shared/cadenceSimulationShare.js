/*
  The CADence simulated exercise a member has chosen, shared by every part of
  Lighthouse that shows it (Train and Test Beacon only).

  The exercise is chosen on Lighthouse's CADence Simulated Exercise page
  (pages/simulatedexercise.html, opened from Beacon's Lighthouse menu). LAD,
  the Nearest Asset Locations map on Beacon's job page and the situational
  awareness map follow it. It's kept in chrome.storage.session, one key per
  Beacon environment, so every tab on that environment follows the same
  choice and Chrome forgets it when it closes:

    lh-simulatedExercise-<env>:
      { state: 'active', selection }
      { state: 'ended', reason, selection, endedAt }

  `selection` is { exerciseId, copyId, exerciseName, copyName, mode,
  participantHqId, copies: [{ copyId, participantHqId, participantHqName }],
  selectedAt }. participantHqId is the HQ of the chosen copy. `copies` lists
  every copy of the exercise, so the job page can show the one for the job's
  own HQ (see selectionForHq in cadenceSimulation.js).

  No key means live positions, and so does 'ended'. That state is written when
  the exercise finishes (reason 'ended') or the CADence backend stops accepting
  the Beacon sign-in ('unavailable'), so LAD and the page can say why the
  simulated assets went away. Whichever notices first writes it: LAD, the
  situational awareness map's layer, or the page.

  Content scripts can only use session storage once the background has opened
  it to them (installSharedSelection). Lighthouse keeps nothing else there.
*/

import { sameSimulation } from './cadenceSimulation.js';

const KEY_PREFIX = 'lh-simulatedExercise-';

/** Message a content script sends to wake the background, which opens session storage to it. */
export const SHARE_ACCESS_MESSAGE = 'simulated-exercise-share-access';

/** The session storage key for one Beacon environment ('train' or 'test'). */
export function sharedKey(env) {
  return `${KEY_PREFIX}${env}`;
}

const LIVE = Object.freeze({ selection: null, ended: null });

function sessionArea(chromeApi) {
  return chromeApi?.storage?.session || null;
}

/**
 * A selection's list of exercise copies, keeping only well-formed entries.
 *
 * @param {unknown} value
 * @returns {Array<{copyId: string, participantHqId: string, participantHqName: string}>}
 */
export function copyList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (c) =>
        !!c &&
        (typeof c.copyId === 'string' || typeof c.copyId === 'number') &&
        (typeof c.participantHqId === 'string' || typeof c.participantHqId === 'number') &&
        String(c.copyId) !== '' &&
        String(c.participantHqId) !== '',
    )
    .map((c) => ({
      copyId: String(c.copyId),
      participantHqId: String(c.participantHqId),
      participantHqName: String(c.participantHqName ?? ''),
    }));
}

function idOf(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * A stored selection, cleaned up, or null when it can't be shown. A copy's
 * positions only go to teams assigned to its HQ (see Asset.exerciseHqId in
 * tasking), so a selection without one isn't usable.
 *
 * @param {unknown} value
 */
export function selectionFrom(value) {
  if (!value || typeof value !== 'object') return null;
  const exerciseId = idOf(value.exerciseId);
  const copyId = idOf(value.copyId);
  const participantHqId = idOf(value.participantHqId);
  if (!exerciseId || !copyId || !participantHqId) return null;
  return {
    exerciseId,
    copyId,
    exerciseName: String(value.exerciseName ?? ''),
    copyName: String(value.copyName ?? ''),
    mode: value.mode === 'group' ? 'group' : 'individual',
    participantHqId,
    copies: copyList(value.copies),
    selectedAt: Number(value.selectedAt) || 0,
  };
}

/**
 * The state for one environment, from the value stored under its key:
 * `selection` is the exercise copy to show (null for live positions), and
 * `ended` is { selection, reason, endedAt } once the chosen exercise has
 * ended or its sign-in was refused (null otherwise).
 *
 * @param {unknown} value
 * @returns {{selection: object|null, ended: {selection: object, reason: 'ended'|'unavailable', endedAt: number}|null}}
 */
export function sharedStateFrom(value) {
  if (!value || typeof value !== 'object') return LIVE;
  const selection = selectionFrom(value.selection);
  if (!selection) return LIVE;
  if (value.state === 'active') return { selection, ended: null };
  if (value.state === 'ended') {
    return {
      selection: null,
      ended: {
        selection,
        reason: value.reason === 'unavailable' ? 'unavailable' : 'ended',
        endedAt: Number(value.endedAt) || 0,
      },
    };
  }
  return LIVE;
}

// Until the background has opened session storage to content scripts (the
// first thing it does when it starts), using it from one throws. Wake the
// background, which opens it before it answers, then try once more.
async function withAccess(chromeApi, use) {
  try {
    return await use();
  } catch (err) {
    if (typeof chromeApi?.runtime?.sendMessage !== 'function') throw err;
    await chromeApi.runtime.sendMessage({ type: SHARE_ACCESS_MESSAGE });
    return use();
  }
}

/**
 * The current state for `env` (see sharedStateFrom).
 *
 * @param {string} env  'train' or 'test' (see cadenceSimulation.js)
 * @param {{chromeApi?: object}} [opts]
 */
export async function readSharedState(env, { chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!env || !session) return LIVE;
  const key = sharedKey(env);
  const items = await withAccess(chromeApi, () => session.get(key));
  return sharedStateFrom(items?.[key]);
}

/**
 * The Simulated Exercise page: show `selection` everywhere on `env`. Stamps
 * the time it was chosen if it has none.
 *
 * @param {string} env
 * @param {object} selection
 * @param {{chromeApi?: object, now?: () => number}} [opts]
 */
export async function chooseSharedSelection(env, selection, { chromeApi = globalThis.chrome, now = Date.now } = {}) {
  const session = sessionArea(chromeApi);
  const clean = selectionFrom(selection);
  if (!env || !session) throw new Error('Extension storage is unavailable');
  if (!clean) throw new Error('The exercise copy is incomplete');
  if (!clean.selectedAt) clean.selectedAt = now();
  await withAccess(chromeApi, () => session.set({ [sharedKey(env)]: { state: 'active', selection: clean } }));
}

/**
 * Back to live positions on `env`, because the user stopped.
 *
 * @param {string} env
 * @param {{chromeApi?: object}} [opts]
 */
export async function stopSharedSelection(env, { chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!env || !session) return;
  await withAccess(chromeApi, () => session.remove(sharedKey(env)));
}

/**
 * Back to live positions on `env` because `selection`'s exercise has ended
 * (reason 'ended') or the backend refused the sign-in ('unavailable'), saying
 * so for LAD and the page. Only while `selection` is still the one chosen:
 * a newer choice isn't undone.
 *
 * @param {string} env
 * @param {{exerciseId: string, copyId: string}} selection
 * @param {'ended'|'unavailable'} [reason]
 * @param {{chromeApi?: object, now?: () => number}} [opts]
 * @returns {Promise<boolean>} whether it was recorded
 */
export async function endSharedSelection(
  env,
  selection,
  reason = 'ended',
  { chromeApi = globalThis.chrome, now = Date.now } = {},
) {
  const session = sessionArea(chromeApi);
  if (!env || !session || !selection) return false;
  const current = await readSharedState(env, { chromeApi });
  if (!current.selection || !sameSimulation(current.selection, selection)) return false;
  await withAccess(chromeApi, () =>
    session.set({
      [sharedKey(env)]: {
        state: 'ended',
        reason: reason === 'unavailable' ? 'unavailable' : 'ended',
        selection: current.selection,
        endedAt: now(),
      },
    }),
  );
  return true;
}

/**
 * Report the state for `env` now and whenever it changes:
 * onChange({ selection, ended }). Not called twice in a row with the same
 * state. Without extension storage it reports live positions once.
 *
 * @param {string} env
 * @param {(state: {selection: object|null, ended: object|null}) => void} onChange
 * @param {{chromeApi?: object}} [opts]
 * @returns {() => void} stops watching
 */
export function watchSharedState(env, onChange, { chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!env || !session || !chromeApi?.storage?.onChanged) {
    onChange(LIVE);
    return () => {};
  }
  const key = sharedKey(env);
  let stopped = false;
  let reported; // JSON of the last state passed to onChange
  let changed = false; // a change event has arrived, so the first read is stale

  function report(state) {
    const json = JSON.stringify(state);
    if (stopped || json === reported) return;
    reported = json;
    onChange(state);
  }

  function listener(changes, area) {
    if (area !== 'session' || !Object.prototype.hasOwnProperty.call(changes, key)) return;
    changed = true;
    report(sharedStateFrom(changes[key].newValue));
  }

  chromeApi.storage.onChanged.addListener(listener);
  readSharedState(env, { chromeApi })
    .catch((err) => {
      console.warn('[simulated-exercise] Could not read the chosen exercise:', err);
      return LIVE;
    })
    .then((state) => {
      if (!changed) report(state);
    });
  return () => {
    stopped = true;
    chromeApi.storage.onChanged.removeListener(listener);
  };
}

/**
 * Beacon pages: report the exercise copy to show on `env` (null for live
 * positions) now and whenever it changes. Not called twice in a row with the
 * same one.
 *
 * @param {string} env
 * @param {(selection: object|null) => void} onChange
 * @param {{chromeApi?: object}} [opts]
 * @returns {() => void} stops watching
 */
export function watchSharedSelection(env, onChange, opts) {
  let reported;
  return watchSharedState(
    env,
    ({ selection }) => {
      const json = JSON.stringify(selection);
      if (json === reported) return;
      reported = json;
      onChange(selection);
    },
    opts,
  );
}

/**
 * The shared choice for one environment, as the view models take it (tests
 * pass their own): read, watch, choose, stop and end.
 *
 * @param {string} env
 * @param {{chromeApi?: object}} [opts]
 */
export function sharedChoice(env, { chromeApi = globalThis.chrome } = {}) {
  return {
    read: () => readSharedState(env, { chromeApi }),
    watch: (onChange) => watchSharedState(env, onChange, { chromeApi }),
    choose: (selection) => chooseSharedSelection(env, selection, { chromeApi }),
    stop: () => stopSharedSelection(env, { chromeApi }),
    end: (selection, reason) => endSharedSelection(env, selection, reason, { chromeApi }),
  };
}

/**
 * Background: open session storage to content scripts, so Beacon pages can
 * read the choice and the situational awareness map can record an ended
 * exercise. Call once, at the top level of the service worker.
 *
 * @param {{chromeApi?: object}} [opts]
 * @returns {Promise<void>} resolves once content scripts can use it
 */
export function installSharedSelection({ chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!session) return Promise.resolve();
  return Promise.resolve(session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })).catch((err) =>
    console.warn('[simulated-exercise] Could not open session storage to content scripts:', err),
  );
}
