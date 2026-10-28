/*
  Shares LAD's CADence simulated-exercise choice with Lighthouse on Beacon's
  own pages (Train and Test Beacon only).

  The choice belongs to a LAD tab: SimulatedExerciseVM keeps it in that tab's
  sessionStorage. So that the Nearest Asset Locations map on a job and the
  situational awareness map show the same exercise, each LAD tab also
  publishes its choice to chrome.storage.session under a key of its own:

    lh-simulatedExercise-tab-<tabId>:
      { env, exerciseId, copyId, exerciseName, copyName, mode, participantHqId,
        copies: [{ copyId, participantHqId, participantHqName }], selectedAt }

  participantHqId is the HQ of the copy LAD shows. `copies` lists every copy
  of the exercise, so the job page can show the one for the job's own HQ (see
  selectionForHq in cadenceSimulation.js).

  Beacon pages follow the exercise chosen most recently among the LAD tabs
  still showing one for their environment. A LAD tab removes its key when it
  stops showing an exercise or unloads, the background removes it when the
  tab closes, and the browser empties session storage when it quits, so
  Beacon pages never follow a LAD tab that's gone. They act on a removal a
  few seconds late (see watchSharedSelection), so a LAD tab reloading doesn't
  make them switch to live positions and back.

  Content scripts can only read session storage once the background has
  opened it to them (allowContentScripts). Lighthouse keeps nothing else
  there.
*/

const KEY_PREFIX = 'lh-simulatedExercise-tab-';

/** Message a content script sends to wake the background, which opens session storage to it. */
export const SHARE_ACCESS_MESSAGE = 'simulated-exercise-share-access';

function sessionArea(chromeApi) {
  return chromeApi?.storage?.session || null;
}

