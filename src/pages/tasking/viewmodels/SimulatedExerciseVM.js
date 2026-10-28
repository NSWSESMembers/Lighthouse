/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';
import moment from 'moment';
import {
  simulationEnvironment,
  listExercises,
  isSimulationUnavailable,
  exerciseDisplayName,
  simulationLabel,
} from '../../../shared/cadenceSimulation.js';
import { createTabPublisher, copyList } from '../../../shared/cadenceSimulationShare.js';

// The selection lives in sessionStorage: it survives a reload of this LAD tab
// but not the tab closing, and each tab can show a different exercise copy
// (handy for a facilitator watching several headquarters). It's also
// published for Beacon's own job and situational awareness pages, which
// follow the most recently chosen one (see shared/cadenceSimulationShare.js).
const STORAGE_PREFIX = 'lh-simulatedExercise-';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Exercise and HQ names come from whoever set the exercise up, and the map
// alert overlay renders raw HTML, so escape them on the way in there. (The
// ended banner binds them with `text:`, which needs no escaping.)
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch (_) {
    return null;
  }
}

function startedText(createdAt) {
  const started = moment(createdAt, moment.ISO_8601);
  if (!createdAt || !started.isValid()) return '';
  return started.isSame(moment(), 'day') ? started.format('h:mm a') : started.format('D MMM h:mm a');
}

function exerciseLabel(exercise) {
  const started = startedText(exercise.createdAt);
  const details = [exercise.mode === 'group' ? 'group' : 'individual', started ? `started ${started}` : '']
    .filter(Boolean)
    .join(', ');
  return `${exerciseDisplayName(exercise.name)} (${details})`;
}

/**
 * Picker and state for CADence simulated exercises in LAD (Train and Test
 * Beacon only). While a copy is selected, the page passes feedSelection() to
 * BeaconClient.asset.filter so the radio feed comes from the exercise.
 *
 * @param {object} deps
 * @param {string} deps.host  Beacon API host (params.host); decides availability
 * @param {string} [deps.hqId]  the user's current HQ id, to preselect their copy of a group exercise
 * @param {() => Promise<string>} deps.getToken  current Beacon bearer token
 * @param {Storage} [deps.storage]  defaults to sessionStorage
 * @param {{publish: (selection: object|null) => Promise<void>}|null} [deps.share]  where the selection is published
 *   for Beacon pages; defaults to this tab's entry in chrome.storage.session, null to publish nothing
 * @param {(selection: object|null) => void} [deps.onSelectionChange]  refetch assets
 * @param {() => void} [deps.openPicker]  bring up the picker (the map alert's "change" item and the
 *   ended banner's link)
 */
