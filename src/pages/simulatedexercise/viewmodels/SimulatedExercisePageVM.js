/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';
import moment from 'moment';
import {
  simulationEnvironment,
  listExercises,
  isSimulationUnavailable,
  exerciseDisplayName,
  simulationLabel,
  sameSimulation,
} from '../../../shared/cadenceSimulation.js';
import { sharedChoice, copyList } from '../../../shared/cadenceSimulationShare.js';

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

function listed(exercises, selection) {
  const exercise = exercises.find((e) => e.exerciseId === selection.exerciseId);
  return !!exercise && exercise.copies.some((c) => c.copyId === selection.copyId);
}

/**
 * The CADence Simulated Exercise page (pages/simulatedexercise.html, Train
 * and Test Beacon only). Lists the exercises running on this Beacon
 * environment and chooses the one LAD, the Nearest Asset Locations map on
 * Beacon's job page and the situational awareness map show in place of real
 * radio positions (see shared/cadenceSimulationShare.js). Nothing is sent to
 * the CADence backend until the page has a Beacon token, and nothing at all
 * off Train and Test Beacon.
 *
 * @param {object} deps
 * @param {string} deps.host  Beacon API host (params.host); decides availability
 * @param {string} [deps.hqId]  the user's current HQ id, to preselect their copy of a group exercise
 * @param {{watch: Function, choose: Function, stop: Function, end: Function}|null} [deps.share]  the shared
 *   choice for this environment; defaults to chrome.storage.session (sharedChoice)
 * @param {string} [deps.guideUrl]  the guide's page on the website
 * @param {() => Promise<string|null>} [deps.refreshToken]  the newest Beacon token, asked for after the
 *   backend refuses one (see feedRequest in shared/cadenceSimulation.js)
 */