function validEntry(value) {
  return (
    !!value &&
    typeof value.env === 'string' &&
    typeof value.exerciseId === 'string' &&
    typeof value.copyId === 'string' &&
    value.exerciseId !== '' &&
    value.copyId !== ''
  );
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

/**
 * The exercise copy Beacon pages in `env` should show: the most recently
 * chosen among the published LAD selections, or null when no LAD tab is
 * showing one there.
 *
 * @param {Record<string, any>} items  everything in chrome.storage.session
 * @param {string} env  'train' or 'test' (see cadenceSimulation.js)
 * @returns {{exerciseId: string, copyId: string, exerciseName: string, copyName: string,
 *   mode: 'group'|'individual', participantHqId: string,
 *   copies: Array<{copyId: string, participantHqId: string, participantHqName: string}>, selectedAt: number}|null}
 */
export function sharedSelectionFrom(items, env) {
  let best = null;
  let bestKey = '';
  for (const [key, value] of Object.entries(items || {})) {
    if (!key.startsWith(KEY_PREFIX) || !validEntry(value) || value.env !== env) continue;
    const selectedAt = Number(value.selectedAt) || 0;
    // Latest choice wins; the key breaks a tie so every page agrees.
    if (!best || selectedAt > best.selectedAt || (selectedAt === best.selectedAt && key > bestKey)) {
      best = {
        exerciseId: value.exerciseId,
        copyId: value.copyId,
        exerciseName: String(value.exerciseName ?? ''),
        copyName: String(value.copyName ?? ''),
        mode: value.mode === 'group' ? 'group' : 'individual',
        participantHqId: String(value.participantHqId ?? ''),
        copies: copyList(value.copies),
        selectedAt,
      };
      bestKey = key;
    }
  }
  return best;
}

/**
 * LAD: publishes this tab's selection for Beacon pages to follow. Writes run
 * in order, so a quick show-then-stop can't land the other way round. Does
 * nothing outside an extension tab (no chrome.tabs, as in unit tests).
 *
 * @param {{env: string, chromeApi?: object}} opts
 * @returns {{publish: (selection: object|null) => Promise<void>}}
 */
export function createTabPublisher({ env, chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!env || !session || typeof chromeApi?.tabs?.getCurrent !== 'function') {
    return { publish: () => Promise.resolve() };
  }
  let keyPromise = null;
  function tabKey() {
    keyPromise ??= Promise.resolve(chromeApi.tabs.getCurrent()).then(
      (tab) => (tab && tab.id != null ? `${KEY_PREFIX}${tab.id}` : null),
      () => null,
    );
    return keyPromise;
  }
  let queue = Promise.resolve();
  function publish(selection) {
    queue = queue
      .then(async () => {
        const key = await tabKey();
        if (!key) return;
        if (!selection) {
          await session.remove(key);
          return;
        }
        await session.set({
          [key]: {
            env,
            exerciseId: String(selection.exerciseId),
            copyId: String(selection.copyId),
            exerciseName: String(selection.exerciseName ?? ''),
            copyName: String(selection.copyName ?? ''),
            mode: selection.mode === 'group' ? 'group' : 'individual',
            participantHqId: String(selection.participantHqId ?? ''),
            copies: copyList(selection.copies),
            selectedAt: Number(selection.selectedAt) || Date.now(),
          },
        });
      })
      .catch((err) => console.warn('[simulated-exercise] Could not share the selection with Beacon pages:', err));
    return queue;
  }
  return { publish };
}

/**
 * Content scripts: report the exercise copy Beacon pages in `env` should
 * show, now and whenever it changes. `onChange` gets the selection (see
 * sharedSelectionFrom) or null, and isn't called again with the same one.
 *
 * A LAD tab that's reloading takes its selection away and then publishes it
 * again a second or two later. So when a change only takes selections away,
 * this waits `removalGraceMs` before reading, and Beacon pages don't flick to
 * live positions and back. Starting or switching an exercise is reported
 * straight away.
 *
 * @param {string} env
 * @param {(selection: object|null) => void} onChange
 * @param {{chromeApi?: object, removalGraceMs?: number}} [opts]
 * @returns {() => void} stops watching
 */
export function watchSharedSelection(env, onChange, { chromeApi = globalThis.chrome, removalGraceMs = 4000 } = {}) {
  const session = sessionArea(chromeApi);
  if (!env || !session || !chromeApi?.storage?.onChanged) {
    onChange(null);
    return () => {};
  }

  let stopped = false;
  let reported; // JSON of the last selection passed to onChange
  let seq = 0;
  let graceTimer = null;

  async function readAll() {
    try {
      return await session.get(null);
    } catch (err) {
      // Until the background has opened session storage to content scripts
      // (the first thing it does when it starts), reading it throws. Wake the
      // background, which does that before it answers, then try again.
      await chromeApi.runtime.sendMessage({ type: SHARE_ACCESS_MESSAGE });
      return session.get(null);
    }
  }

  async function read() {
    const mine = ++seq;
    let selection = null;
    try {
      selection = sharedSelectionFrom(await readAll(), env);
    } catch (err) {
      console.warn('[simulated-exercise] Could not read the LAD selection:', err);
    }
    if (stopped || mine !== seq) return;
    const json = JSON.stringify(selection);
    if (json === reported) return;
    reported = json;
    onChange(selection);
  }

  function listener(changes, area) {
    if (area !== 'session') return;
    const ours = Object.entries(changes).filter(([key]) => key.startsWith(KEY_PREFIX));
    if (!ours.length) return;
    if (ours.some(([, change]) => change.newValue !== undefined)) {
      // read() sees any removal too, so a pending one has nothing left to do.
      clearTimeout(graceTimer);
      read();
    } else {
      clearTimeout(graceTimer);
      graceTimer = setTimeout(read, removalGraceMs);
    }
  }

  chromeApi.storage.onChanged.addListener(listener);
  read();
  return () => {
    stopped = true;
    clearTimeout(graceTimer);
    chromeApi.storage.onChanged.removeListener(listener);
  };
}

/**
 * Background: open session storage to content scripts, and drop a LAD tab's
 * selection when the tab closes (a closing tab doesn't always get to remove
 * its own). Call once, at the top level of the service worker.
 *
 * @param {{chromeApi?: object}} [opts]
 * @returns {Promise<void>} resolves once content scripts can read the selections
 */
export function installSharedSelection({ chromeApi = globalThis.chrome } = {}) {
  const session = sessionArea(chromeApi);
  if (!session) return Promise.resolve();
  chromeApi.tabs?.onRemoved?.addListener((tabId) => {
    session.remove(`${KEY_PREFIX}${tabId}`).catch(() => {});
  });
  return Promise.resolve(session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })).catch((err) =>
    console.warn('[simulated-exercise] Could not open session storage to content scripts:', err),
  );
}
