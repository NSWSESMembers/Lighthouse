/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { RANGE_CHOICES, rangeForChoice, isValidRange } from "../../shared/params.js";
import { loadUnits, errorText } from "../../shared/beacon.js";
import { waitingRing } from "../../shared/loadRing.js";
import { retryDelay as nextDelay } from "../../shared/retry.js";
import { SEARCH_STATUS_IDS, teamFromBeacon, shownByDefault } from "../data/teams.js";
import { lastPosition } from "../data/history.js";
import { incidentId, incidentFromBeacon } from "../data/incident.js";
import { THEMES, COLUMN_CHOICES, SECTIONS, loadSettings, saveSettings } from "../data/settings.js";
import { TeamVM } from "./TeamVM.js";

// Auto-refresh period, as on the old page. Each refresh also reloads every
// shown team's history (a request per team), so not as often as Incident Summary.
export const REFRESH_SECONDS = 180;
// After a failed load the page keeps trying on its own (it's left up on a
// screen): 30 s, then doubling, up to this.
export const FIRST_RETRY_SECONDS = 30;
export const MAX_RETRY_SECONDS = 300;

/** Seconds to wait after `failures` failed loads in a row (0 = none failed). */
export function retryDelay(failures) {
    return nextDelay(failures, { refresh: REFRESH_SECONDS, first: FIRST_RETRY_SECONDS, max: MAX_RETRY_SECONDS });
}
// Only show the ring if the teams haven't come back by then.
export const LOADER_DELAY_MS = 400;

const PAGE_NAME = "Team Summary";
// The old page's range: "Sun, 15/11/2026, 00:00:00".
const RANGE_OPTS = { weekday: "short", year: "numeric", month: "2-digit", day: "numeric", hour12: false };

/**
 * Who the page covers, named as the old page did: the HQ's name, the zone's
 * code when every HQ is in one zone, "N units" otherwise, or NSW.
 *
 * @param {Array<{Name: string, ParentEntity?: {Code: string}}>} units  [] for all of NSW
 */
export function scopeName(units) {
    if (!units.length) return "NSW";
    if (units.length === 1) return units[0].Name;
    const zones = new Set(units.map((u) => u.ParentEntity && u.ParentEntity.Code));
    return zones.size === 1 && !zones.has(undefined) ? [...zones][0] : `${units.length} units`;
}

/** "Sun, 15/11/2026, 00:00:00 to Sun, 15/11/2026, 23:59:00", or why not. */
export function rangeText({ start, end }) {
    return isValidRange({ start, end })
        ? `${start.toLocaleTimeString("en-au", RANGE_OPTS)} to ${end.toLocaleTimeString("en-au", RANGE_OPTS)}`
        : "No valid date range";
}
const TIME_FMT = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/**
 * Team Summary page.
 *
 * @param {object} deps
 * @param {{host, source, userId, hqIds, start, end}} deps.params  parsePageParams()
 * @param {object} deps.client   BeaconClient (unit.getName, team.search, team.getHistory, job.get)
 * @param {string} [deps.guideUrl]
 * @param {Storage} [deps.storage]  for the Settings dialog (localStorage)
 * @param {(mode: 'auto'|'light'|'dark') => void} [deps.applyTheme]
 * @param {() => void} [deps.openSettings]  shows the Settings dialog
 * @param {() => void} [deps.openTeams]  shows the Team Filter dialog (also once the teams first load)
 * @param {(anchor: Element) => void} [deps.showIncident]  shows the incident popup by `anchor`
 * @param {() => void} [deps.incidentChanged]  the popup's content changed size
 * @param {() => Date} [deps.now]
 */