export function SimulatedExerciseVM(deps = {}) {
  const self = this;
  const { host, hqId, getToken, onSelectionChange, openPicker } = deps;
  const storage = deps.storage !== undefined ? deps.storage : defaultStorage();
  const environment = simulationEnvironment(host);
  const storageKey = environment ? `${STORAGE_PREFIX}${environment.env}` : null;
  const share =
    deps.share !== undefined ? deps.share : environment ? createTabPublisher({ env: environment.env }) : null;

  self.available = !!environment;
  self.environmentLabel = environment ? environment.label : '';

  // ---- Current selection (what the map shows) ----------------------------

  function readSelection() {
    if (!storageKey || !storage) return null;
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) || 'null');
      if (!parsed || typeof parsed.exerciseId !== 'string' || typeof parsed.copyId !== 'string') return null;
      if (!parsed.exerciseId || !parsed.copyId) return null;
      // Without its HQ, the copy's positions couldn't be kept to that HQ's
      // teams (see Asset.exerciseHqId), so such a selection isn't restored.
      if (typeof parsed.participantHqId !== 'string' || !parsed.participantHqId) return null;
      return {
        exerciseId: parsed.exerciseId,
        copyId: parsed.copyId,
        exerciseName: String(parsed.exerciseName ?? ''),
        copyName: String(parsed.copyName ?? ''),
        mode: parsed.mode === 'group' ? 'group' : 'individual',
        participantHqId: parsed.participantHqId,
        // Every copy of the exercise, for Beacon's job page (see cadenceSimulationShare.js).
        copies: copyList(parsed.copies),
        // When it was chosen: Beacon pages follow the latest choice across LAD tabs.
        selectedAt: Number(parsed.selectedAt) || Date.now(),
      };
    } catch (_) {
      return null;
    }
  }

  function writeSelection(selection) {
    if (!storageKey || !storage) return;
    try {
      if (selection) storage.setItem(storageKey, JSON.stringify(selection));
      else storage.removeItem(storageKey);
    } catch (_) {
      /* storage unavailable: the selection just won't survive a reload */
    }
  }

  self.selection = ko.observable(readSelection());
  self.active = ko.pureComputed(() => !!self.selection());
  self.activeLabel = ko.pureComputed(() => simulationLabel(self.selection()));
  // Bumped on every change, so the page can drop an asset response that was
  // requested for the previous selection.
  self.generation = ko.observable(0);
  // Simulated positions in the last feed response.
  self.assetCount = ko.observable(0);

  // ---- Banner for when simulated mode ends on its own ---------------------
  //
  // When the exercise ends, or the backend stops accepting the sign-in, LAD
  // goes back to live positions without the user asking. A banner says so
  // and stays up until the user closes it or picks another exercise. A toast
  // that went after a few seconds was easy to miss, and then the simulated
  // teams just seemed to stop moving.

  // { reason: 'ended' | 'unavailable', label } or null.
  self.notice = ko.observable(null);
  self.noticeVisible = ko.pureComputed(() => !!self.notice());
  self.noticeIsWarning = ko.pureComputed(() => self.notice()?.reason === 'unavailable');
  // Shown in bold ahead of noticeText. Plain text: the page binds it with `text:`.
  self.noticeName = ko.pureComputed(() => (self.notice()?.reason === 'ended' ? self.notice().label : ''));
  self.noticeText = ko.pureComputed(() => {
    const notice = self.notice();
    if (!notice) return '';
    if (notice.reason === 'ended') return 'has ended. Now showing live asset locations.';
    return (
      `The CADence exercise service didn't accept your ${self.environmentLabel} sign-in. ` +
      'Now showing live asset locations.'
    );
  });
  self.noticeLinkText = ko.pureComputed(() =>
    self.notice()?.reason === 'ended' ? 'Choose another exercise' : 'Open Simulated Exercise settings',
  );

  // For click bindings: both ignore the ($data, event) Knockout passes.
  self.dismissNotice = function () {
    self.notice(null);
  };
  // The banner's link. Opening the picker counts as having seen the banner.
  self.chooseAnotherExercise = function () {
    self.notice(null);
    if (typeof openPicker === 'function') openPicker();
  };

  function setSelection(selection) {
    self.selection(selection);
    self.assetCount(0);
    self.generation(self.generation() + 1);
    writeSelection(selection);
    if (share) share.publish(selection);
    // Showing an exercise again makes an earlier "has ended" banner stale.
    if (selection) self.notice(null);
    if (typeof onSelectionChange === 'function') onSelectionChange(selection);
  }

  // ---- Beacon pages ------------------------------------------------------
  //
  // Lighthouse's maps on Beacon's own job and situational awareness pages
  // show the exercise this tab shows (the latest choice, if several LAD tabs
  // show one). The page withdraws it when the tab unloads, and publishes it
  // again if the tab comes back from the back/forward cache.

  /** Publish the current selection (or its absence) for Beacon pages. */
  self.publishToBeacon = function () {
    if (share) share.publish(self.selection());
  };

  /** Stop Beacon pages following this tab, keeping the tab's own selection. */
  self.withdrawFromBeacon = function () {
    if (share) share.publish(null);
  };

  // A selection restored on reload is still showing.
  if (self.selection()) self.publishToBeacon();

  /**
   * { exerciseId, copyId, participantHqId } for BeaconClient.asset.filter, or
   * null for the real feed. participantHqId goes on the simulated assets, so
   * they only match teams assigned to that HQ (see Asset.exerciseHqId).
   */
  self.feedSelection = function () {
    const selection = self.selection();
    return selection
      ? { exerciseId: selection.exerciseId, copyId: selection.copyId, participantHqId: selection.participantHqId }
      : null;
  };

  // ---- Picker state (the Simulated Exercise configuration tab) -----------

  self.exercises = ko.observableArray([]);
  self.loading = ko.observable(false);
  self.loaded = ko.observable(false);
  // The backend refused this Beacon sign-in, so the list says nothing about
  // what's running.
  self.refused = ko.observable(false);
  self.message = ko.observable('');
  self.messageIsError = ko.observable(false);

  function setMessage(text, isError = false) {
    self.message(text);
    self.messageIsError(!!isError);
  }

  self.chosenExerciseId = ko.observable();
  self.chosenCopyId = ko.observable();
  self.chosenExercise = ko.pureComputed(
    () => self.exercises().find((e) => e.exerciseId === self.chosenExerciseId()) || null,
  );
  self.chosenCopies = ko.pureComputed(() => self.chosenExercise()?.copies || []);
  self.needsCopyChoice = ko.pureComputed(() => self.chosenCopies().length > 1);
  // The headquarters dropdown shows once an exercise is chosen. An individual
  // exercise has one copy, so it just names that HQ and can't be changed.
  self.showCopyChoice = ko.pureComputed(() => !!self.chosenExercise());
  self.copyCaption = ko.pureComputed(() => (self.needsCopyChoice() ? 'Choose a headquarters…' : undefined));
  self.copyHelp = ko.pureComputed(() =>
    self.needsCopyChoice()
      ? 'A group exercise gives each headquarters its own copy of the teams, with the same callsigns. ' +
        "Pick the one you're working from. Simulated positions only go to teams assigned to it."
      : 'Simulated positions only go to teams assigned to this headquarters.',
  );
  self.noExercises = ko.pureComputed(() => self.loaded() && self.exercises().length === 0);
  self.exerciseCaption = ko.pureComputed(() => {
    if (!self.loaded()) return self.loading() ? 'Loading exercises…' : 'Refresh to list exercises';
    if (self.refused()) return 'Not available';
    return self.noExercises() ? 'No exercises running' : 'Choose an exercise…';
  });
  self.canShow = ko.pureComputed(() => {
    const exercise = self.chosenExercise();
    const copyId = self.chosenCopyId();
    if (!exercise || !copyId || !exercise.copies.some((c) => c.copyId === copyId)) return false;
    const selection = self.selection();
    return !(selection && selection.exerciseId === exercise.exerciseId && selection.copyId === copyId);
  });
  self.showButtonText = ko.pureComputed(() => (self.active() ? 'Switch to this exercise' : 'Show simulated assets'));

  // The copy to offer for an exercise: the only one, the one showing, or the
  // one for the user's own HQ. Otherwise the user picks.
  function defaultCopyId(exercise) {
    if (!exercise) return undefined;
    if (exercise.copies.length === 1) return exercise.copies[0].copyId;
    const selection = self.selection();
    if (selection && selection.exerciseId === exercise.exerciseId) {
      if (exercise.copies.some((c) => c.copyId === selection.copyId)) return selection.copyId;
    }
    const mine = hqId != null && hqId !== '' ? exercise.copies.find((c) => c.participantHqId === String(hqId)) : null;
    return mine ? mine.copyId : undefined;
  }

  self.chosenExerciseId.subscribe((exerciseId) => {
    const exercise = self.exercises().find((e) => e.exerciseId === exerciseId);
    const current = self.chosenCopyId();
    if (!exercise || !exercise.copies.some((c) => c.copyId === current)) {
      self.chosenCopyId(defaultCopyId(exercise));
    }
  });

  let refreshSeq = 0;

  /**
   * Load the active exercises for this Beacon environment. Only runs when the
   * user opens the picker (or the feed comes back empty while one is
   * selected), so the backend never sees the token of someone who isn't
   * using simulated exercises. Ends the selection if its exercise or copy is
   * no longer listed.
   *
   * @returns {Promise<object[]|null>} the exercises, or null if the list couldn't be loaded
   */
  self.refresh = async function () {
    if (!self.available) return null;
    const seq = ++refreshSeq;
    self.loading(true);
    try {
      const token = await getToken();
      const list = await listExercises({ host, token });
      if (seq !== refreshSeq) return self.exercises();

      const rows = list
        .map((e) => ({ ...e, label: exerciseLabel(e) }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      self.exercises(rows);
      self.loaded(true);
      self.refused(false);
      setMessage(rows.length ? '' : `No exercises are running on ${self.environmentLabel} right now.`);

      const selection = self.selection();
      const showing = selection ? rows.find((e) => e.exerciseId === selection.exerciseId) : null;
      if (selection && !(showing && showing.copies.some((c) => c.copyId === selection.copyId))) {
        self.stop('ended');
      }

      const chosen =
        rows.find((e) => e.exerciseId === self.chosenExerciseId()) ||
        (self.selection() ? showing : null) ||
        (rows.length === 1 ? rows[0] : null);
      self.chosenExerciseId(chosen ? chosen.exerciseId : undefined);
      const copyId = self.chosenCopyId();
      if (!chosen || !chosen.copies.some((c) => c.copyId === copyId)) self.chosenCopyId(defaultCopyId(chosen));
      return rows;
    } catch (err) {
      if (seq !== refreshSeq) return self.exercises();
      if (isSimulationUnavailable(err)) {
        self.exercises([]);
        self.loaded(true);
        self.refused(true);
        setMessage(
          `The CADence exercise service didn't accept your ${self.environmentLabel} sign-in, so simulated assets ` +
            `aren't available. Reload Beacon and try again.`,
          true,
        );
        if (self.active()) self.stop('unavailable');
      } else {
        console.error('[simulated-exercise] Failed to load exercises:', err);
        setMessage("Couldn't load the exercise list. Check your connection and try again.", true);
      }
      return null;
    } finally {
      if (seq === refreshSeq) self.loading(false);
    }
  };

  /** Show the chosen exercise copy in place of the real radio feed. */
  self.show = function () {
    if (!self.canShow()) return;
    const exercise = self.chosenExercise();
    const copy = exercise.copies.find((c) => c.copyId === self.chosenCopyId());
    setMessage('');
    setSelection({
      exerciseId: exercise.exerciseId,
      copyId: copy.copyId,
      exerciseName: exercise.name,
      copyName: copy.participantHqName,
      mode: exercise.mode,
      participantHqId: copy.participantHqId,
      copies: copyList(exercise.copies),
      selectedAt: Date.now(),
    });
  };

  /**
   * Back to the live feed. `reason` is 'user', 'ended' (the exercise finished
   * or its copy went away) or 'unavailable' (the backend refused the sign-in).
   * The last two weren't the user's doing, so they put up the banner (see
   * notice above) saying why the map changed.
   */
  self.stop = function (reason = 'user') {
    const selection = self.selection();
    if (!selection) return;
    setSelection(null);
    if (reason !== 'ended' && reason !== 'unavailable') return;
    const label = simulationLabel(selection);
    self.notice({ reason, label });
    // Also say it in the picker, which may be what found out (refresh()
    // has already shown why for 'unavailable').
    if (reason === 'ended') setMessage(`${label} has ended. Now showing live asset locations.`);
  };

  // For click bindings: Knockout passes ($data, event), which mustn't land in `reason`.
  self.stopFromPicker = function () {
    self.stop('user');
  };

  let verifying = null;

  /**
   * After a feed response: remember how many simulated assets came back, and
   * when there were none, check the exercise is still listed. An empty feed
   * is what the backend sends once an exercise has ended, and also before a
   * running one first publishes positions; only the first case ends the mode.
   *
   * @param {number} count  simulated (radio) assets in the response
   */
  self.positionsReceived = function (count) {
    self.assetCount(count);
    if (count === 0) self.verifyStillRunning();
  };

  /** @returns {Promise<boolean>} whether a selection is still active afterwards */
  self.verifyStillRunning = function () {
    if (!self.active()) return Promise.resolve(false);
    if (!verifying) {
      verifying = self.refresh().finally(() => {
        verifying = null;
      });
    }
    return verifying.then(() => self.active());
  };

  /** Rule for components/alerts.js: a reminder on the map while simulated assets are shown. */
  self.alertRules = function () {
    if (!self.active()) return [];
    return [
      {
        id: 'simulated-exercise',
        level: 'info',
        title: 'Simulated exercise assets',
        active: true,
        count: self.assetCount(),
        items: [
          { id: 'change', label: `${escapeHtml(self.activeLabel())} (change)` },
          { id: 'stop', label: 'Stop and show real radio positions' },
        ],
        onClick: (id) => {
          if (id === 'stop') self.stop('user');
          else if (id === 'change' && typeof openPicker === 'function') openPicker();
        },
      },
    ];
  };
}
