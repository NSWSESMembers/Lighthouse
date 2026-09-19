import * as operationslog from '../../../shared/BeaconClient/operationslog.js';
import * as team from '../../../shared/BeaconClient/team.js';
import * as asset from '../../../shared/BeaconClient/asset.js';
import * as job from '../../../shared/BeaconClient/job.js';
import * as tags from '../../../shared/BeaconClient/tags.js';
import * as unit from '../../../shared/BeaconClient/unit.js';
import * as entities from '../../../shared/BeaconClient/entities.js';
import * as talkgroups from '../../../shared/BeaconClient/talkgroups.js';
import { BeaconApiError } from '../../../shared/BeaconClient/core/request.js';
import { OpsLogEntry } from '../../tasking/models/OpsLogEntry.js';
import { getSubject, connectionStatus, getConnectionStatus } from '../../tasking/signalr/connection.js';
import { createLiveLogBuffer } from '../lib/liveLogBuffer.js';
import { entryMatchesScope } from '../lib/mergeLogEntries.js';
import { suggestCallsigns } from '../lib/callsignSuggestions.js';
import { createEntityPicker } from '../lib/entityPicker.js';
import { rankJobSuggestions } from '../lib/jobSuggestions.js';
import { classifyReminderSeverity, DUE_SOON_WINDOW_OPTIONS } from '../lib/reminders.js';
import { REMINDER_PRESETS, resolveReminderTime } from '../lib/reminderPresets.js';
import { buildRadioLogPayload, validateRadioLogDraft } from '../lib/radioLogPayload.js';
import { debounce } from '../../tasking/utils/debounce.js';
import { relativeTimeFromNow } from '../lib/relativeTime.js';
import { formatLogRowTime } from '../lib/logRowTime.js';
import { formatRelativeDue } from '../lib/relativeDueTime.js';
import { resolveIsDark } from '../lib/theme.js';
import { createFeatureRegistry } from '../lib/features.js';
import { emptyNotifiedState, acknowledgeAction, planReminderNotifications } from '../lib/reminderNotifications.js';
import { upsertAlert, retainAlerts, chimeNotes } from '../lib/alertStack.js';
import { assessConnection } from '../lib/connectionHealth.js';
import { friendlyReason } from '../../../shared/friendlyError.js';
import { installFeatures } from '../features/index.js';

const RADIO_TAG_GROUP_ID = 3; // "Contact Methods" -- see OpsLogModalVM.js's openForRadioLog
const POLL_INTERVAL_MS = 30000;
const REMINDER_TICK_MS = 15000; // a reminder can become due from time passing alone, with no new data arriving
const LOG_PAGE_SIZE = 100;
const THEME_STORAGE_KEY = 'lighthouseRadioConsoleTheme';
const HQ_STORAGE_KEY = 'lh_radioconsole_hq'; // the list's filter HQ
const LOGGING_HQ_STORAGE_KEY = 'lh_radioconsole_logging_hq'; // the HQ new entries are logged against
// One JSON blob for session-scoped settings (sessionStorage, not
// localStorage -- these are meant to reset between sessions, unlike the
// HQ/theme keys above) -- same "single key, one object" convention as
// LAD/tasking's own Config.js (its STORAGE_KEY, 'lh-taskingConfig'),
// rather than a new scattered top-level key per setting.
const SESSION_SETTINGS_STORAGE_KEY = 'lh-radio-console-settings';
const DEFAULT_DUE_SOON_WINDOW_MINUTES = 15;
const NOTIFY_PREFS_STORAGE_KEY = 'lighthouseRadioNotifyPrefs';
const MAX_ALERTS_SHOWN = 4;
const REPEAT_OPTIONS = [
  { minutes: 0, label: 'Off' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 10, label: '10 minutes' },
  { minutes: 15, label: '15 minutes' },
];

/**
 * @param {object} params
 * @param {string} params.host
 * @param {string} [params.source]  Beacon web origin, for linking back to a record's own page
 * @param {string} [params.userId]
 * @param {string} [params.personId]  the logged-in user's Beacon Person id
 * @param {boolean} [params.signalrExpected]  the page was opened with a live-feed (SignalR) address
 * @param {string|number} [params.hq]  the HQ Lighthouse was launched with -- used as the entry's HQ, fixed and shown separately from the list's own scope filter
 * @param {() => Promise<string>} params.getToken
 * @param {ko: any} params.ko
 */
