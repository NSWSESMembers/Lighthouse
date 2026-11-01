/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';
import {
  simulationEnvironment,
  simulationLabel,
  sameSimulation,
  selectionStatus,
} from '../../../shared/cadenceSimulation.js';
import { sharedChoice } from '../../../shared/cadenceSimulationShare.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Exercise and HQ names come from whoever set the exercise up, and the map
// alert overlay renders raw HTML, so escape them on the way in there. (The
// ended banner binds them with `text:`, which needs no escaping.)
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * CADence simulated exercises in LAD (Train and Test Beacon only). The
 * exercise is chosen on Lighthouse's CADence Simulated Exercise page and
 * shared through chrome.storage.session (see shared/cadenceSimulationShare.js);
 * LAD follows that choice. While a copy is chosen, the page passes
 * feedSelection() to BeaconClient.asset.filter so the radio feed comes from
 * the exercise.
 *
 * @param {object} deps
 * @param {string} deps.host  Beacon API host (params.host); decides availability
 * @param {() => Promise<string>} deps.getToken  current Beacon bearer token
 * @param {() => Promise<string|null>} [deps.refreshToken]  the newest Beacon token, asked for after the
 *   backend refuses one (see feedRequest in shared/cadenceSimulation.js)
 * @param {{watch: Function, stop: Function, end: Function}|null} [deps.share]  the shared choice for this
 *   environment; defaults to chrome.storage.session (sharedChoice), null to follow nothing
 * @param {(selection: object|null) => void} [deps.onSelectionChange]  refetch assets
 * @param {() => void} [deps.openPage]  open the CADence Simulated Exercise page (the map alert's
 *   "change" item and the ended banner's link)
 */
export function SimulatedExerciseVM(deps = {}) {
  const self = this;
  const { host, getToken, refreshToken, onSelectionChange, openPage } = deps;
  const environment = simulationEnvironment(host);
  const share = deps.share !== undefined ? deps.share : environment ? sharedChoice(environment.env) : null;

  self.available = !!environment;
  self.environmentLabel = environment ? environment.label : '';

  // ---- Current selection (what the map shows) ----------------------------

  self.selection = ko.observable(null);
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
    self.notice()?.reason === 'ended' ? 'Choose another exercise' : 'Open Simulated Exercise',
  );

  // For click bindings: both ignore the ($data, event) Knockout passes.
  self.dismissNotice = function () {
    self.notice(null);
  };
  // The banner's link. Opening the page counts as having seen the banner.
  self.chooseAnotherExercise = function () {
    self.notice(null);
    if (typeof openPage === 'function') openPage();
  };

  function setSelection(selection, { refetch = true } = {}) {
    self.selection(selection);
    self.assetCount(0);
    self.generation(self.generation() + 1);
    // Showing an exercise again makes an earlier "has ended" banner stale.
    if (selection) self.notice(null);
    if (refetch && typeof onSelectionChange === 'function') onSelectionChange(selection);
  }

  // ---- Following the shared choice ----------------------------------------
  //
  // The first report is the choice already made when LAD opened. LAD's own
  // first asset fetch waits for it (see `ready`) and reads it, so it doesn't
  // start another fetch. After that, a change made on the Simulated Exercise
  // page, in another LAD tab or on a Beacon page refetches the assets.

  let resolveReady;
  /** Resolves once the shared choice has been read, so the first asset fetch uses it. */
  self.ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  let firstReport = true;
  function follow({ selection, ended }) {
    const refetch = !firstReport;
    firstReport = false;
    const showing = self.selection();
    if (selection) {
      if (!sameSimulation(selection, showing)) setSelection(selection, { refetch });
      else self.selection(selection); // same copy; keep the latest names
    } else if (showing) {
      setSelection(null, { refetch });
      // It ended on its own, noticed here or anywhere else: say why.
      if (ended && sameSimulation(ended.selection, showing)) {
        self.notice({ reason: ended.reason, label: simulationLabel(showing) });
      }
    }
    resolveReady();
  }

  if (share) {
    try {
      share.watch(follow);
    } catch (err) {
      console.warn('[simulated-exercise] Could not follow the chosen exercise:', err);
      resolveReady();
    }
  } else {
    resolveReady();
  }

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

  /**
   * Back to live positions everywhere, because the user stopped from LAD
   * (the map alert's "stop" item).
   */
  self.stop = function () {
    if (!self.selection()) return;
    setSelection(null);
    if (share) {
      Promise.resolve()
        .then(() => share.stop())
        .catch((err) => console.warn('[simulated-exercise] Could not stop the exercise everywhere:', err));
    }
  };

  /**
   * The exercise has ended ('ended') or the backend refused the sign-in
   * ('unavailable'), found out here. LAD goes back to live positions straight
   * away and puts up the banner; recording it in the shared choice sends
   * everything else back too.
   *
   * @param {'ended'|'unavailable'} reason
   * @returns {Promise<void>}
   */
  self.endHere = async function (reason) {
    const selection = self.selection();
    if (!selection) return;
    setSelection(null);
    self.notice({ reason, label: simulationLabel(selection) });
    if (!share) return;
    try {
      await share.end(selection, reason);
    } catch (err) {
      console.warn('[simulated-exercise] Could not record that the exercise ended:', err);
    }
  };

  let verifying = null;

  /**
   * After a feed response: remember how many simulated assets came back, and
   * when there were none, check the exercise is still running. An empty feed
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
    const selection = self.selection();
    if (!selection) return Promise.resolve(false);
    if (!verifying) {
      verifying = (async () => {
        const token = await getToken();
        const status = await selectionStatus(selection, { host, token, refreshToken });
        // Leave it if the choice changed while the list was loading.
        if ((status === 'ended' || status === 'unavailable') && sameSimulation(self.selection(), selection)) {
          await self.endHere(status);
        }
      })()
        .catch((err) => console.warn("[simulated-exercise] Couldn't check the exercise is still running:", err))
        .finally(() => {
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
          if (id === 'stop') self.stop();
          else if (id === 'change' && typeof openPage === 'function') openPage();
        },
      },
    ];
  };
}