export function SimulatedExercisePageVM(deps = {}) {
  const self = this;
  const { host, hqId } = deps;
  const environment = simulationEnvironment(host);
  const share = deps.share !== undefined ? deps.share : environment ? sharedChoice(environment.env) : null;

  self.available = !!environment;
  self.environmentLabel = environment ? environment.label : '';
  self.guideUrl = deps.guideUrl || '';
  self.pageTitle = self.available
    ? `CADence Simulated Exercise (${self.environmentLabel})`
    : 'CADence Simulated Exercise';

  // The radio join page of the CADence deployment this environment's exercise
  // list comes from, and its static QR code (relative to this page).
  self.radioUrl = environment ? environment.radioUrl : '';
  self.radioHost = environment ? new URL(environment.radioUrl).host : '';
  self.radioQrSrc = environment ? `../${environment.radioQr}` : '';

  let token = null;

  // ---- What Lighthouse shows now (the shared choice) ----------------------

  self.current = ko.observable(null);
  // { selection, reason: 'ended' | 'unavailable', endedAt } once the chosen
  // exercise ended, or its sign-in was refused, without the user stopping it.
  self.ended = ko.observable(null);
  self.active = ko.pureComputed(() => !!self.current());
  self.currentLabel = ko.pureComputed(() => simulationLabel(self.current()));
  self.endedVisible = ko.pureComputed(() => !self.active() && !!self.ended());
  self.endedIsWarning = ko.pureComputed(() => self.ended()?.reason === 'unavailable');
  // Shown in bold ahead of endedText. Plain text: the page binds it with `text:`.
  self.endedName = ko.pureComputed(() =>
    self.ended()?.reason === 'ended' ? simulationLabel(self.ended().selection) : '',
  );
  self.endedText = ko.pureComputed(() => {
    const ended = self.ended();
    if (!ended) return '';
    if (ended.reason === 'ended') return 'has ended, so Lighthouse went back to live asset locations.';
    return (
      `The CADence exercise service stopped accepting your ${self.environmentLabel} sign-in, so Lighthouse ` +
      'went back to live asset locations. Reload Beacon and try again.'
    );
  });

  // ---- Picker -----------------------------------------------------------

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
  // Nothing to pick until the list has loaded with something in it.
  self.pickerDisabled = ko.pureComputed(() => !self.loaded() || self.noExercises());
  self.exerciseCaption = ko.pureComputed(() => {
    if (!self.loaded()) return self.loading() ? 'Loading exercises…' : 'Waiting for your Beacon sign-in…';
    if (self.refused()) return 'Not available';
    return self.noExercises() ? 'No exercises running' : 'Choose an exercise…';
  });
  self.canShow = ko.pureComputed(() => {
    const exercise = self.chosenExercise();
    const copyId = self.chosenCopyId();
    if (!exercise || !copyId || !exercise.copies.some((c) => c.copyId === copyId)) return false;
    return !sameSimulation(self.current(), { exerciseId: exercise.exerciseId, copyId });
  });
  self.showButtonText = ko.pureComputed(() => (self.active() ? 'Switch to this exercise' : 'Show simulated assets'));

  // The copy to offer for an exercise: the only one, the one showing, or the
  // one for the user's own HQ. Otherwise the user picks.
  function defaultCopyId(exercise) {
    if (!exercise) return undefined;
    if (exercise.copies.length === 1) return exercise.copies[0].copyId;
    const current = self.current();
    if (current && current.exerciseId === exercise.exerciseId) {
      if (exercise.copies.some((c) => c.copyId === current.copyId)) return current.copyId;
    }
    const mine = hqId != null && hqId !== '' ? exercise.copies.find((c) => c.participantHqId === String(hqId)) : null;
    return mine ? mine.copyId : undefined;
  }

  self.chosenExerciseId.subscribe((exerciseId) => {
    const exercise = self.exercises().find((e) => e.exerciseId === exerciseId);
    const copyId = self.chosenCopyId();
    if (!exercise || !exercise.copies.some((c) => c.copyId === copyId)) {
      self.chosenCopyId(defaultCopyId(exercise));
    }
  });

  // Keep the picker on the exercise that's showing when the choice changes
  // elsewhere (LAD's map alert, or another tab of this page).
  function pickCurrent() {
    const current = self.current();
    if (!current) return;
    const exercise = self.exercises().find((e) => e.exerciseId === current.exerciseId);
    if (!exercise || !exercise.copies.some((c) => c.copyId === current.copyId)) return;
    self.chosenExerciseId(exercise.exerciseId);
    self.chosenCopyId(current.copyId);
  }

  let seenEnded = null; // JSON of the last ended record followed
  function follow({ selection, ended }) {
    const endedJson = ended ? JSON.stringify(ended) : null;
    const newlyEnded = !!ended && endedJson !== seenEnded;
    seenEnded = endedJson;
    self.current(selection);
    self.ended(ended);
    pickCurrent();
    // LAD or the situational awareness map noticed the exercise ended: the
    // list on show still has it, so load it again. (When this page noticed,
    // its own refresh is still running and has the new list.)
    if (newlyEnded && token && !self.loading()) self.refresh();
  }

  if (share) {
    try {
      share.watch(follow);
    } catch (err) {
      console.warn('[simulated-exercise] Could not read the chosen exercise:', err);
    }
  }

  async function endShared(selection, reason) {
    if (!share) return;
    try {
      await share.end(selection, reason);
    } catch (err) {
      console.warn('[simulated-exercise] Could not record that the exercise ended:', err);
    }
  }

  let refreshSeq = 0;

  /**
   * Load the exercises running on this Beacon environment. Also how the page
   * notices that the exercise everything shows has ended: everything then
   * goes back to live positions.
   *
   * @returns {Promise<object[]|null>} the exercises, or null if the list couldn't be loaded
   */
  self.refresh = async function () {
    if (!self.available || !token) return null;
    const seq = ++refreshSeq;
    self.loading(true);
    try {
      const list = await listExercises({ host, token, refreshToken: deps.refreshToken });
      if (seq !== refreshSeq) return self.exercises();

      const rows = list
        .map((e) => ({ ...e, label: exerciseLabel(e) }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      self.exercises(rows);
      self.loaded(true);
      self.refused(false);
      setMessage(rows.length ? '' : `No exercises are running on ${self.environmentLabel} right now.`);

      const current = self.current();
      const showing = current && listed(rows, current) ? current : null;
      if (current && !showing) await endShared(current, 'ended');

      const chosen =
        rows.find((e) => e.exerciseId === self.chosenExerciseId()) ||
        (showing ? rows.find((e) => e.exerciseId === showing.exerciseId) : null) ||
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
        const current = self.current();
        if (current) await endShared(current, 'unavailable');
      } else {
        console.error('[simulated-exercise] Failed to load exercises:', err);
        setMessage("Couldn't load the exercise list. Check your connection and try again.", true);
      }
      return null;
    } finally {
      if (seq === refreshSeq) self.loading(false);
    }
  };

  /** The Beacon token, from the page's token watcher. The first one loads the list. */
  self.setToken = function (value) {
    const first = !token;
    token = value || null;
    if (first && token) self.refresh();
  };

  /** The tab is showing again: check the list, so an ended exercise is noticed. */
  self.pageShown = function () {
    if (token && !self.loading()) self.refresh();
  };

  /** Show the chosen exercise copy everywhere, in place of real radio positions. */
  self.show = async function () {
    if (!self.canShow() || !share) return;
    const exercise = self.chosenExercise();
    const copy = exercise.copies.find((c) => c.copyId === self.chosenCopyId());
    const selection = {
      exerciseId: exercise.exerciseId,
      copyId: copy.copyId,
      exerciseName: exercise.name,
      copyName: copy.participantHqName,
      mode: exercise.mode,
      participantHqId: copy.participantHqId,
      copies: copyList(exercise.copies),
      selectedAt: Date.now(),
    };
    setMessage('');
    try {
      await share.choose(selection);
      // The watcher reports it too; showing it now keeps the page in step.
      follow({ selection, ended: null });
    } catch (err) {
      console.error('[simulated-exercise] Could not save the choice:', err);
      setMessage("Couldn't show that exercise. Reload this page and try again.", true);
    }
  };

  /** Back to real radio positions everywhere. For a click binding: ignores what Knockout passes. */
  self.stop = async function () {
    if (!self.current() || !share) return;
    setMessage('');
    try {
      await share.stop();
      follow({ selection: null, ended: null });
    } catch (err) {
      console.error('[simulated-exercise] Could not stop the exercise:', err);
      setMessage("Couldn't go back to real radio positions. Reload this page and try again.", true);
    }
  };
}
