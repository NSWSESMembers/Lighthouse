/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { RANGE_CHOICES, rangeForChoice, isValidRange, rangeText, scopeTitle } from "../../shared/params.js";
import { loadUnits, errorText } from "../../shared/beacon.js";
import { waitingRing } from "../../shared/loadRing.js";
import { retryDelay as nextDelay } from "../../shared/retry.js";
import { summarize, percentText } from "../data/summaryCounts.js";
import { THEMES, SOUNDS, loadSettings, saveSettings, soundFile } from "../data/settings.js";

// Auto-refresh period, as on the old page: it's left up on a screen.
export const REFRESH_SECONDS = 30;
// After a failed load the page keeps trying on its own (a wall screen has
// nobody to click Try again): 30 s, then doubling, up to this.
export const MAX_RETRY_SECONDS = 300;

/** Seconds to wait after `failures` failed loads in a row (0 = none failed). */
export function retryDelay(failures) {
    return nextDelay(failures, { refresh: REFRESH_SECONDS, first: REFRESH_SECONDS, max: MAX_RETRY_SECONDS });
}
// How long the New tile stays highlighted after new incidents come in.
export const NEW_HIGHLIGHT_MS = 8000;
// The report usually comes back in well under a second: only show the
// ring if it hasn't by then, so a quick load doesn't flash it.
export const LOADER_DELAY_MS = 400;

const PAGE_NAME = "Incident Summary";
const DAY_FMT = new Intl.DateTimeFormat("en-AU", { weekday: "long" });
const CLOCK_FMT = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DATE_FMT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "numeric", year: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/**
 * Incident Summary page.
 *
 * @param {object} deps
 * @param {{host, source, userId, hqIds, start, end}} deps.params  parsePageParams()
 * @param {object} deps.client   BeaconClient (unit.getName, job.summary)
 * @param {string} [deps.guideUrl]
 * @param {Storage} [deps.storage]  for the Settings dialog (localStorage)
 * @param {(file: string) => void} [deps.playSound]
 * @param {(mode: 'auto'|'light'|'dark') => void} [deps.applyTheme]
 * @param {() => void} [deps.openSettings]  shows the Settings dialog
 * @param {() => Date} [deps.now]
 */