export function TeamSummaryVM(deps) {
    const self = this;
    const { params, client } = deps;
    const now = deps.now || (() => new Date());
    const applyTheme = deps.applyTheme || (() => {});
    const showIncident = deps.showIncident || (() => {});
    const incidentChanged = deps.incidentChanged || (() => {});
    const launchRange = { start: params.start, end: params.end };

    self.source = params.source;
    self.guideUrl = deps.guideUrl || "https://lighthouse.ses.nsw.gov.au/guides/teams/";

    // Token arrives from chrome.storage (setToken) after construction.
    self.token = ko.observable("");
    self.units = ko.observable(null); // null until looked up

    self.loading = ko.observable(true);      // first load: the ring
    self.loaderDue = ko.observable(false);   // LOADER_DELAY_MS has passed
    self.showLoader = ko.pureComputed(() => self.loading() && (self.loaderDue() || Boolean(self.error())));
    self.refreshing = ko.observable(false);  // later loads: small spinner
    self.loadStartedAt = ko.observable(+now());
    self.clock = ko.observable(+now());      // ticks each second (tick)
    self.error = ko.observable(null);
    self.loadedAt = ko.observable(null);

    self.rangeChoices = RANGE_CHOICES;
    self.rangeChoice = ko.observable("launch");
    self.range = ko.observable(launchRange);

    self.teams = ko.observableArray([]);
    self.secondsToRefresh = ko.observable(REFRESH_SECONDS);

    // ---- settings -------------------------------------------------------

    const storage = deps.storage || null;
    const saved = storage ? loadSettings(storage) : loadSettings({ getItem: () => null });
    self.themes = THEMES.map((t) => ({ ...t, id: "theme-" + t.value }));
    self.columnChoices = COLUMN_CHOICES.map((n) => ({ value: n, label: String(n) }));
    self.openSettings = deps.openSettings || (() => {});
    self.openTeams = deps.openTeams || (() => {});
    self.theme = ko.observable(saved.theme);
    self.columns = ko.observable(saved.columns);
    self.autoShow = ko.observable(saved.autoShow);
    for (const s of SECTIONS) self[s.value] = ko.observable(saved[s.value]);
    // For the Settings checkboxes: each bound to its own observable.
    self.sections = SECTIONS.map((s) => ({ sectionId: s.id, sectionLabel: s.label, on: self[s.value] }));
    applyTheme(saved.theme);

    function persist() {
        if (!storage) return;
        const out = { theme: self.theme(), columns: Number(self.columns()), autoShow: self.autoShow() };
        for (const s of SECTIONS) out[s.value] = self[s.value]();
        saveSettings(storage, out);
    }
    self.theme.subscribe((mode) => {
        applyTheme(mode);
        persist();
    });
    [self.columns, self.autoShow, ...SECTIONS.map((s) => self[s.value])].forEach((o) => o.subscribe(persist));
    self.gridClass = ko.pureComputed(() => `team-grid cols-${Number(self.columns()) || 3}`);

    // ---- headings and counts ---------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeName(units) : "…";
    });
    self.bannerTitle = ko.pureComputed(() => `Team summary for ${self.scopeTitle()}`);
    self.pageTitle = ko.pureComputed(() => `${self.scopeTitle()} ${PAGE_NAME}`);
    self.rangeText = ko.pureComputed(() => rangeText(self.range()));

    self.shownTeams = ko.pureComputed(() => self.teams().filter((t) => t.shown()));
    self.teamsShown = ko.pureComputed(() => self.shownTeams().length);
    self.teamsHidden = ko.pureComputed(() => self.teams().length - self.teamsShown());
    self.membersShown = ko.pureComputed(() => self.shownTeams().reduce((n, t) => n + t.data().members.length, 0));
    // Bound as text: never a bare 0 (knockout-secure-binding would look up window).
    self.membersText = ko.pureComputed(() => String(self.membersShown()));
    self.shownText = ko.pureComputed(() => String(self.teamsShown()));
    self.hiddenText = ko.pureComputed(() => String(self.teamsHidden()));
    self.noTeams = ko.pureComputed(() => !self.loading() && self.teams().length === 0);
    self.allHidden = ko.pureComputed(() => !self.loading() && self.teams().length > 0 && self.teamsShown() === 0);
    // Any shown team still waiting for its history (the harness waits on this).
    self.historyLoading = ko.pureComputed(() => self.shownTeams().some((t) => t.historyLoading()));

    self.updatedText = ko.pureComputed(() => {
        const at = self.loadedAt();
        return at ? `Updated ${TIME_FMT.format(at)}` : "";
    });
    self.countdownText = ko.pureComputed(() => {
        const s = Math.max(0, self.secondsToRefresh());
        return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    });
    self.retryText = ko.pureComputed(() => `Trying again in ${self.countdownText()}`);

    self.loader = ko.pureComputed(() => waitingRing({
        startedAt: self.loadStartedAt(),
        now: self.clock(),
        title: "Asking Beacon for the teams…",
    }));

    /** From the "Still waiting" message: give up on this range for a shorter one. */
    self.loadShorterRange = function () {
        self.rangeChoice("24");
    };

    // ---- the Team Filter dialog --------------------------------------------

    self.showAll = function () {
        self.teams().forEach((t) => t.shown(true));
    };
    self.showActivated = function () {
        self.teams().forEach((t) => t.shown(t.data().statusName === "Activated"));
    };
    self.showNone = function () {
        self.teams().forEach((t) => t.shown(false));
    };

    // ---- loading --------------------------------------------------------

    let inFlight = null;
    let loaderTimer = null;
    let failures = 0;   // failed loads in a row, for retryDelay
    // The range the teams on screen are for. A failed range switch goes
    // back to this choice, so the buttons, header and cards agree.
    let shownChoice = self.rangeChoice();
    let skipReloadFor = null;
    const addresses = new Map(); // incident number -> Promise<address>

    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
    }

    /** Fold a Teams/Search answer into the cards, keeping what's shown. */
    function merge(results) {
        const byId = new Map(self.teams().map((t) => [t.id, t]));
        const next = results.map((raw) => {
            const team = teamFromBeacon(raw);
            let vm = byId.get(team.id);
            if (vm) {
                const wasActivated = vm.data().statusName === "Activated";
                vm.data(team);
                // Newly activated, of any type: shown, as on the old page.
                if (self.autoShow() && !wasActivated && team.statusName === "Activated") vm.shown(true);
            } else {
                vm = new TeamVM(team, self);
                if (self.autoShow() && shownByDefault(team)) vm.shown(true);
            }
            return vm;
        });
        self.teams(next);
    }

    function incidentAddress(number) {
        if (!addresses.has(number)) {
            const lookup = client.job.get(incidentId(number), ctx())
                .then((job) => (job && job.Address && job.Address.PrettyAddress) || "")
                .catch((err) => {
                    addresses.delete(number); // try again next time
                    console.error("Team Summary: incident address lookup failed", err);
                    return "";
                });
            addresses.set(number, lookup);
        }
        return addresses.get(number);
    }

    /**
     * Load a team's history and where it was last seen. One at a time per
     * team; a call while one is running joins it.
     *
     * @param {TeamVM} team
     */
    self.loadHistory = function (team) {
        if (!self.token()) return Promise.resolve();
        if (team.historyBusy) return team.historyBusy;
        team.historyLoading(true);
        team.historyBusy = (async () => {
            try {
                const res = await client.team.getHistory(team.id, ctx());
                const rows = res.results || [];
                const pos = lastPosition(rows);
                const address = pos ? await incidentAddress(pos.incidentNumber) : "";
                team.historyRows(rows);
                team.position(pos ? { ...pos, address } : null);
                team.historyError("");
            } catch (err) {
                console.error(`Team Summary: history for team ${team.id} failed`, err);
                team.historyError(`Couldn't load the history: ${errorText(err, PAGE_NAME)}`);
            } finally {
                team.historyLoading(false);
                team.historyBusy = null;
            }
        })();
        return team.historyBusy;
    };

    function refreshHistories() {
        return Promise.all(self.shownTeams().map((t) => self.loadHistory(t)));
    }

    /**
     * Fetch the teams for the current range. A load already running is
     * aborted when the range changes, and left alone (no overlap) for a refresh.
     *
     * @param {{replace?: boolean}} [opts]  replace: abort a load in progress
     */
    self.load = async function ({ replace = false } = {}) {
        if (inFlight && !replace) return inFlight.promise;
        if (inFlight) inFlight.controller.abort();

        const controller = new AbortController();
        const firstLoad = self.loadedAt() === null;
        const choice = self.rangeChoice();
        const range = rangeForChoice(launchRange, choice, now());
        if (firstLoad) self.range(range);
        self.error(null);
        if (firstLoad) {
            self.loading(true);
            self.loadStartedAt(+now());
            clearTimeout(loaderTimer);
            loaderTimer = setTimeout(() => self.loaderDue(true), LOADER_DELAY_MS);
            self.clock(+now());
        } else {
            self.refreshing(true);
        }

        const run = (async () => {
            if (!isValidRange(range)) throw new Error("This page was opened without a valid start and end date.");
            if (self.units() === null) {
                self.units(await loadUnits(client, params.hqIds, ctx({ signal: controller.signal })));
            }
            // team.search takes a single entity, or an array ([] for all of NSW).
            const units = self.units();
            const scope = units.length === 1 ? units[0] : units;
            const found = await client.team.search(scope, range.start, range.end, ctx({
                signal: controller.signal,
                statusTypes: SEARCH_STATUS_IDS,
            }));
            if (controller.signal.aborted) return;
            merge(found.results || []);
            self.range(range);
            shownChoice = choice;
            failures = 0;
            self.loadedAt(now());
            self.loading(false);
            clearTimeout(loaderTimer);
            // Teams on screen straight away; their histories fill in.
            refreshHistories();
            // The old page listed the teams to pick from once they'd loaded.
            if (firstLoad) self.openTeams();
        })();

        // Callers joining this load get the handled promise, never a rejection.
        const settled = (async () => {
            try {
                await run;
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("Team summary load failed", err);
                self.error(errorText(err, PAGE_NAME));
                failures++;
                if (self.loadedAt() !== null && self.rangeChoice() !== shownChoice) {
                    // Switching range failed: the old range's teams are still
                    // up, so put its button back (without loading it again).
                    skipReloadFor = shownChoice;
                    self.rangeChoice(shownChoice);
                }
            } finally {
                if (inFlight && inFlight.controller === controller) {
                    inFlight = null;
                    self.refreshing(false);
                    self.secondsToRefresh(retryDelay(failures));
                }
            }
        })();
        inFlight = { controller, promise: settled };
        return settled;
    };

    self.refreshNow = function () {
        self.load();
    };

    self.retry = function () {
        self.load({ replace: true });
    };

    /**
     * Called once a second by main.js. Counts down to the next refresh, or
     * after a failure to the next try: an error never stops the page refreshing.
     */
    self.tick = function () {
        self.clock(+now());
        if (inFlight) return;
        const next = self.secondsToRefresh() - 1;
        if (next <= 0) {
            self.secondsToRefresh(REFRESH_SECONDS);
            self.load();
        } else {
            self.secondsToRefresh(next);
        }
    };

    self.rangeChoice.subscribe((value) => {
        if (skipReloadFor !== null && value === skipReloadFor) {
            skipReloadFor = null;
            return;
        }
        if (self.token()) self.load({ replace: true });
    });

    /** The first token starts the first load; renewed tokens are just stored. */
    self.setToken = function (token) {
        const first = !self.token();
        self.token(token);
        if (first) self.load();
    };

    // ---- the incident popup -----------------------------------------------

    // { number, loading, failed, details } for the incident last clicked.
    self.incident = ko.observable(null);

    /** An incident in a team's history was clicked: show its details by it. */
    self.openIncident = function (entry, event) {
        if (!entry.incidentNumber) return;
        const number = entry.incidentNumber;
        self.incident({ number, loading: true, failed: "", details: null });
        showIncident(event.currentTarget);
        return client.job.get(incidentId(number), ctx())
            .then((job) => {
                if (!self.incident() || self.incident().number !== number) return;
                self.incident({ number, loading: false, failed: "", details: incidentFromBeacon(job, params.source) });
            })
            .catch((err) => {
                if (!self.incident() || self.incident().number !== number) return;
                console.error("Team Summary: incident lookup failed", err);
                self.incident({ number, loading: false, failed: `Couldn't load ${number}: ${errorText(err, PAGE_NAME)}`, details: null });
            })
            .finally(() => incidentChanged());
    };
}
