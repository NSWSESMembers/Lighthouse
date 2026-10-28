/*
  Tells Lighthouse's scripts in a Beacon page's own context (injectscripts/)
  which CADence exercise copy LAD is showing, if any (Train and Test Beacon
  only). Those scripts can't read extension storage, so the page's content
  script answers for them over window.postMessage:

    page -> content script   { type: SIMULATION_REQUEST }
    content script -> page   { type: SIMULATION_STATE, selection }

  The content script also posts SIMULATION_STATE whenever the selection
  changes. `selection` is null, or { exerciseId, copyId, exerciseName,
  copyName, mode, participantHqId, copies } (see cadenceSimulationShare.js).
  Exercise ids aren't secret, so the page is told openly; the CADence backend
  still checks the Beacon sign-in on every request.
*/

import { simulationEnvironment } from './cadenceSimulation.js';
import { watchSharedSelection, copyList } from './cadenceSimulationShare.js';

export const SIMULATION_REQUEST = 'LH_SIMULATED_EXERCISE_REQUEST';
export const SIMULATION_STATE = 'LH_SIMULATED_EXERCISE';

function pageSelection(value) {
  if (!value || typeof value.exerciseId !== 'string' || typeof value.copyId !== 'string') return null;
  if (!value.exerciseId || !value.copyId) return null;
  return {
    exerciseId: value.exerciseId,
    copyId: value.copyId,
    exerciseName: String(value.exerciseName ?? ''),
    copyName: String(value.copyName ?? ''),
    mode: value.mode === 'group' ? 'group' : 'individual',
    participantHqId: String(value.participantHqId ?? ''),
    copies: copyList(value.copies),
  };
}

/**
 * Content script: keep the page told which exercise copy LAD is showing for
 * this Beacon environment. Does nothing outside Train and Test Beacon.
 *
 * @param {{win?: Window, watch?: typeof watchSharedSelection}} [opts]
 */
export function serveSimulationToPage({ win = window, watch = watchSharedSelection } = {}) {
  const environment = simulationEnvironment(win.location.origin);
  if (!environment) return;
  let state; // undefined until storage has been read
  const post = () => win.postMessage({ type: SIMULATION_STATE, selection: state }, win.location.origin);
  watch(environment.env, (selection) => {
    state = pageSelection(selection);
    post();
  });
  win.addEventListener('message', (event) => {
    if (event.source !== win || event.data?.type !== SIMULATION_REQUEST) return;
    // Before the first read the watcher posts as soon as it has an answer.
    if (state !== undefined) post();
  });
}

/**
 * Inject script: the exercise copy LAD is showing for this Beacon
 * environment, as reported by the content script (see serveSimulationToPage).
 * Create it early, so it hears every change.
 *
 * @param {{host: string|(() => string), win?: Window, timeoutMs?: number}} opts
 *   host: the Beacon API host (urls.Base), or a function returning it
 */
export function createPageSimulation({ host, win = window, timeoutMs = 2000 } = {}) {
  let state; // undefined until the content script has answered
  const waiting = [];
  const listeners = [];

  function environment() {
    try {
      return simulationEnvironment(typeof host === 'function' ? host() : host);
    } catch (_) {
      return null;
    }
  }

  win.addEventListener('message', (event) => {
    if (event.source !== win || event.data?.type !== SIMULATION_STATE) return;
    state = pageSelection(event.data.selection);
    waiting.splice(0).forEach((resolve) => resolve(state));
    listeners.forEach((listener) => listener(state));
  });

  return {
    /**
     * The selection, or null for the live feed. Resolves null at once off
     * Train and Test Beacon, and after `timeoutMs` if the content script
     * never answers.
     *
     * @returns {Promise<object|null>}
     */
    current() {
      if (!environment()) return Promise.resolve(null);
      if (state !== undefined) return Promise.resolve(state);
      return new Promise((resolve) => {
        waiting.push(resolve);
        win.postMessage({ type: SIMULATION_REQUEST }, win.location.origin);
        setTimeout(() => {
          const index = waiting.indexOf(resolve);
          if (index === -1) return;
          waiting.splice(index, 1);
          resolve(null);
        }, timeoutMs);
      });
    },

    /** The last selection heard (null if none yet, or off Train and Test Beacon). */
    latest() {
      return environment() ? (state ?? null) : null;
    },

    /** Called with the selection every time the content script reports it. */
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
