/*
  Feature: callsign checks (radio-check / welfare timers).

  A panel in the right-hand sidebar, under the outstanding actions (so it's in the operator's
  view). Watch a callsign and it shows how long since
  that callsign was last heard in the loaded log (matched loosely, like LAD
  matches assets to teams: "PAR 56 Team", "par56 (PSN)" and "PAR56T" all count
  for PAR56; typing a callsign picks up the known team's own name), turning amber then red as the
  expected contact interval runs out; a newly overdue callsign also raises a
  browser notification (when notifications are allowed). Click a callsign to
  start an entry for it. Based only on the entries loaded in the log below, so
  a watched callsign not heard inside the log window shows "not heard".

  Roll back: switch it off in Settings > Experimental features, or delete this
  file, lib/callsignChecks.js and styles/pages/radio-features/callsign-checks.css.
*/
import '../../../../styles/pages/radio-features/callsign-checks.css';
import {
  normaliseCallsign,
  resolveWatchName,
  buildCheckRows,
  planCallsignNotifications,
  formatMinutes,
  formatSince,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_INTERVAL_OPTIONS,
  normaliseIntervals,
  parseIntervalInput,
  pickInterval,
} from '../lib/callsignChecks.js';

const STORAGE_KEY = 'lighthouseRadioCallsignChecks';

function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const watched = Array.isArray(parsed?.watched) ? parsed.watched.map(normaliseCallsign).filter(Boolean) : [];
    const intervals = normaliseIntervals(parsed?.intervals);
    // the selected period is only remembered once the operator has actually chosen one, so the default
    // (every 2 hrs) applies until then
    const chosen = parsed?.intervalChosen === true ? parsed.intervalMinutes : DEFAULT_INTERVAL_MINUTES;
    return { watched: [...new Set(watched)], intervals, intervalMinutes: pickInterval(chosen, intervals), intervalChosen: parsed?.intervalChosen === true };
  } catch (err) {
    return { watched: [], intervals: [...DEFAULT_INTERVAL_OPTIONS], intervalMinutes: DEFAULT_INTERVAL_MINUTES, intervalChosen: false };
  }
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    // not remembered -- harmless
  }
}

const STATE_LABELS = { overdue: 'Overdue', none: 'Not heard', due: 'Due soon', ok: 'OK' };