export function SummaryVM(deps) {
    const self = this;
    const { params, client } = deps;
    const now = deps.now || (() => new Date());
    const playSound = deps.playSound || (() => {});
    const applyTheme = deps.applyTheme || (() => {});
    const launchRange = { start: params.start, end: params.end };

    self.guideUrl = deps.guideUrl || "https://lighthouse.ses.nsw.gov.au/guides/summary/";

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

    self.summary = ko.observable(summarize(null));
    self.secondsToRefresh = ko.observable(REFRESH_SECONDS);
    self.newHighlight = ko.observable(false);

    // ---- settings -------------------------------------------------------

    const storage = deps.storage || null;
    const saved = storage ? loadSettings(storage) : { theme: "auto", sound: "None" };
    self.themes = THEMES.map((t) => ({ ...t, id: "theme-" + t.value }));
    self.sounds = SOUNDS;
    self.openSettings = deps.openSettings || (() => {});
    self.theme = ko.observable(saved.theme);
    self.sound = ko.observable(saved.sound);
    applyTheme(saved.theme);

    function persist() {
        if (storage) saveSettings(storage, { theme: self.theme(), sound: self.sound() });
    }
    self.theme.subscribe((mode) => {
        applyTheme(mode);
        persist();
    });
    self.sound.subscribe(() => {
        persist();
        self.testSound();
    });
    self.hasSound = ko.pureComputed(() => soundFile(self.sound()) !== "");
    self.testSound = function () {
        const file = soundFile(self.sound());
        if (file) playSound(file);
    };

    // ---- headings -------------------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeTitle(units) : "…";
    });
    self.pageTitle = ko.pureComputed(() => `${PAGE_NAME}: ${self.scopeTitle()}`);
    // The title box: a long unit name gives way to its code, as on the old page.
    self.scopeShort = ko.pureComputed(() => {
        const units = self.units();
        if (units && units.length === 1 && units[0].Name.length > 15 && units[0].Code) return units[0].Code;
        return self.scopeTitle();
    });
    // The date box: weekday, time and date of each end of the range.
    function rangeEnd(d) {
        if (!(d instanceof Date) || isNaN(d)) return { dayText: "—", timeText: "—", dateText: "—" };
        return { dayText: DAY_FMT.format(d), timeText: CLOCK_FMT.format(d), dateText: DATE_FMT.format(d) };
    }
    self.rangeStart = ko.pureComputed(() => rangeEnd(self.range().start));
    self.rangeEnd = ko.pureComputed(() => rangeEnd(self.range().end));
    self.rangeText = ko.pureComputed(() => rangeText(self.range()));
    self.updatedText = ko.pureComputed(() => {
        const at = self.loadedAt();
        return at ? `Updated ${TIME_FMT.format(at)}` : "";
    });
    self.countdownText = ko.pureComputed(() => {
        const s = Math.max(0, self.secondsToRefresh());
        return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    });
    // Under the first-load error: when the page will try again by itself.
    self.retryText = ko.pureComputed(() => `Trying again in ${self.countdownText()}`);

    self.loader = ko.pureComputed(() => waitingRing({
        startedAt: self.loadStartedAt(),
        now: self.clock(),
        title: "Asking Beacon for the incident summary…",
    }));

    /** From the "Still waiting" message: give up on this range for a shorter one. */
    self.loadShorterRange = function () {
        self.rangeChoice("24");
    };

    // ---- tiles ----------------------------------------------------------

    // Tile fields are never empty and never share a name with a window
    // global: knockout-secure-binding falls back to `window` for a falsy
    // value (`open: 0` would bind window.open).
    function tile(key, label, count, total, sub = "") {
        const value = count.toLocaleString();
        return {
            tileKey: key,
            tileId: "tile-" + key,
            tileLabel: label,
            tileSub: sub || " ",
            tileValue: value,
            tileChars: String(value.length),
            tilePct: percentText(count, total),
            tileTitle: sub ? `${label}: ${sub}` : label,
        };
    }

    self.headlineTiles = ko.pureComputed(() => {
        const s = self.summary();
        return [
            tile("outstanding", "Outstanding", s.outstanding, s.total, "New + Active + Tasked + Referred"),
            tile("completed", "Completed", s.closed, s.total, "Completed + Cancelled + Rejected + Finalised"),
            tile("total", "Total", s.total, s.total),
        ];
    });
    self.openTiles = ko.pureComputed(() => {
        const s = self.summary();
        return s.open.map((x) => tile(x.key, x.label, x.count, s.total));
    });
    self.closedTiles = ko.pureComputed(() => {
        const s = self.summary();
        return s.finished.map((x) => tile(x.key, x.label, x.count, s.total));
    });
    self.typeTiles = ko.pureComputed(() => {
        const s = self.summary();
        return s.types.map((x) => tile(x.key, x.label, x.count, s.total, x.includes.join(", ")));
    });
    self.isEmpty = ko.pureComputed(() => !self.loading() && self.summary().total === 0);

    // ---- loading --------------------------------------------------------

    let inFlight = null;
    let highlightTimer = null;
    let loaderTimer = null;
    let lastNew = null; // New count from the last load of this range
    let failures = 0;   // failed loads in a row, for retryDelay
    // The range the numbers on screen are for. A failed range switch goes
    // back to this choice, so the buttons, date box and numbers agree.
    let shownChoice = self.rangeChoice();
    let skipReloadFor = null;

    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
    }

    function noticeNew(summary) {
        const count = summary.open.find((x) => x.key === "new").count;
        if (lastNew !== null && count > lastNew) {
            self.testSound();
            self.newHighlight(true);
            clearTimeout(highlightTimer);
            highlightTimer = setTimeout(() => self.newHighlight(false), NEW_HIGHLIGHT_MS);
        }
        lastNew = count;
    }

    /**
     * Fetch and show the current range. A load already running is aborted
     * when the range changes, and left alone (no overlap) for a refresh.
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
        // Nothing is on screen yet on the first load, so the date box can show
        // what's loading. After that it waits for the report, so the numbers
        // on screen keep their own dates if this load fails.
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
            // job.summary takes a single entity, an array, or [] for all of NSW.
            const units = self.units();
            const scope = units.length === 1 ? units[0] : units;
            const report = await client.job.summary(scope, range.start, range.end, ctx({ signal: controller.signal }));
            if (controller.signal.aborted) return;
            const summary = summarize(report);
            noticeNew(summary);
            self.summary(summary);
            self.range(range);
            shownChoice = choice;
            failures = 0;
            self.loadedAt(now());
            self.loading(false);
            clearTimeout(loaderTimer);
        })();

        // Callers joining this load get the handled promise, never a rejection.
        const settled = (async () => {
            try {
                await run;
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("Incident summary load failed", err);
                self.error(errorText(err, PAGE_NAME));
                failures++;
                if (self.loadedAt() !== null && self.rangeChoice() !== shownChoice) {
                    // Switching range failed: the old range's numbers are still
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
     * after a failure to the next try, first load included: an error never
     * stops the page refreshing.
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
        lastNew = null; // a different range: its New count isn't "new incidents"
        if (self.token()) self.load({ replace: true });
    });

    /** The first token starts the first load; renewed tokens are just stored. */
    self.setToken = function (token) {
        const first = !self.token();
        self.token(token);
        if (first) self.load();
    };
}