export function createRadioConsoleViewModel({ host, source, userId, personId, signalrExpected = false, hq, getToken, ko }) {
  const self = {};
  self.personId = personId || null;

  // What optional features (src/pages/radio/features/) listen to. Topics:
  //   'entriesLoaded'   -- raw entries from a list load (initial load, filter change, "load more")
  //   'entriesReceived' -- raw entries that arrived live (SignalR push or background poll), before any pause gating
  //   'entryCreated'    -- the raw entry this console just created
  self.events = new ko.subscribable();
  const buffer = createLiveLogBuffer();
  const entriesById = new Map(); // id -> OpsLogEntry KO instance (stable identity across refreshes)

  // A single HQ/unit per picker, not a multi-select list. Each defaults to
  // whichever HQ Lighthouse launched with, but a value persisted from a
  // previous session (the operator changed it in Settings) takes
  // precedence -- see resolveInitialId()/persistId() below. `null` is a
  // valid, deliberate state for either picker, not just "not resolved yet".
  function makeHqPicker(storageKey, emptyName) {
    const initialId = resolveInitialId(storageKey, hq);
    return createEntityPicker({
      ko,
      debounce,
      searchEntities: entities.search,
      resolveEntity: unit.getName,
      ctx,
      initialId,
      initialName: initialId ? `HQ ${initialId}` : emptyName,
      onChange: (id) => persistId(storageKey, id),
    });
  }

  // ---- entry context (the "logging HQ" -- the HQ every new entry is
  // logged against, distinct from the list's own filter HQ below).
  self.loggingHqPicker = makeHqPicker(LOGGING_HQ_STORAGE_KEY, 'Unknown HQ');

  // ---- list scope/filters ----
  // No HQ selected means unscoped (searchLog() sends no EntityIds filter at
  // all -- see operationslog.js), matching how tasking.html's own HQ filters
  // treat "nothing selected" as "show everything", not "show nothing".
  self.filterHqPicker = makeHqPicker(HQ_STORAGE_KEY, '');
  self.listEntityIds = ko.pureComputed(() => (self.filterHqPicker.id() ? [self.filterHqPicker.id()] : []));
  self.windowStartInput = ko.observable(toLocalDateTimeInputValue(new Date(Date.now() - 8 * 60 * 60 * 1000)));
  self.windowEndInput = ko.observable(''); // empty = open-ended / live
  self.jobIdFilter = ko.observable('');
  self.eventIdFilter = ko.observable('');
  self.textFilter = ko.observable('');
  self.radioTagOnly = ko.observable(true); // default scope: radio-tagged entries only
  self.radioTagId = ko.observable(null); // populated by loadRadioTag() before the first fetch

  // ---- list state ----
  self.entries = ko.observableArray();
  self.listLoading = ko.observable(false);
  self.listError = ko.observable('');
  self.listStale = ko.observable(false);
  self.lastRefreshAt = ko.observable(null);
  self.hasMore = ko.observable(false);
  self.connectionState = ko.observable(getConnectionStatus());
  self.paused = ko.observable(false);
  self.pendingCount = ko.observable(0);
  // Declared here (not down with the rest of the reminders/live-update
  // state) so lastRefreshDisplay below can depend on it -- ko.observable
  // assignments aren't hoisted, only the `self` reference is.
  self.uiClockTick = ko.observable(Date.now());
  self.timeDisplayMode = ko.observable('relative'); // 'absolute' | 'relative' -- Settings; defaults to "time ago"
  // {key, label} lists + a plain click handler per list, rather than native
  // radio inputs -- matches LAD/tasking.html's own Settings segmented
  // controls (its config.refreshPresets/pickRefreshPreset) exactly, and
  // avoids a `name` attribute collision concern across repeated groups.
  self.timeDisplayModeOptions = [
    { key: 'relative', label: 'Time ago' },
    { key: 'absolute', label: 'Absolute' },
  ];
  self.pickTimeDisplayMode = function (option) {
    self.timeDisplayMode(option.key);
  };

  // ---- live wall-clock (top-right header) ----
  // A dedicated 1s tick, separate from uiClockTick's 15s cadence -- that
  // interval is plenty for "N minutes ago" text staying fresh, but a
  // seconds-accurate clock display needs a full second's resolution.
  // Started immediately (not deferred to startLiveUpdates(), which only
  // runs once the initial fetches resolve) so the clock is live from the
  // moment the page loads, independent of network/auth state.
  self.liveClockTick = ko.observable(Date.now());
  const liveClockTimer = setInterval(() => self.liveClockTick(Date.now()), 1000);
  self.liveClockDisplay = ko.pureComputed(() => {
    const d = new Date(self.liveClockTick());
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });

  // Subscribed immediately (not deferred until startLiveUpdates(), which
  // only runs after the initial list/teams/tags fetches resolve) --
  // connectionStatus is a plain pub-sub Subject with no replay buffer, and
  // main.js starts the SignalR connection as soon as the token arrives, in
  // parallel with those fetches. A late subscription could miss the
  // 'connecting' -> 'connected' transition entirely and be stuck showing
  // 'disconnected' even once genuinely connected.
  connectionStatus.subscribe((status) => self.connectionState(status));

  // ---- is the connection to Beacon lost? (see lib/connectionHealth.js) ----
  // When it is: a full-page warning, the New Radio Log form is disabled and alerts are paused --
  // the data on screen is stale and an entry written now might not reach Beacon.
  self.refreshFailures = ko.observable(0); // consecutive failed list loads / polls
  self.browserOffline = ko.observable(typeof navigator !== 'undefined' && navigator.onLine === false); // DevTools' Offline / Wi-Fi off
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => self.browserOffline(true));
    window.addEventListener('online', () => {
      self.browserOffline(false);
      self.applyFilters(); // don't wait for the next poll to clear the warning
    });
  }
  self.initialLoadFailed = ko.observable(false); // the first load of the log failed and nothing has loaded since
  let everConnected = self.connectionState() === 'connected';
  let notConnectedSinceMs = self.connectionState() === 'connected' ? null : Date.now();
  self.connectionState.subscribe((state) => {
    if (state === 'connected') {
      everConnected = true;
      notConnectedSinceMs = null;
    } else if (notConnectedSinceMs === null) {
      notConnectedSinceMs = Date.now();
    }
    self.connectionCheckTick(Date.now());
  });
  self.connectionCheckTick = ko.observable(Date.now());
  const connectionCheckTimer = setInterval(() => self.connectionCheckTick(Date.now()), 3000); // grace periods pass with no other event

  self.connectionAssessment = ko.pureComputed(() =>
    assessConnection({
      signalrExpected,
      state: self.connectionState(),
      everConnected,
      notConnectedSinceMs,
      refreshFailures: self.refreshFailures(),
      initialLoadFailed: self.initialLoadFailed(),
      browserOffline: self.browserOffline(),
      nowMs: self.connectionCheckTick(),
    }),
  );
  self.beaconConnectionLost = ko.pureComputed(() => self.connectionAssessment().lost);
  self.connectionLostReasons = ko.pureComputed(() => self.connectionAssessment().reasons);
  // the header shows this, not the raw live-feed state: the feed can still say 'connected' for a while after the network drops
  self.connectionLabel = ko.pureComputed(() => (self.beaconConnectionLost() ? 'disconnected' : self.connectionState()));
  self.connectionOk = ko.pureComputed(() => !self.beaconConnectionLost() && self.connectionState() === 'connected');
  self.connectionLostSince = ko.observable(null); // when it was first noticed this time, for the dialog
  self.connectionDialogDismissed = ko.observable(false);
  self.showConnectionDialog = ko.pureComputed(() => self.beaconConnectionLost() && !self.connectionDialogDismissed());
  self.connectionLostSinceLabel = ko.pureComputed(() => (self.connectionLostSince() ? new Date(self.connectionLostSince()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''));
  self.beaconConnectionLost.subscribe((lost) => {
    self.connectionLostSince(lost ? Date.now() : null);
    if (!lost) self.connectionDialogDismissed(false); // the next loss shows the dialog again
  });
  self.dismissConnectionDialog = function () {
    self.connectionDialogDismissed(true);
  };
  self.showConnectionDetails = function () {
    self.connectionDialogDismissed(false);
  };
  self.retryConnectionNow = function () {
    self.applyFilters(); // a successful load clears the failure count
  };

  self.filteredEntries = ko.pureComputed(() => {
    const query = self.textFilter().trim().toLowerCase();
    if (!query) return self.entries();
    return self.entries().filter((e) => {
      return (e.subject() || '').toLowerCase().includes(query) || (e.text() || '').toLowerCase().includes(query);
    });
  });

  self.isTextFilterActive = ko.pureComputed(() => self.textFilter().trim().length > 0);

  // The header search collapses to an icon to save space -- expanded by
  // clicking it (which also focuses the input, via the hasFocus binding
  // below) and collapsed again on blur, unless there's an active filter to
  // keep visible so the operator can see/clear what's currently narrowing
  // the list.
  self.textFilterExpanded = ko.observable(false);
  self.showTextFilterInput = ko.pureComputed(() => self.textFilterExpanded() || self.isTextFilterActive());
  self.toggleTextFilter = function () {
    self.textFilterExpanded(true);
  };

  // Wrapped as {entry, time} rather than adding the mode/tick-dependent
  // time display straight onto each OpsLogEntry -- same reasoning as
  // outstandingActions below: knockout-secure-binding can't call a function
  // with arguments, and the display depends on view-model state (the
  // Settings mode toggle, the shared clock tick) that doesn't belong on the
  // entry itself.
  self.logRows = ko.pureComputed(() => {
    const now = self.uiClockTick();
    const mode = self.timeDisplayMode();
    return self.filteredEntries().map((entry) => ({ entry, time: formatLogRowTime(entry.timeLogged(), mode, now) }));
  });

  // The underlying "record" a radio log entry belongs to is its Job -- Ops
  // Log entries have no standalone page of their own in Beacon's web UI.
  // Exposed as a plain property (not a function taking the entry as an
  // argument) because knockout-secure-binding's data-bind parser can't call
  // a function with arguments -- the HTML instead does
  // `beaconSource + '/Jobs/' + jobId()` directly, guarded by `if: jobId`.
  self.beaconSource = source || null;

  // ---- theme (Settings: light/dark/system) ----
  // main.js applies a theme synchronously, before this view model exists,
  // straight from the same localStorage key -- so there's no flash of the
  // wrong theme while Knockout/the bundle are still loading. Reading it
  // again here just keeps Settings' radio group showing the truth.
  self.themeMode = ko.observable(readStoredThemeMode());
  self.themeModeOptions = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'System' },
  ];
  self.pickThemeMode = function (option) {
    self.themeMode(option.key);
  };
  self.systemPrefersDark = ko.observable(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
  );
  self.isDarkMode = ko.pureComputed(() => resolveIsDark(self.themeMode(), self.systemPrefersDark()));

  self.isDarkMode.subscribe((dark) => {
    if (typeof document !== 'undefined') document.body.classList.toggle('dark-mode', dark);
  });
  if (typeof document !== 'undefined') document.body.classList.toggle('dark-mode', self.isDarkMode());

  self.themeMode.subscribe((mode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      // localStorage unavailable (private browsing etc.) -- theme just won't persist across reloads
    }
  });

  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => self.systemPrefersDark(e.matches));
  }

  self.lastRefreshDisplay = ko.pureComputed(() => {
    self.uiClockTick(); // depend on the tick so "N minutes ago" stays fresh
    if (!self.lastRefreshAt()) return 'never';
    return self.timeDisplayMode() === 'relative' ? relativeTimeFromNow(self.lastRefreshAt(), self.uiClockTick()) : self.lastRefreshAt().toLocaleTimeString();
  });
  // Full precision, always -- the tooltip for whichever abbreviated form
  // lastRefreshDisplay is currently showing (relative or the seconds-less
  // toLocaleTimeString() above).
  self.lastRefreshTitle = ko.pureComputed(() => (self.lastRefreshAt() ? formatLocalDateTime(self.lastRefreshAt()) : ''));

  self.submitButtonLabel = ko.pureComputed(() => (self.submitting() ? 'Submitting…' : 'Submit'));

  async function ctx() {
    const token = await getToken();
    return { host, userId, token };
  }

  // The single source of truth for "what's currently in scope" -- used for
  // every fetch (applyFilters/loadMore/the background poll) *and* every
  // client-side live-entry scope check (entryMatchesScope, for SignalR
  // pushes and the just-submitted-entry check below). Keeping date bounds
  // here too, rather than only on the fetch calls, is what makes the poll
  // and SignalR paths respect a closed windowEndInput the same way a manual
  // fetch already does -- see mergeLogEntries.js's entryMatchesScope.
  function currentScope() {
    return {
      entityIds: self.listEntityIds(),
      jobIds: self.jobIdFilter().trim() ? [self.jobIdFilter().trim()] : [],
      eventIds: self.eventIdFilter().trim() ? [self.eventIdFilter().trim()] : [],
      tagIds: self.radioTagOnly() && self.radioTagId() ? [self.radioTagId()] : [],
      dateFrom: parseLocalDateTimeInputValue(self.windowStartInput()),
      dateTo: self.windowEndInput() ? parseLocalDateTimeInputValue(self.windowEndInput()) : undefined,
    };
  }

  function syncEntriesFromBuffer() {
    const raw = buffer.getDisplayed();
    const seen = new Set();
    let structuralChange = false;

    raw.forEach((r) => {
      seen.add(r.Id);
      const existing = entriesById.get(r.Id);
      if (existing) {
        existing.updateFromJson(r);
      } else {
        const created = new OpsLogEntry(r, {});
        // Console-local, not a Beacon field: Beacon has no persistent
        // "resolved" flag distinct from ActionRequired/ActionReminder (the
        // common resolve path clears both, so neither can be used to infer
        // resolution after the fact -- see confirmResolve). Sets this to
        // true only for entries resolved through this console in the
        // current session, matching the log table's own "just resolved"
        // highlight rather than claiming a historical record Beacon
        // doesn't actually expose.
        created.recentlyResolved = ko.observable(false);
        entriesById.set(r.Id, created);
        structuralChange = true;
      }
    });
    // drop rows no longer in the buffer (e.g. a filter/page change narrowed the set)
    for (const id of Array.from(entriesById.keys())) {
      if (!seen.has(id)) {
        entriesById.delete(id);
        structuralChange = true;
      }
    }

    if (structuralChange) {
      const sorted = raw.map((r) => entriesById.get(r.Id));
      self.entries(sorted);
    }
    self.pendingCount(buffer.pendingCount());
  }

  // ---- list fetching ----
  self.applyFilters = async function () {
    self.listLoading(true);
    self.listError('');
    try {
      const page = await operationslog.searchLog(currentScope(), { ...(await ctx()), pageSize: LOG_PAGE_SIZE, pageLimit: 1 });
      buffer.applyPage(page.results);
      syncEntriesFromBuffer();
      self.events.notifySubscribers(page.results, 'entriesLoaded');
      self.hasMore(page.results.length < page.totalItems);
      self.lastRefreshAt(new Date());
      self.listStale(false);
      self.refreshFailures(0);
      self.initialLoadFailed(false);
    } catch (err) {
      console.error('Radio console: failed to load ops log', err);
      self.refreshFailures(self.refreshFailures() + 1);
      if (!self.lastRefreshAt()) self.initialLoadFailed(true); // never loaded: show the full-page alert straight away
      self.listError(`Couldn't load the log. ${friendlyReason(err)}${self.entries().length ? ' Showing the last entries that loaded.' : ''}`);
      self.listStale(true);
      // deliberately do not clear self.entries() -- a failed refresh must
      // never blank out (or silently keep stale-looking-fresh) real data
    } finally {
      self.listLoading(false);
    }
  };

  self.loadMore = async function () {
    if (!self.hasMore() || self.listLoading()) return;
    self.listLoading(true);
    try {
      // Beacon has no cursor-based paging on this endpoint -- "load more"
      // re-requests with a larger page size covering everything seen so far
      // plus one more page, rather than an offset that could skip/duplicate
      // rows if new entries have landed in between.
      const widerPageSize = buffer.getDisplayed().length + LOG_PAGE_SIZE;
      const page = await operationslog.searchLog(currentScope(), { ...(await ctx()), pageSize: widerPageSize, pageLimit: 1 });
      buffer.applyPage(page.results);
      syncEntriesFromBuffer();
      self.events.notifySubscribers(page.results, 'entriesLoaded');
      self.hasMore(page.results.length < page.totalItems);
    } catch (err) {
      console.error('Radio console: failed to load more', err);
      self.listError(`Couldn't load more entries. ${friendlyReason(err)}`);
    } finally {
      self.listLoading(false);
    }
  };

  self.togglePause = function () {
    if (self.paused()) {
      buffer.resume();
      self.paused(false);
    } else {
      buffer.pause();
      self.paused(true);
    }
    syncEntriesFromBuffer();
  };

  self.jumpToLatest = function () {
    if (self.paused()) {
      buffer.resume();
      self.paused(false);
    }
    syncEntriesFromBuffer();
  };

  self.pauseButtonLabel = ko.pureComputed(() => (self.paused() ? `Resume (${self.pendingCount()} new)` : 'Pause live updates'));

  // ---- outstanding actions (from entries currently loaded above -- not a
  // separate, broader server query) -- the fixed panel at the top of the
  // log column. Only entries due soon or already overdue appear here
  // (classifyReminderSeverity's 'not-due' tier is filtered OUT, not just
  // coloured differently) -- an entry with no reminder, or one whose
  // reminder is further out than the window below, stays in the log list
  // only. This is what "how soon before due" in Settings actually
  // controls: narrowing/widening which entries qualify, not just their
  // colour once shown. Sorted most urgent first.
  // Wrapped as {entry, formattedReminder, isOverdue, ...} rather than
  // bound straight to the OpsLogEntry, so the panel never needs a
  // `date.toX()` method call or nested-property chain in its data-bind
  // (knockout-secure-binding can't call a function with arguments, and a
  // chain through a possibly-undefined field would throw rather than
  // degrade gracefully).
  const SEVERITY_RANK = { overdue: 0, 'due-soon': 1 };

  // Settings: how far ahead of its reminder an entry starts appearing in
  // the panel at all (as "due soon", yellow) rather than staying out of
  // it entirely -- see DUE_SOON_WINDOW_OPTIONS. Session-scoped
  // (sessionStorage), not remembered across a full session end like the
  // HQ/theme settings, since it's more a per-shift working preference
  // than a durable one.
  self.dueSoonWindowOptions = DUE_SOON_WINDOW_OPTIONS;
  self.dueSoonWindowMinutes = ko.observable(readSessionSettings().dueSoonWindowMinutes ?? DEFAULT_DUE_SOON_WINDOW_MINUTES);
  self.dueSoonWindowMinutes.subscribe((minutes) => writeSessionSetting('dueSoonWindowMinutes', minutes));
  self.pickDueSoonWindow = function (option) {
    self.dueSoonWindowMinutes(option.minutes);
  };

  self.outstandingActions = ko.pureComputed(() => {
    const now = self.uiClockTick();
    const windowMs = self.dueSoonWindowMinutes() * 60000;
    return self.entries()
      .filter((e) => e.actionRequired())
      .map((entry) => {
        const severity = classifyReminderSeverity({ actionReminder: entry.actionReminder(), actionRequired: entry.actionRequired() }, now, windowMs);
        return {
          entry,
          severity,
          formattedReminder: entry.actionReminder() ? formatLocalDateTime(entry.actionReminder()) : null,
          dueRelative: entry.actionReminder() ? formatRelativeDue(entry.actionReminder(), now) : null,
          isOverdue: severity === 'overdue',
          isDueSoon: severity === 'due-soon',
          // an outstanding action whose alerts haven't been acknowledged yet
          canAcknowledge: (severity === 'overdue' || severity === 'due-soon') && !self.acknowledgedIds().has(entry.id()),
        };
      })
      .filter((a) => a.severity !== 'not-due')
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  });
  self.hasOutstandingActions = ko.pureComputed(() => self.outstandingActions().length > 0);
  // Not persisted -- always starts expanded on a fresh load/reload. A
  // collapsed state remembered from a previous session could hide a new
  // overdue reminder behind a closed panel with no obvious sign anything's
  // wrong; the count badge next to the toggle (radiocon.html) is the
  // compromise, so a collapsed panel still shows *that* something's
  // outstanding even while its detail is hidden.
  self.outstandingActionsCollapsed = ko.observable(false);
  self.toggleOutstandingActionsCollapsed = function () {
    self.outstandingActionsCollapsed(!self.outstandingActionsCollapsed());
  };

  // ---- resolve modal (simulates Beacon's own "Resolve Action Required |
  // Ops Log" modal) -- replaces a per-card note field + button (which
  // couldn't offer Beacon's own "still needs further action, with a new
  // reminder" option and made every card taller regardless of whether it
  // was ever going to be resolved from here). `resolveModalInstance` is
  // set externally by main.js once it creates the bootstrap.Modal -- same
  // convention as RadioLogModalVM.js's `modalInstance`. ----
  self.resolveModalInstance = null;
  self.resolveModalAction = ko.observable(null); // the outstandingActions wrapper currently open, or null
  self.resolveModalEntry = ko.pureComputed(() => self.resolveModalAction()?.entry ?? null);
  self.resolveModalEntrySubject = ko.pureComputed(() => self.resolveModalEntry()?.subject() ?? '');
  self.resolveModalEntryText = ko.pureComputed(() => self.resolveModalEntry()?.text() ?? '');
  self.resolveModalEntryCreatedLabel = ko.pureComputed(() => {
    const entry = self.resolveModalEntry();
    if (!entry) return '';
    const author = entry.createdBy.fullName() || 'Unknown';
    const when = formatLocalDateTime(entry.createdOn() || entry.timeLogged());
    return when ? `${when} by ${author}` : author;
  });

  self.resolveModalActionRequired = ko.observable(false);
  self.resolveModalReminderPreset = ko.observable('none');
  self.resolveModalReminderCustomInput = ko.observable('');
  self.resolveModalResolutionText = ko.observable('');
  self.resolveModalSubmitting = ko.observable(false);
  self.resolveModalError = ko.observable('');
  self.resolveModalReminderPresets = REMINDER_PRESETS; // reuses the same presets as the entry-creation form

  self.pickResolveReminderPreset = function (preset) {
    self.resolveModalReminderPreset(preset.key);
    if (preset.key !== 'none') self.resolveModalActionRequired(true);
  };

  // Mirrors entryActionRequired's own subscription below: the reminder
  // controls are only shown while Further Action Required is checked
  // (radiocon.html), so unchecking it clears any preset/time chosen while
  // they were visible.
  self.resolveModalActionRequired.subscribe((required) => {
    if (!required) {
      self.resolveModalReminderPreset('none');
      self.resolveModalReminderCustomInput('');
    }
  });

  self.resolveModalReminderTime = ko.pureComputed(() => {
    const custom = self.resolveModalReminderCustomInput() ? parseLocalDateTimeInputValue(self.resolveModalReminderCustomInput()) : null;
    return resolveReminderTime(self.resolveModalReminderPreset(), new Date(), custom || null);
  });

  self.resolveModalReminderTimeDisplay = ko.pureComputed(() => {
    const t = self.resolveModalReminderTime();
    return t ? formatLocalDateTime(t.toISOString()) : '';
  });

  self.openResolveModal = function (outstandingAction) {
    self.resolveModalAction(outstandingAction);
    self.resolveModalActionRequired(false);
    self.resolveModalReminderPreset('none');
    self.resolveModalReminderCustomInput('');
    self.resolveModalResolutionText('');
    self.resolveModalError('');
  };

  self.confirmResolve = async function () {
    const entry = self.resolveModalEntry();
    if (!entry || self.resolveModalSubmitting()) return;
    self.resolveModalError('');
    self.resolveModalSubmitting(true);

    const stillRequired = self.resolveModalActionRequired();
    const reminderTime = stillRequired ? self.resolveModalReminderTime() : null;
    const reminderIso = reminderTime ? reminderTime.toISOString() : '';

    try {
      await operationslog.resolve(
        entry.id(),
        {
          Text: self.resolveModalResolutionText().trim() || 'Resolved via Radio Operations Console',
          FurtherActionRequired: stillRequired,
          ActionReminder: reminderIso,
        },
        await ctx(),
      );
      // optimistic -- the next poll/SignalR push reconciles the authoritative state
      entry.actionRequired(stillRequired);
      entry.actionReminder(reminderIso || null);
      entry.recentlyResolved(true);
      self.resolveModalSubmitting(false);
      self.resolveModalInstance?.hide();
    } catch (err) {
      console.error('Radio console: failed to resolve reminder', err);
      self.resolveModalSubmitting(false);
      self.resolveModalError(`Couldn't resolve entry #${entry.id()}. ${friendlyReason(err)}`);
    }
  };

  // ---- browser notifications for outstanding actions ----
  // A notification when an action comes due soon (inside the due-soon window),
  // one when its reminder time passes, and -- if enabled -- a repeat every N
  // minutes while it stays overdue and unacknowledged. Acknowledge = clicking
  // the notification or the card's Acknowledge button; resolving the action
  // (or moving its reminder) ends it.
  self.notificationPermission = ko.observable(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  function readNotifyPrefs() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(NOTIFY_PREFS_STORAGE_KEY)) || {};
      return {
        dueSoon: parsed.dueSoon !== false,
        overdue: parsed.overdue !== false,
        repeatMinutes: REPEAT_OPTIONS.some((o) => o.minutes === parsed.repeatMinutes) ? parsed.repeatMinutes : 5,
        banner: parsed.banner !== false,
        sound: parsed.sound !== false,
      };
    } catch (err) {
      return { dueSoon: true, overdue: true, repeatMinutes: 5, banner: true, sound: true };
    }
  }
  const initialNotifyPrefs = readNotifyPrefs();
  self.notifyDueSoon = ko.observable(initialNotifyPrefs.dueSoon);
  self.notifyOverdue = ko.observable(initialNotifyPrefs.overdue);
  self.notifyRepeatMinutes = ko.observable(initialNotifyPrefs.repeatMinutes);
  self.alertBanner = ko.observable(initialNotifyPrefs.banner); // show an in-page banner
  self.alertSound = ko.observable(initialNotifyPrefs.sound); // play a chime
  self.notifyRepeatOptions = REPEAT_OPTIONS;
  self.pickNotifyRepeat = function (option) {
    self.notifyRepeatMinutes(option.minutes);
  };
  [self.notifyDueSoon, self.notifyOverdue, self.notifyRepeatMinutes, self.alertBanner, self.alertSound].forEach((o) =>
    o.subscribe(() => {
      try {
        window.localStorage.setItem(
          NOTIFY_PREFS_STORAGE_KEY,
          JSON.stringify({
            dueSoon: self.notifyDueSoon(),
            overdue: self.notifyOverdue(),
            repeatMinutes: self.notifyRepeatMinutes(),
            banner: self.alertBanner(),
            sound: self.alertSound(),
          }),
        );
      } catch (err) {
        // not remembered -- harmless
      }
    }),
  );

  let notifiedState = emptyNotifiedState();
  self.acknowledgedIds = ko.observable(new Set());

  function syncAcknowledged() {
    const current = self.acknowledgedIds();
    const next = notifiedState.acknowledged;
    if (current.size !== next.size || [...next].some((id) => !current.has(id))) self.acknowledgedIds(new Set(next));
  }

  // Acknowledging (the card's Ack button, the banner's tick, or clicking the desktop notification) is
  // one thing: no more alerts for this action -- its banner and desktop notification go away too.
  self.acknowledgeAction = function (action) {
    const id = action.entry.id();
    notifiedState = acknowledgeAction(notifiedState, id);
    syncAcknowledged();
    self.alerts(self.alerts().filter((a) => a.key !== `action-${id}`));
    closeNotification(`radio-action-${id}`);
  };

  // ---- showing a notification ----
  // Two routes, tried in this order: Chrome's own extension notifications
  // (chrome.notifications -- needs the manifest's "notifications" permission, shows through the
  // operating system's notification centre) and the web Notification API. What the last attempt did is
  // kept in notificationStatus and shown in the Notifications tab, so a notification that isn't
  // appearing can be diagnosed from the page instead of guessed at.
  self.notificationStatus = ko.observable('');
  self.notificationPermissionAllowed = ko.pureComputed(() => self.notificationPermission() === 'granted');

  const chromeNotifications = () => (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create ? chrome.notifications : null);
  const clickHandlers = new Map(); // notification id -> what to do when it's clicked
  const webNotifications = new Map(); // tag -> the open web Notification, so a repeat replaces it and alerts again
  // Clicking a desktop notification brings this console's tab (and its window) to the front
  function focusThisTab() {
    try {
      window.focus();
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
        chrome.tabs.getCurrent((tab) => {
          if (!tab) return;
          if (chrome.windows && chrome.windows.update) chrome.windows.update(tab.windowId, { focused: true });
          chrome.tabs.update(tab.id, { active: true });
        });
      }
    } catch (err) {
      console.error('Radio console: could not bring the tab to the front', err);
    }
  }
  self.focusThisTab = focusThisTab;

  if (chromeNotifications() && chrome.notifications.onClicked) {
    chrome.notifications.onClicked.addListener((id) => {
      focusThisTab();
      clickHandlers.get(id)?.();
      chrome.notifications.clear(id);
    });
  }

  // Permission can change outside this page (browser/system settings), so re-read it when asked
  function syncNotificationPermission() {
    const cn = chromeNotifications();
    if (cn && cn.getPermissionLevel) {
      cn.getPermissionLevel((level) => self.notificationPermission(level === 'granted' ? 'granted' : 'denied'));
    } else if (typeof Notification !== 'undefined') {
      self.notificationPermission(Notification.permission);
    }
  }
  syncNotificationPermission();

  /**
   * @param {{tag: string, title: string, body: string, onClick?: () => void, persistent?: boolean}} options
   * @returns {Promise<{ok: boolean, via: 'chrome'|'web'|'none', detail?: string}>}
   */
  // Takes a desktop notification off the screen (acknowledged elsewhere)
  function closeNotification(tag) {
    try {
      if (chromeNotifications()) chrome.notifications.clear(tag);
      webNotifications.get(tag)?.close();
      webNotifications.delete(tag);
    } catch (err) {
      console.error('Radio console: could not close the notification', err);
    }
  }

  self.showNotification = function ({ tag, title, body, onClick, persistent = false }) {
    const cn = chromeNotifications();
    if (cn) {
      return new Promise((resolve) => {
        try {
          if (onClick) clickHandlers.set(tag, onClick);
          const icon = chrome.runtime.getManifest().icons?.['128'];
          const options = { type: 'basic', title, message: body || ' ', priority: 2, requireInteraction: persistent };
          if (icon) options.iconUrl = chrome.runtime.getURL(icon);
          cn.create(tag, options, () => {
            const err = chrome.runtime.lastError;
            resolve(err ? { ok: false, via: 'chrome', detail: err.message } : { ok: true, via: 'chrome' });
          });
        } catch (err) {
          resolve({ ok: false, via: 'chrome', detail: err.message || String(err) });
        }
      });
    }
    if (typeof Notification === 'undefined') return Promise.resolve({ ok: false, via: 'none', detail: 'This browser context does not support notifications.' });
    if (Notification.permission !== 'granted') {
      return Promise.resolve({ ok: false, via: 'web', detail: `Notifications are not allowed (${Notification.permission}).` });
    }
    return new Promise((resolve) => {
      try {
        webNotifications.get(tag)?.close(); // a repeat: close the old one so the new one alerts again
        const notification = new Notification(title, { body, tag });
        webNotifications.set(tag, notification);
        notification.onclick = () => {
          focusThisTab();
          onClick?.();
          notification.close();
        };
        notification.onshow = () => resolve({ ok: true, via: 'web' });
        notification.onerror = () => resolve({ ok: false, via: 'web', detail: 'The browser reported an error showing it.' });
        // some browsers never fire onshow -- treat "accepted, no complaint" as sent
        setTimeout(() => resolve({ ok: true, via: 'web', detail: 'accepted' }), 1500);
      } catch (err) {
        resolve({ ok: false, via: 'web', detail: err.message || String(err) });
      }
    });
  };

  // ---- alerts: an in-page banner, a chime, and a desktop notification, together ----
  // Used for an outstanding action coming due / going overdue and for an overdue callsign check.
  // Each channel can be switched off in Settings > Notifications; the banner and chime work
  // whether or not the browser allows desktop notifications.
  self.alerts = ko.observableArray([]); // newest first, one per key
  self.visibleAlerts = ko.pureComputed(() => self.alerts().slice(0, MAX_ALERTS_SHOWN));
  self.hiddenAlertCount = ko.pureComputed(() => Math.max(0, self.alerts().length - MAX_ALERTS_SHOWN));

  let audioContext = null;
  // Browsers keep audio locked until the page has had a click or key press; a chime before that is
  // skipped (the banner still shows) -- "Send a test alert" in Settings unlocks it.
  function playChime(severity) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioContext = audioContext || new Ctx();
      if (audioContext.state === 'suspended') audioContext.resume();
      const t0 = audioContext.currentTime;
      chimeNotes(severity).forEach(({ frequency, start, duration, type, gain: volume }) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(t0 + start);
        oscillator.stop(t0 + start + duration + 0.02);
      });
    } catch (err) {
      console.error('Radio console: chime failed', err);
    }
  }

  self.playChime = playChime; // also used by features that raise their own red alerts

  /**
   * @param {{key: string, severity: 'overdue'|'due-soon', title: string, body: string, tag?: string, onAcknowledge?: () => void}} options
   *        key: one banner per key (a repeat replaces it); onAcknowledge runs when the banner is dismissed or the notification clicked
   * @returns {Promise<{ok: boolean, via: string, detail?: string}>}  how the desktop notification went
   */
  self.raiseAlert = function ({ key, severity, title, body, tag, onAcknowledge }) {
    // no alerts while the connection to Beacon is lost: what is on screen is stale, so "overdue" could be wrong
    if (self.beaconConnectionLost()) return Promise.resolve({ ok: false, via: 'none', detail: 'the connection to Beacon is lost, so alerts are paused' });
    const notificationTag = tag || key;
    // one acknowledgement whichever way it comes: the banner's tick or clicking the desktop notification --
    // the other goes away too, and onAcknowledge records it (silencing further alerts for the subject)
    const acknowledge = () => {
      self.alerts(self.alerts().filter((a) => a.key !== key));
      closeNotification(notificationTag);
      onAcknowledge?.();
    };
    if (self.alertBanner()) {
      const alert = { key, severity, title, body, dismiss: acknowledge };
      self.alerts(upsertAlert(self.alerts(), alert));
    }
    if (self.alertSound()) playChime(severity);
    if (self.notificationPermission() !== 'granted') return Promise.resolve({ ok: false, via: 'none', detail: 'desktop notifications are not allowed' });
    return self.showNotification({ tag: notificationTag, title, body, persistent: severity === 'overdue', onClick: acknowledge });
  };

  /** Drops banners of one kind (key prefix) that are no longer relevant (resolved, heard again ...). */
  self.retainAlerts = function (prefix, activeKeys) {
    self.alerts(retainAlerts(self.alerts(), prefix, activeKeys));
  };

  self.dismissAllAlerts = function () {
    self.alerts().slice().forEach((a) => a.dismiss());
  };

  self.requestNotificationPermission = async function () {
    if (chromeNotifications()) {
      syncNotificationPermission();
      self.notificationStatus('Notifications are controlled by your browser and computer settings. Allow them for the browser and this extension, then use the test button.');
      return;
    }
    if (typeof Notification === 'undefined') return;
    try {
      self.notificationPermission(await Notification.requestPermission());
      self.notificationStatus(
        self.notificationPermission() === 'granted' ? '' : "Notifications are blocked. Allow them for this extension in your browser's settings, then try again.",
      );
    } catch (err) {
      console.error('Radio console: notification permission request failed', err);
      self.notificationStatus("Couldn't ask for notification permission. Check your browser's notification settings.");
    }
  };

  self.sendTestNotification = async function () {
    syncNotificationPermission();
    self.notificationStatus('Sending...');
    const result = await self.raiseAlert({
      key: 'test',
      severity: 'due-soon',
      title: 'Radio console test alert',
      body: 'If you can see and hear this, alerts will reach you.',
      tag: 'radio-test',
    });
    const route = result.via === 'chrome' ? "Chrome's extension notifications" : result.via === 'web' ? 'the web Notification API' : 'no desktop route';
    const shown = [self.alertBanner() ? 'banner' : null, self.alertSound() ? 'chime' : null].filter(Boolean).join(' and ');
    self.notificationStatus(
      `${shown ? `In-page ${shown} shown. ` : ''}${
        result.ok
          ? `Desktop notification sent through ${route}. If it didn't appear, check your computer's notification settings (Do Not Disturb / Focus).`
          : "The desktop notification wasn't sent. Check that notifications are allowed for this browser and extension."
      }`,
    );
  };

  function notifyOutstandingActions() {
    syncNotificationPermission();
    if (self.beaconConnectionLost()) return; // paused; nothing is recorded, so anything due is announced once the connection is back
    const actions = self.outstandingActions();
    // banners for actions that are no longer due soon / overdue (resolved, rescheduled) go away
    self.retainAlerts(
      'action-',
      new Set(actions.filter((a) => a.severity === 'overdue' || a.severity === 'due-soon').map((a) => `action-${a.entry.id()}`)),
    );
    const plan = planReminderNotifications(
      actions.map((a) => ({ id: a.entry.id(), severity: a.severity })),
      notifiedState,
      { dueSoon: self.notifyDueSoon(), overdue: self.notifyOverdue(), repeatMinutes: self.notifyRepeatMinutes() },
      Date.now(),
    );
    notifiedState = plan.state;
    syncAcknowledged();

    plan.toNotify.forEach(({ id, kind, repeat }) => {
      const action = actions.find((a) => a.entry.id() === id);
      if (!action) return;
      const { entry } = action;
      const what = `${entry.subject() || 'Untitled'}: ${(entry.text() || '').slice(0, 150)}`;
      const title = kind === 'due-soon' ? 'Radio log action due soon' : repeat ? 'Radio log reminder STILL overdue' : 'Radio log reminder due';
      const body = kind === 'due-soon' && action.dueRelative ? `${what} (due ${action.dueRelative})` : what;
      // one banner / notification per action (the key/tag): a repeat replaces the last and alerts again
      self
        .raiseAlert({
          key: `action-${id}`,
          severity: kind === 'due-soon' ? 'due-soon' : 'overdue',
          title,
          body,
          tag: `radio-action-${id}`,
          onAcknowledge: () => self.acknowledgeAction(action),
        })
        .then((result) => {
          if (!result.ok && result.via !== 'none') self.notificationStatus("The last desktop notification couldn't be shown. Check your computer's notification settings (Do Not Disturb / Focus).");
        });
    });
  }

  // ---- live updates ----
  let unsubscribeSignalR = null;
  let pollTimer = null;
  let reminderTimer = null;

  function startLiveUpdates() {
    unsubscribeSignalR = getSubject('opsLogUpdated').subscribe((payload) => {
      if (!entryMatchesScope(payload, currentScope())) return;
      self.events.notifySubscribers([payload], 'entriesReceived');
      buffer.applyLive([payload]);
      syncEntriesFromBuffer();
    });

    pollTimer = setInterval(async () => {
      try {
        const page = await operationslog.searchLog(currentScope(), { ...(await ctx()), pageSize: LOG_PAGE_SIZE, pageLimit: 1 });
        self.events.notifySubscribers(page.results, 'entriesReceived');
        buffer.applyLive(page.results);
        syncEntriesFromBuffer();
        self.lastRefreshAt(new Date());
        self.listStale(false);
        self.refreshFailures(0);
        self.initialLoadFailed(false);
      } catch (err) {
        console.error('Radio console: background poll failed', err);
        self.refreshFailures(self.refreshFailures() + 1);
        self.listStale(true);
        // entries stay exactly as they were -- a poll failure never blanks the list
      }
    }, POLL_INTERVAL_MS);

    reminderTimer = setInterval(() => {
      self.uiClockTick(Date.now());
      notifyOutstandingActions();
    }, REMINDER_TICK_MS);
  }

  self.stopLiveUpdates = function () {
    if (unsubscribeSignalR) unsubscribeSignalR();
    if (pollTimer) clearInterval(pollTimer);
    if (reminderTimer) clearInterval(reminderTimer);
    clearInterval(liveClockTimer);
    clearInterval(connectionCheckTimer);
  };

  // ---- callsign suggestions ----
  // Matches LAD's combined "Team/Callsign/Asset" lookup (OpsLogModalVM.js's
  // teamSuggestions, sourced from parentVM.trackableAssets): teams (HQ-scoped,
  // via team.search) plus trackable assets (BeaconClient/asset.js#filter has
  // no HQ-scoping parameter at all -- it's a state-wide device-location feed
  // -- so this is the one source in the console that isn't scope-limited).
  self.knownTeams = ko.observableArray();
  self.knownAssets = ko.observableArray(); // [{Callsign}] -- normalised from asset.filter()'s {name} shape
  self.callsignInput = ko.observable('');
  self.suggestionsDismissed = ko.observable(false);
  self.callsignSuggestions = ko.pureComputed(() => {
    if (self.suggestionsDismissed()) return [];
    const combined = [...self.knownTeams(), ...self.knownAssets()];
    return suggestCallsigns(combined, self.callsignInput());
  });
  self.callsignSuggestionIndex = ko.observable(-1);

  self.onCallsignInput = function () {
    self.suggestionsDismissed(false);
  };

  // Delay lets a click on a dropdown item fire before it's hidden -- same
  // shape as LAD/tasking's own Config.js closeDropdown.
  self.onCallsignBlur = function () {
    setTimeout(() => self.suggestionsDismissed(true), 150);
  };

  async function loadKnownTeams() {
    if (self.listEntityIds().length === 0) return;
    try {
      const unitArg = self.listEntityIds().length === 1 ? { Id: self.listEntityIds()[0] } : self.listEntityIds().map((id) => ({ Id: id }));
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const result = await team.search(unitArg, oneYearAgo, new Date(), { ...(await ctx()), statusTypes: [3] });
      self.knownTeams(result.results);
    } catch (err) {
      console.error('Radio console: failed to load teams for callsign suggestions', err);
      // free-text entry still works without suggestions
    }
  }

  async function loadKnownAssets() {
    try {
      const assets = await asset.filter([], await ctx());
      self.knownAssets((assets || []).filter((a) => a && a.name).map((a) => ({ Callsign: a.name })));
    } catch (err) {
      console.error('Radio console: failed to load trackable assets for callsign suggestions', err);
      // free-text entry and team-based suggestions still work without this
    }
  }

  self.pickCallsignSuggestion = function (team_) {
    self.callsignInput(team_.Callsign);
    self.callsignSuggestionIndex(-1);
    self.suggestionsDismissed(true);
  };

  self.onCallsignKeydown = function (_data, event) {
    const suggestions = self.callsignSuggestions();
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.callsignSuggestionIndex(Math.min(self.callsignSuggestionIndex() + 1, suggestions.length - 1));
      return false;
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.callsignSuggestionIndex(Math.max(self.callsignSuggestionIndex() - 1, -1));
      return false;
    }
    if (event.key === 'Enter' && self.callsignSuggestionIndex() >= 0 && suggestions[self.callsignSuggestionIndex()]) {
      event.preventDefault();
      self.pickCallsignSuggestion(suggestions[self.callsignSuggestionIndex()]);
      return false;
    }
    if (event.key === 'Escape') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.callsignSuggestionIndex(-1);
      self.suggestionsDismissed(true); // leave the typed text as-is, just close the list
      return false;
    }
    return true;
  };

  // ---- optional incident association (entry form) ----
  // knownJobs is loaded once (like knownTeams) and filtered client-side --
  // job.search() has no free-text query param, so this mirrors
  // OpsLogModalVM.js's own jobIdSuggestions, which filters an
  // already-loaded in-memory job list rather than re-querying per keystroke.
  self.knownJobs = ko.observableArray();
  self.entryJobInput = ko.observable('');
  self.entryJobId = ko.observable(null);
  self.entryJobLabel = ko.observable('');
  self.entryJobSuggestionsDismissed = ko.observable(false);
  self.entryJobSuggestions = ko.pureComputed(() =>
    self.entryJobSuggestionsDismissed() ? [] : rankJobSuggestions(self.knownJobs(), self.entryJobInput()),
  );
  self.entryJobSuggestionIndex = ko.observable(-1);

  async function loadKnownJobs() {
    if (self.listEntityIds().length === 0) return;
    try {
      const unitArg = self.listEntityIds().length === 1 ? { Id: self.listEntityIds()[0] } : self.listEntityIds().map((id) => ({ Id: id }));
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const lookaheadEnd = new Date();
      lookaheadEnd.setDate(lookaheadEnd.getDate() + 1);
      const result = await job.search(unitArg, monthAgo, lookaheadEnd, await ctx());
      self.knownJobs(result.results);
    } catch (err) {
      console.error('Radio console: failed to load jobs for incident lookup', err);
      // the optional incident field still accepts a typed id without suggestions
    }
  }

  self.onEntryJobInput = function () {
    self.entryJobSuggestionsDismissed(false);
    self.entryJobSuggestionIndex(-1);
  };

  // Delay lets a click on a dropdown item fire before it's hidden -- same
  // shape as LAD/tasking's own Config.js closeDropdown.
  self.onEntryJobBlur = function () {
    setTimeout(() => self.entryJobSuggestionsDismissed(true), 150);
  };

  self.pickEntryJobSuggestion = function (jobSuggestion) {
    self.entryJobId(jobSuggestion.Id);
    self.entryJobLabel(`${jobSuggestion.Identifier}${jobSuggestion.Address?.PrettyAddress ? ' -- ' + jobSuggestion.Address.PrettyAddress : ''}`);
    self.entryJobInput('');
    self.entryJobSuggestionsDismissed(true);
    self.entryJobSuggestionIndex(-1);
  };

  self.clearEntryJob = function () {
    self.entryJobId(null);
    self.entryJobLabel('');
    self.entryJobInput('');
  };

  // Keeps the chosen incident across a successful submit instead of the
  // usual clear-on-submit -- for a run of entries that are all about the
  // same incident, so the operator doesn't have to re-pick it every time.
  // Toggling this never locks the field; Clear (above) still always works.
  self.entryJobPinned = ko.observable(false);
  self.toggleEntryJobPinned = function () {
    self.entryJobPinned(!self.entryJobPinned());
  };

  self.onEntryJobKeydown = function (_data, event) {
    const suggestions = self.entryJobSuggestions();
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryJobSuggestionIndex(Math.min(self.entryJobSuggestionIndex() + 1, suggestions.length - 1));
      return false;
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryJobSuggestionIndex(Math.max(self.entryJobSuggestionIndex() - 1, -1));
      return false;
    }
    if (event.key === 'Enter' && self.entryJobSuggestionIndex() >= 0 && suggestions[self.entryJobSuggestionIndex()]) {
      event.preventDefault();
      self.pickEntryJobSuggestion(suggestions[self.entryJobSuggestionIndex()]);
      return false;
    }
    if (event.key === 'Escape') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryJobSuggestionsDismissed(true);
      self.entryJobSuggestionIndex(-1);
      return false;
    }
    return true;
  };

  // ---- talkgroup (entry form) ----
  // Looked up against BeaconClient/talkgroups.js -- see that file's own
  // comment for why the endpoint it calls is an unverified best guess.
  // Picking a suggestion resolves a real TalkgroupId, wired straight onto
  // the create payload; free text that never matched a suggestion still
  // falls back to being prepended to the message (radioLogPayload.js) so
  // nothing is silently lost if the lookup endpoint turns out to be wrong.
  self.entryTalkgroupInput = ko.observable('');
  self.entryTalkgroupId = ko.observable(null);
  self.entryTalkgroupSuggestions = ko.observableArray();
  self.entryTalkgroupSuggestionIndex = ko.observable(-1);
  self.entryTalkgroupSuggestionsDismissed = ko.observable(false);

  const searchTalkgroupSuggestions = debounce(async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      self.entryTalkgroupSuggestions([]);
      return;
    }
    try {
      const result = await talkgroups.search(trimmed, await ctx());
      // Guard against a slower, now-stale response landing after a faster
      // one for a later keystroke -- without this, results for what was
      // typed a moment ago could overwrite results for what's typed now,
      // making the list look like it isn't filtering live as you type.
      if (self.entryTalkgroupInput().trim() !== trimmed) return;
      // ...and against one landing after the field was already dismissed
      // (blur/Escape/pick) -- otherwise a response that was already in
      // flight when the operator tabbed away could reopen the dropdown.
      if (self.entryTalkgroupSuggestionsDismissed()) return;
      self.entryTalkgroupSuggestions(result.results.slice(0, 8));
    } catch (err) {
      console.error('Radio console: talkgroup lookup failed (endpoint unverified -- see talkgroups.js)', err);
      if (self.entryTalkgroupInput().trim() === trimmed) self.entryTalkgroupSuggestions([]);
    }
  }, 150);

  self.onEntryTalkgroupInput = function () {
    self.entryTalkgroupId(null); // typing again invalidates any previously resolved match
    self.entryTalkgroupSuggestionsDismissed(false);
    self.entryTalkgroupSuggestionIndex(-1);
    // Cleared immediately, not left showing until the debounced search
    // below resolves -- otherwise the previous query's (now-irrelevant)
    // results stay on screen for the ~150ms+network gap after every
    // keystroke, which reads as "filtering isn't working as you type".
    self.entryTalkgroupSuggestions([]);
    searchTalkgroupSuggestions(self.entryTalkgroupInput());
  };

  // Delay lets a click on a dropdown item fire before it's hidden -- same
  // shape as LAD/tasking's own Config.js closeDropdown.
  self.onEntryTalkgroupBlur = function () {
    setTimeout(() => {
      self.entryTalkgroupSuggestionsDismissed(true);
      self.entryTalkgroupSuggestions([]);
    }, 150);
  };

  // Keeps the chosen talkgroup across a successful submit instead of the
  // usual clear-on-submit -- for a run of entries all on the same
  // talkgroup, so the operator doesn't have to re-pick it every time.
  self.entryTalkgroupPinned = ko.observable(false);
  self.toggleEntryTalkgroupPinned = function () {
    self.entryTalkgroupPinned(!self.entryTalkgroupPinned());
  };

  self.clearEntryTalkgroup = function () {
    self.entryTalkgroupId(null);
    self.entryTalkgroupInput('');
    self.entryTalkgroupSuggestions([]);
  };

  self.pickEntryTalkgroupSuggestion = function (suggestion) {
    self.entryTalkgroupId(suggestion.Id);
    self.entryTalkgroupInput(suggestion.Name);
    self.entryTalkgroupSuggestions([]);
    self.entryTalkgroupSuggestionsDismissed(true);
    self.entryTalkgroupSuggestionIndex(-1);
  };

  self.onEntryTalkgroupKeydown = function (_data, event) {
    const suggestions = self.entryTalkgroupSuggestions();
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryTalkgroupSuggestionIndex(Math.min(self.entryTalkgroupSuggestionIndex() + 1, suggestions.length - 1));
      return false;
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryTalkgroupSuggestionIndex(Math.max(self.entryTalkgroupSuggestionIndex() - 1, -1));
      return false;
    }
    if (event.key === 'Enter' && self.entryTalkgroupSuggestionIndex() >= 0 && suggestions[self.entryTalkgroupSuggestionIndex()]) {
      event.preventDefault();
      self.pickEntryTalkgroupSuggestion(suggestions[self.entryTalkgroupSuggestionIndex()]);
      return false;
    }
    if (event.key === 'Escape') {
      if (suggestions.length === 0) return true;
      event.preventDefault();
      self.entryTalkgroupSuggestions([]);
      self.entryTalkgroupSuggestionIndex(-1);
      self.entryTalkgroupSuggestionsDismissed(true);
      return false;
    }
    return true;
  };

  // ---- action required / reminder / important / restricted (entry form) ----
  self.entryActionRequired = ko.observable(false);
  self.entryImportant = ko.observable(false);
  self.entryRestricted = ko.observable(false);
  self.entryReminderPreset = ko.observable('none'); // REMINDER_PRESETS key
  self.entryReminderCustomInput = ko.observable(''); // datetime-local

  self.entryReminderPresets = REMINDER_PRESETS;

  self.pickReminderPreset = function (preset) {
    self.entryReminderPreset(preset.key);
    if (preset.key !== 'none') self.entryActionRequired(true);
  };

  // The reminder controls are only shown (see radiocon.html) while Action
  // Required is checked -- clear any preset/custom time chosen while they
  // were visible so unchecking the box can't leave a stale reminder that
  // silently rides along on the next submit.
  self.entryActionRequired.subscribe((required) => {
    if (!required) {
      self.entryReminderPreset('none');
      self.entryReminderCustomInput('');
    }
  });

  self.entryReminderTime = ko.pureComputed(() => {
    const custom = self.entryReminderCustomInput() ? parseLocalDateTimeInputValue(self.entryReminderCustomInput()) : null;
    return resolveReminderTime(self.entryReminderPreset(), new Date(), custom || null);
  });

  self.entryReminderTimeDisplay = ko.pureComputed(() => {
    const t = self.entryReminderTime();
    return t ? formatLocalDateTime(t.toISOString()) : '';
  });

  // ---- retrospective time entry (entry form) ----
  // Optional "logged earlier" time for entries made after the fact; left
  // off, Beacon stamps the entry with "now" (TimeLogged: null).
  self.entryRetrospective = ko.observable(false);
  self.entryTimeLoggedInput = ko.observable(''); // datetime-local

  self.entryRetrospective.subscribe((on) => {
    if (!on) self.entryTimeLoggedInput('');
  });

  self.entryTimeLogged = ko.pureComputed(() => {
    if (!self.entryRetrospective() || !self.entryTimeLoggedInput()) return null;
    return parseLocalDateTimeInputValue(self.entryTimeLoggedInput()) || null;
  });

  self.entryTimeLoggedError = ko.pureComputed(() => {
    if (!self.entryRetrospective()) return '';
    if (!self.entryTimeLoggedInput()) return 'Pick the time this was logged, or untick "Logged earlier".';
    const t = self.entryTimeLogged();
    if (!t) return 'Logged time is not a valid date/time.';
    if (t.getTime() > Date.now()) return 'Logged time cannot be in the future.';
    return '';
  });

  function resetEntryActionFields() {
    self.entryRetrospective(false);
    self.entryActionRequired(false);
    self.entryImportant(false);
    self.entryRestricted(false);
    self.entryReminderPreset('none');
    self.entryReminderCustomInput('');
  }

  // ---- entry form / submission ----
  self.messageInput = ko.observable('');

  self.onMessageKeydown = function (_data, event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      self.submitAndRefocus();
      return false;
    }
    return true;
  };
  self.submitting = ko.observable(false);
  self.submitError = ko.observable('');
  self.submitOutcomeUnconfirmed = ko.observable(false);
  self.submitNotInFilterNotice = ko.observable('');
  // Each tag carries its own `selected` observable and no-argument
  // `toggle()` method (mirroring RadioLogModalVM.js's createUiTag) rather
  // than a shared selected-ids array checked via `.indexOf(id)` in the
  // binding -- knockout-secure-binding's data-bind parser can't call a
  // function with an argument, so a per-item bare `click: toggle` /
  // `css: { selected }` is the only expressible option.
  self.availableTags = ko.observableArray(); // [{id, name, selected, toggle}] -- the "more tags" area
  self.selectedTagIds = ko.pureComputed(() => self.availableTags().filter((t) => t.selected()).map((t) => t.id));

  function buildUiTag(tag, selected) {
    const uiTag = { id: tag.Id, name: tag.Name, selected: ko.observable(selected) };
    uiTag.toggle = function () {
      uiTag.selected(!uiTag.selected());
    };
    return uiTag;
  }

  self.tagLoadError = ko.observable('');

  // canSubmit requires at least one selected tag, and the Radio tag loaded
  // here is the only one this console ever offers -- if this fails (or
  // finds no matching tag), Submit is disabled with nothing else to tell
  // the operator why unless tagLoadError is set, so this must never fail
  // silently the way console.error alone would.
  async function loadRadioTag() {
    try {
      const group = await tags.getGroup(RADIO_TAG_GROUP_ID, await ctx());
      const radioTag = group.find((t) => (t.Name || '').toLowerCase().includes('radio'));
      self.radioTagId(radioTag?.Id ?? null);
      // Every entry logged here is a radio contact by definition -- the
      // Contact Methods group's other tags (phone, email, ...) don't apply
      // to this console, so the entry form's tag picker only ever shows
      // Radio, always selected.
      self.availableTags(radioTag ? [buildUiTag(radioTag, true)] : []);
      self.tagLoadError(radioTag ? '' : 'There is no "Radio" tag in Beacon, so entries can\'t be logged yet. Ask an administrator to add one.');
    } catch (err) {
      console.error('Radio console: failed to load tags', err);
      self.availableTags([]);
      self.tagLoadError(`Couldn't load the Radio tag, so entries can't be logged yet. ${friendlyReason(err)}`);
    }
  }

  self.retryLoadRadioTag = loadRadioTag;

  self.hasUnsavedDraft = ko.pureComputed(
    () => self.callsignInput().trim() !== '' || self.messageInput().trim() !== '' || self.entryJobId() !== null,
  );

  self.canSubmit = ko.pureComputed(() => {
    return !self.beaconConnectionLost() && !self.submitting() && !self.entryTimeLoggedError() && validateRadioLogDraft({ callsign: self.callsignInput(), message: self.messageInput(), tagIds: self.selectedTagIds() }).length === 0;
  });

  self.submit = async function () {
    if (self.submitting()) return { success: false }; // duplicate-submission guard
    if (self.beaconConnectionLost()) {
      self.submitError("You're not connected to Beacon, so this entry hasn't been sent. It will stay here until the connection is back.");
      return { success: false };
    }
    const errors = validateRadioLogDraft({ callsign: self.callsignInput(), message: self.messageInput(), tagIds: self.selectedTagIds() });
    if (self.entryTimeLoggedError()) errors.push(self.entryTimeLoggedError());
    if (errors.length > 0) {
      self.submitError(errors.join(' '));
      return { success: false };
    }

    self.submitError('');
    self.submitOutcomeUnconfirmed(false);
    self.submitNotInFilterNotice('');
    self.submitting(true);

    const payload = buildRadioLogPayload({
      entityId: self.loggingHqPicker.id(),
      callsign: self.callsignInput().trim(),
      message: self.messageInput(),
      tagIds: self.selectedTagIds(),
      jobId: self.entryJobId(),
      timeLogged: self.entryTimeLogged() ? self.entryTimeLogged().toISOString() : null,
      talkgroupId: self.entryTalkgroupId(),
      talkgroupFreeText: self.entryTalkgroupId() ? null : self.entryTalkgroupInput(),
      important: self.entryImportant(),
      restricted: self.entryRestricted(),
      actionRequired: self.entryActionRequired(),
      actionReminder: self.entryReminderTime() ? self.entryReminderTime().toISOString() : null,
    });

    try {
      const created = await operationslog.create(payload, await ctx());
      // draft cleared only now, on confirmed success -- except the incident
      // and talkgroup when pinned, so a run of entries about the same
      // incident/talkgroup doesn't need it re-picked every time.
      self.callsignInput('');
      self.messageInput('');
      if (!self.entryJobPinned()) self.clearEntryJob();
      if (!self.entryTalkgroupPinned()) {
        self.entryTalkgroupInput('');
        self.entryTalkgroupId(null);
      }
      resetEntryActionFields();
      self.submitting(false);
      if (created) {
        self.events.notifySubscribers(created, 'entryCreated');
        buffer.applyLive([created]);
        syncEntriesFromBuffer();
        if (!entryMatchesScope(created, currentScope())) {
          self.submitNotInFilterNotice("Logged. It isn't in the list above because it doesn't match the current filters.");
        }
      }
      return { success: true };
    } catch (err) {
      self.submitting(false);
      if (err instanceof BeaconApiError) {
        // a real response came back and rejected the write -- confirmed failure, draft preserved
        self.submitError(`Couldn't send this entry. ${friendlyReason(err)} Your entry is still here.`);
      } else {
        // network/timeout/abort -- Beacon may or may not have received it
        self.submitOutcomeUnconfirmed(true);
        self.submitError(
          "Beacon didn't answer, so this entry may or may not have been sent. It hasn't been cleared. Check the log above before sending it again, to avoid a duplicate.",
        );
      }
      return { success: false };
    }
  };

  // Bound to the Submit button/Ctrl+Enter instead of `submit` directly so a
  // confirmed success can return focus to the callsign field, completing
  // the callsign -> message -> Submit -> (back to callsign) keyboard loop.
  self.submitAndRefocus = async function () {
    const result = await self.submit();
    if (result.success) {
      document.getElementById('radioCallsignInput')?.focus();
    }
  };

  self.beforeUnloadGuard = function (event) {
    if (!self.hasUnsavedDraft()) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  };

  self.radioTagOnly.subscribe(() => self.applyFilters());

  // Each starting HQ selection (persisted, or the launch HQ) was seeded
  // with only an id -- resolve its display name once. Any *later* change
  // (select/pickSuggestion) already has the real name at the point it's
  // set, so this is a one-off per picker, not something to redo on every
  // change. The logging and filter HQs both default to the same launch HQ,
  // so a shared cache avoids resolving that id twice over the network.
  const resolvedHqNames = new Map(); // id -> Promise<name>
  async function resolveHqPickerName(picker) {
    const id = picker.id();
    if (!id) return;
    if (!resolvedHqNames.has(id)) {
      resolvedHqNames.set(
        id,
        unit
          .getName(id, await ctx())
          .then((resolved) => resolved?.Name || resolved?.Code || null)
          .catch((err) => {
            console.error('Radio console: failed to resolve HQ/unit name', err);
            return null;
          }),
      );
    }
    const name = await resolvedHqNames.get(id);
    if (name) picker.name(name);
  }

  // ---- init ----
  self.init = async function () {
    await Promise.all([resolveHqPickerName(self.loggingHqPicker), resolveHqPickerName(self.filterHqPicker)]);
    // Tag id must be known before the first list fetch, since "radio tag
    // only" is the default scope -- otherwise that first fetch would run
    // unfiltered and only narrow down on the *next* refresh.
    await loadRadioTag();
    await Promise.all([self.applyFilters(), loadKnownTeams(), loadKnownJobs(), loadKnownAssets()]);
    startLiveUpdates();

    // Registered only now (not at construction) so it can't fire a
    // premature, wrongly-scoped extra fetch before loadRadioTag() has set
    // the default tag filter. From here on this reacts to real operator
    // changes (changing the HQ in Settings).
    self.filterHqPicker.id.subscribe(() => {
      self.applyFilters();
      loadKnownTeams();
      loadKnownJobs();
    });
  };

  // Optional features (src/pages/radio/features/) -- each has an on/off
  // switch in Settings. Installed last so they see the finished view model.
  self.features = createFeatureRegistry({ ko, storage: typeof window !== 'undefined' ? window.localStorage : null });
  if (typeof document !== 'undefined') installFeatures(self, { ko, registry: self.features });

  return self;
}

function toLocalDateTimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTimeInputValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

function formatLocalDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function readStoredThemeMode() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch (err) {
    return 'system';
  }
}

// `undefined` (never stored/storage unavailable) is distinct from `null`
// (operator deliberately cleared the selection to "show all HQs"/"no
// logging HQ") -- see resolveInitialId(), which only falls back to the
// launch HQ for the former, so an explicit clear stays cleared across a
// reload instead of reverting to the launch HQ every time. Shared by both
// the filter HQ and the logging HQ, keyed by storageKey (HQ_STORAGE_KEY /
// LOGGING_HQ_STORAGE_KEY).
function readStoredId(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? undefined : stored || null;
  } catch (err) {
    return undefined;
  }
}

function persistId(storageKey, id) {
  try {
    // `id != null` (not just truthy) so an entity id of 0 persists as "0"
    // rather than being written as '' and misread back as "cleared".
    window.localStorage.setItem(storageKey, id != null ? String(id) : '');
  } catch (err) {
    // localStorage unavailable (private browsing etc.) -- selection just won't persist across reloads
  }
}

function resolveInitialId(storageKey, hq) {
  const stored = readStoredId(storageKey);
  return stored === undefined ? hq || null : stored;
}

// Session-scoped settings blob (sessionStorage): read the whole object back
// (never throwing/returning something non-object-shaped a caller could
// choke on), and merge-write a single key into it so unrelated settings
// already saved this session aren't clobbered.
function readSessionSettings() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_SETTINGS_STORAGE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function writeSessionSetting(key, value) {
  try {
    const current = readSessionSettings();
    current[key] = value;
    window.sessionStorage.setItem(SESSION_SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    // sessionStorage unavailable (private browsing etc.) -- setting just won't persist this session
  }
}