export const feature = {
  key: 'callsign-checks',
  label: 'Callsign checks',
  description: 'Watch callsigns and flag any not heard from within the expected interval.',
  icon: 'fa-stopwatch',

  install(vm, { ko, enabled, mount }) {
    const initial = loadSettings();
    const watched = ko.observableArray(initial.watched);
    const intervals = ko.observableArray(initial.intervals); // minutes -- the "expect contact every" choices
    const intervalMinutes = ko.observable(initial.intervalMinutes);
    const addInput = ko.observable('');
    let intervalChosen = initial.intervalChosen;

    const persist = () => saveSettings({ watched: watched(), intervals: intervals(), intervalMinutes: intervalMinutes(), intervalChosen });
    watched.subscribe(persist);
    intervals.subscribe(persist);
    intervalMinutes.subscribe(() => {
      intervalChosen = true;
      persist();
    });
    // taking away the selected period moves the selection to one that is still offered
    intervals.subscribe((list) => {
      const next = pickInterval(intervalMinutes(), list);
      if (next !== intervalMinutes()) intervalMinutes(next);
    });

    const model = {
      enabled,
      intervalOptions: ko.pureComputed(() => intervals().map((minutes) => ({ minutes, label: formatMinutes(minutes) }))),
      intervalMinutes,
      addInput,
    };

    // ---- settings: which periods the "Expect contact every" list offers ----
    model.newPeriodAmount = ko.observable('');
    model.newPeriodUnit = ko.observable('mins');
    model.periodUnits = ['mins', 'hrs'];
    model.periodError = ko.observable('');
    model.addPeriod = () => {
      const parsed = parseIntervalInput(model.newPeriodAmount(), model.newPeriodUnit());
      if (parsed.error) {
        model.periodError(parsed.error);
        return;
      }
      if (intervals().includes(parsed.minutes)) {
        model.periodError(`${formatMinutes(parsed.minutes)} is already in the list.`);
        return;
      }
      model.periodError('');
      intervals(normaliseIntervals([...intervals(), parsed.minutes]));
      model.newPeriodAmount('');
    };
    model.onPeriodKeydown = (_data, event) => {
      if (event.key === 'Enter') {
        model.addPeriod();
        return false;
      }
      return true;
    };
    model.removePeriod = (option) => {
      if (intervals().length <= 1) {
        model.periodError('Keep at least one period.');
        return;
      }
      model.periodError('');
      intervals(intervals().filter((m) => m !== option.minutes));
    };
    model.resetPeriods = () => {
      model.periodError('');
      intervals([...DEFAULT_INTERVAL_OPTIONS]);
    };

    // what the log below currently holds, as callsign + time
    const logged = ko.pureComputed(() => vm.entries().map((entry) => ({ callsign: entry.subject(), at: entry.timeLogged() || entry.createdOn() })));

    const built = ko.pureComputed(() => {
      const now = vm.uiClockTick(); // re-evaluate as time passes, not only when entries change
      return buildCheckRows({ entries: logged(), watched: watched(), intervalMinutes: intervalMinutes(), now });
    });

    // known team callsigns, offered while typing a callsign to watch
    model.teamOptions = ko.pureComputed(() => (vm.knownTeams ? vm.knownTeams().map((t) => t.Callsign).filter(Boolean) : []));
    const addWatched = (callsign) => {
      const resolved = resolveWatchName(callsign, vm.knownTeams ? vm.knownTeams() : []);
      if (resolved && !watched().includes(resolved)) watched.push(resolved);
    };

    const focusMessage = () => document.getElementById('radioMessageInput')?.focus();
    const startEntryFor = (callsign) => {
      vm.callsignInput(callsign);
      focusMessage();
    };

    model.watchedRows = ko.pureComputed(() =>
      built().watched.map((row) => ({
        callsign: row.callsign,
        state: row.state,
        stateLabel: STATE_LABELS[row.state],
        detail:
          row.lastMs == null
            ? 'not heard in the loaded log'
            : `heard ${formatSince(row.lastMs, vm.uiClockTick())}${row.heardAs ? ` as "${row.heardAs}"` : ''}`,
        overdueBy: row.state === 'overdue' && row.minutesOverdue > 0 ? `+${formatMinutes(row.minutesOverdue)}` : '',
        start: () => startEntryFor(row.callsign),
        unwatch: () => watched.remove(row.callsign),
      })),
    );
    model.recentRows = ko.pureComputed(() =>
      built().recent.map((row) => ({
        callsign: row.callsign,
        detail: formatSince(row.lastMs, vm.uiClockTick()),
        watch: () => addWatched(row.callsign),
      })),
    );
    model.overdueCount = ko.pureComputed(() => built().overdueCount);
    model.hasWatched = ko.pureComputed(() => watched().length > 0);
    model.watchedCount = ko.pureComputed(() => watched().length);
    model.clearWatched = () => watched.removeAll();
    model.hasRecent = ko.pureComputed(() => model.recentRows().length > 0);

    model.addFromInput = () => {
      addWatched(addInput());
      addInput('');
    };
    model.onAddKeydown = (_data, event) => {
      if (event.key === 'Enter') {
        model.addFromInput();
        return false;
      }
      return true;
    };

    // An alert (banner, chime, desktop notification) when a watched callsign goes overdue, repeated every N minutes
    // (the Notifications tab's "repeat" setting) while it is still unheard and unacknowledged
    // -- dismiss the banner / click the notification to acknowledge. Whatever is already overdue when the log first
    // loads is treated as known, not announced.
    let notifyState = { last: new Map(), acknowledged: new Set() };
    let primed = false;
    built.subscribe((current) => {
      if (!enabled()) return;
      if (vm.beaconConnectionLost && vm.beaconConnectionLost()) return; // stale data: no alerts, and nothing recorded so they still come once it's back
      const repeatMinutes = vm.notifyRepeatMinutes ? vm.notifyRepeatMinutes() : 0;
      const plan = planCallsignNotifications(current.watched, notifyState, repeatMinutes, Date.now());
      notifyState = plan.state;
      if (!primed) {
        primed = vm.entries().length > 0;
        return;
      }
      // banners for callsigns that are no longer overdue (heard again, unwatched) go away
      vm.retainAlerts?.('check-', new Set(current.watched.filter((r) => r.state === 'overdue').map((r) => `check-${r.callsign}|${r.lastMs}`)));
      if (!vm.raiseAlert) return;
      plan.toNotify.forEach(({ row: r, key, repeat }) => {
        const heard = r.lastMs == null ? 'not heard' : `last heard ${formatMinutes(r.minutesSince)} ago`;
        // banner + chime + desktop notification, as the console's own alerts (see RadioConsoleViewModel.js)
        vm.raiseAlert({
          key: `check-${key}`,
          severity: 'overdue',
          title: repeat ? 'Radio check STILL overdue' : 'Radio check overdue',
          body: `${r.callsign} -- ${heard} (expected every ${formatMinutes(intervalMinutes())})`,
          tag: `radio-check-${r.callsign}`,
          onAcknowledge: () => {
            notifyState = { ...notifyState, acknowledged: new Set([...notifyState.acknowledged, key]) };
          },
        });
      });
    });
    enabled.subscribe((on) => {
      if (!on) vm.retainAlerts?.('check-', new Set());
    });

    // Collapsible (not remembered -- always open on a fresh load, so an overdue callsign
    // can't hide behind a closed panel; the overdue count badge stays visible when collapsed)
    model.collapsed = ko.observable(false);
    model.toggleCollapsed = () => model.collapsed(!model.collapsed());

    vm.callsignChecks = model;

    mount(
      'settings-body-end',
      `
<div class="radio-settings-section" data-bind="visible: callsignChecks.enabled">
  <h6>Expected contact periods</h6>
  <p class="radio-settings-note">The choices in the panel's "Expect contact every" list (default every 2 hrs). Add your own, or remove any you don't use.</p>
  <div class="radio-period-chips" data-bind="foreach: callsignChecks.intervalOptions">
    <span class="radio-period-chip">
      <span data-bind="text: label"></span>
      <button type="button" class="radio-period-remove" data-bind="click: $root.callsignChecks.removePeriod" title="Remove this period" aria-label="Remove this period"><i class="fas fa-times"></i></button>
    </span>
  </div>
  <div class="radio-period-add">
    <input type="number" min="1" step="1" class="form-control" placeholder="e.g. 45" aria-label="Period length" data-bind="textInput: callsignChecks.newPeriodAmount, event: { keydown: callsignChecks.onPeriodKeydown }">
    <select class="form-control" aria-label="Unit" data-bind="options: callsignChecks.periodUnits, value: callsignChecks.newPeriodUnit"></select>
    <button type="button" class="btn btn-secondary btn-sm" data-bind="click: callsignChecks.addPeriod"><i class="fas fa-plus"></i> Add period</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" data-bind="click: callsignChecks.resetPeriods">Reset to defaults</button>
  </div>
  <div class="radio-submit-error" data-bind="text: callsignChecks.periodError, visible: callsignChecks.periodError"></div>
</div>`,
    );

    mount(
      'sidebar-after-actions',
      `
<section class="radio-callsign-checks" data-bind="visible: callsignChecks.enabled" aria-label="Callsign checks">
  <!-- ko with: callsignChecks -->
  <div class="radio-checks-header">
    <h3>
      <i class="fas fa-stopwatch"></i> Callsign checks
      <span class="radio-checks-overdue-count" data-bind="text: overdueCount, visible: overdueCount() > 0" title="Overdue callsigns"></span>
    </h3>
    <button type="button" class="radio-icon-btn radio-checks-toggle" data-bind="click: toggleCollapsed" aria-label="Show or hide callsign checks" title="Show/hide callsign checks">
      <i class="fas" data-bind="css: { 'fa-chevron-down': collapsed, 'fa-chevron-up': !collapsed() }"></i>
    </button>
  </div>

  <!-- ko ifnot: collapsed -->
  <div class="radio-checks-interval-row">
    <label class="radio-checks-interval-label" for="radioChecksInterval">Expect contact every</label>
    <select id="radioChecksInterval" class="form-control radio-checks-interval" data-bind="options: intervalOptions, optionsText: 'label', optionsValue: 'minutes', value: intervalMinutes"></select>
  </div>

  <div class="radio-checks-add">
    <input type="text" class="form-control radio-checks-add-input" placeholder="Watch a callsign&hellip;" autocomplete="off" list="radioChecksTeams" data-bind="textInput: addInput, event: { keydown: onAddKeydown }">
    <datalist id="radioChecksTeams" data-bind="foreach: teamOptions"><option data-bind="value: $data"></option></datalist>
    <button type="button" class="btn btn-secondary btn-sm" data-bind="click: addFromInput">Watch</button>
  </div>

  <div class="radio-checks-listhead" data-bind="visible: hasWatched">
    <span>Watching <span data-bind="text: watchedCount"></span></span>
    <button type="button" class="radio-checks-clear" data-bind="click: clearWatched" title="Stop watching every callsign">Clear all</button>
  </div>
  <ul class="radio-checks-list" data-bind="foreach: watchedRows">
    <li class="radio-checks-row" data-bind="css: 'radio-checks-' + state">
      <button type="button" class="radio-checks-callsign" data-bind="click: start, text: callsign" title="Start an entry for this callsign"></button>
      <span class="radio-checks-pill" data-bind="text: stateLabel"></span>
      <button type="button" class="radio-checks-remove" data-bind="click: unwatch" title="Stop watching" aria-label="Stop watching"><i class="fas fa-times"></i></button>
      <span class="radio-checks-detail" data-bind="text: detail"></span>
      <span class="radio-checks-over" data-bind="text: overdueBy, visible: overdueBy"></span>
    </li>
  </ul>
  <div class="radio-checks-empty" data-bind="visible: !hasWatched()">No callsigns watched yet. Type one above, or pick one that was recently heard.</div>

  <div class="radio-checks-recent" data-bind="visible: hasRecent">
    <div class="radio-checks-recent-title">Recently heard</div>
    <div class="radio-checks-chips" data-bind="foreach: recentRows">
      <button type="button" class="radio-checks-chip" data-bind="click: watch" title="Watch this callsign">
        <i class="fas fa-plus"></i> <span data-bind="text: callsign"></span> <small data-bind="text: detail"></small>
      </button>
    </div>
  </div>
  <!-- /ko -->
  <!-- /ko -->
</section>`,
    );
  },
};
