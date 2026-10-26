/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { BREAKDOWNS, BREAKDOWN_GROUPS, chartElementId, legendElementId, gridElementId } from "../charts/breakdowns.js";
import { rangeForChoice, isValidRange, scopeTitle } from "../data/params.js";
import { loadUnits, loadJobs } from "../data/loadStats.js";
import { summarizeDurations, formatDuration } from "../data/durations.js";
import { bucketFor } from "../data/timeBuckets.js";
import { wordFrequencies } from "../data/wordCount.js";
import { describeLoad, RING_CIRCUMFERENCE } from "./loadProgress.js";

// Auto-refresh period, as on the old page.
export const REFRESH_SECONDS = 180;
const LATEST_ROWS = 15;

export const RANGE_CHOICES = [
    { value: "launch", id: "range-launch", label: "As opened" },
    { value: "24", id: "range-24", label: "Last 24 h" },
    { value: "48", id: "range-48", label: "48 h" },
    { value: "72", id: "range-72", label: "72 h" },
    { value: "168", id: "range-168", label: "7 days" },
];

const DATE_FMT = new Intl.DateTimeFormat("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const ROW_FMT = new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function errorText(err) {
    if (!err) return "Unknown error";
    if (err.status === 401) return "Beacon refused the request (401). Reopen Incident Statistics from Beacon to sign in again.";
    if (err.status) return `Beacon returned ${err.status}${err.statusText ? " " + err.statusText : ""}.`;
    return err.message || String(err);
}

/**
 * Incident Statistics page.
 *
 * @param {object} deps
 * @param {{host, source, userId, hqIds, start, end}} deps.params  parseStatsParams()
 * @param {object} deps.client      BeaconClient (unit.getName, job.search)
 * @param {object} deps.charts      StatsCharts, or a stand-in in tests
 * @param {() => Promise<object|null>} [deps.clusters]  unitClusters.json loader
 * @param {(el: Element, words: Array) => Function} [deps.renderWordCloud]
 * @param {() => Date} [deps.now]
 */
export function StatsVM(deps) {
    const self = this;
    const { params, client, charts } = deps;
    const now = deps.now || (() => new Date());
    const launchRange = { start: params.start, end: params.end };

    self.source = params.source;

    // Token arrives from chrome.storage (setToken) after construction.
    self.token = ko.observable("");

    self.units = ko.observable(null); // null until looked up
    self.clusters = null;

    self.loading = ko.observable(true);      // first load: full-page progress
    self.refreshing = ko.observable(false);  // later loads: small spinner
    // First-load ring (loadProgress.js): raw counts and times, described by `loader`.
    self.loadPhase = ko.observable("starting"); // starting | incidents | charts
    self.loadLoaded = ko.observable(0);
    self.loadTotal = ko.observable(null);       // Beacon's total, once the first page is back
    self.loadStartedAt = ko.observable(+now());
    self.firstPageAt = ko.observable(null);
    self.lastPageAt = ko.observable(null);
    self.clock = ko.observable(+now());         // ticks each second (tick)
    self.ringCircumference = RING_CIRCUMFERENCE.toFixed(2);
    self.error = ko.observable(null);
    self.loadedAt = ko.observable(null);

    self.rangeChoices = RANGE_CHOICES;
    self.rangeChoice = ko.observable("launch");
    self.range = ko.observable(launchRange);

    self.events = ko.observableArray([]);
    self.totalCount = ko.observable(0);
    self.filteredCount = ko.observable(0);
    self.latestJobs = ko.observableArray([]);
    self.durations = ko.observable(summarizeDurations([]));
    self.secondsToRefresh = ko.observable(REFRESH_SECONDS);
    // Bar charts with a brushed range (shows their reset link).
    self.receivedFiltered = ko.observable(false);
    self.closedFiltered = ko.observable(false);
    self.durationFiltered = ko.observable(false);

    self.breakdowns = BREAKDOWNS.map((b) => ({
        key: b.key,
        group: b.group,
        title: b.title,
        elementId: chartElementId(b.key),
        legendId: legendElementId(b.key),
        filtered: ko.observable(false),
        filterText: ko.observable(""),
    }));

    self.breakdownGroups = BREAKDOWN_GROUPS.map((g) => ({
        key: g.key,
        title: g.title,
        gridId: gridElementId(g.key),
        items: self.breakdowns.filter((b) => b.group === g.key),
    }));

    // Set by main.js once the grids exist (breakdownLayout.js).
    self.layout = null;
    self.resetLayout = function () {
        if (self.layout) self.layout.reset();
    };

    // ---- headings -------------------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeTitle(units) : "…";
    });
    self.pageTitle = ko.pureComputed(() => `Incident Statistics: ${self.scopeTitle()}`);
    self.rangeText = ko.pureComputed(() => {
        const { start, end } = self.range();
        return isValidRange({ start, end })
            ? `${DATE_FMT.format(start)} to ${DATE_FMT.format(end)}`
            : "No valid date range";
    });
    self.bucketLabel = ko.pureComputed(() => {
        const { start, end } = self.range();
        return isValidRange({ start, end }) ? bucketFor(start, end).label : "Hour";
    });
    self.receivedTitle = ko.pureComputed(() => `Incidents received per ${self.bucketLabel().toLowerCase()}`);
    self.closedTitle = ko.pureComputed(() => `Incidents closed per ${self.bucketLabel().toLowerCase()}`);

    self.loader = ko.pureComputed(() => {
        const view = describeLoad({
            phase: self.loadPhase(),
            loaded: self.loadLoaded(),
            total: self.loadTotal(),
            startedAt: self.loadStartedAt(),
            firstPageAt: self.firstPageAt(),
            lastPageAt: self.lastPageAt(),
            now: self.clock(),
        });
        return { ...view, pageBarStyle: { width: view.pageBarPct + "%" } };
    });

    /** From the "Still waiting" message: give up on this range for a shorter one. */
    self.loadShorterRange = function () {
        self.rangeChoice("24");
    };

    self.isFiltered = ko.pureComputed(() => self.filteredCount() < self.totalCount());
    self.countText = ko.pureComputed(() => {
        const total = self.totalCount();
        const noun = total === 1 ? "incident" : "incidents";
        return self.isFiltered()
            ? `${self.filteredCount().toLocaleString()} of ${total.toLocaleString()} ${noun} selected`
            : `${total.toLocaleString()} ${noun}`;
    });
    self.hasEvents = ko.pureComputed(() => self.events().length > 0);
    self.countdownText = ko.pureComputed(() => {
        const s = Math.max(0, self.secondsToRefresh());
        return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    });

    self.durationTiles = ko.pureComputed(() => {
        const d = self.durations();
        return [
            { label: "Quickest 20%", sub: "average time to complete", value: formatDuration(d.fastMean) },
            { label: "Middle 60%", sub: "average time to complete", value: formatDuration(d.typicalMean) },
            { label: "Slowest 20%", sub: "average time to complete", value: formatDuration(d.slowMean) },
            { label: "25% of incidents", sub: "completed within", value: formatDuration(d.p25) },
            { label: "50% of incidents", sub: "completed within", value: formatDuration(d.p50) },
            { label: "75% of incidents", sub: "completed within", value: formatDuration(d.p75) },
        ];
    });
    self.durationCountText = ko.pureComputed(() => {
        const n = self.durations().count;
        return `Based on ${n.toLocaleString()} completed ${n === 1 ? "incident" : "incidents"} that went Active then Complete`;
    });

    // ---- filters -> KO --------------------------------------------------

    let cloudTimer = null;
    let stopCloud = () => {};
    self.cloudElement = null; // set by main.js

    function renderCloud() {
        if (!deps.renderWordCloud || !self.cloudElement) return;
        stopCloud();
        const words = wordFrequencies(charts.filteredFacts().map((f) => f.situation));
        stopCloud = deps.renderWordCloud(self.cloudElement, words) || (() => {});
    }

    /** Pull the figures KO shows (counts, durations, table) from the charts. */
    self.syncFromCharts = function () {
        const facts = charts.filteredFacts();
        self.totalCount(charts.totalCount());
        self.filteredCount(facts.length);
        self.durations(summarizeDurations(facts.map((f) => f.durationMs)));
        self.latestJobs(charts.latest(LATEST_ROWS).map(toRow));
        self.receivedFiltered(charts.isFiltered("received"));
        self.closedFiltered(charts.isFiltered("closed"));
        self.durationFiltered(charts.isFiltered("duration"));
        for (const b of self.breakdowns) {
            b.filtered(charts.isFiltered(b.key));
            b.filterText(charts.filterLabels(b.key).join(", "));
        }
        // The cloud layout is the slow part; wait for clicking to settle.
        clearTimeout(cloudTimer);
        cloudTimer = setTimeout(renderCloud, 300);
    };

    // Row fields are never empty and never share a name with a window
    // global: knockout-secure-binding falls back to `window` for a falsy
    // value, so `closed: ""` would show window.closed ("false").
    function toRow(f) {
        return {
            jobIdentifier: f.identifier,
            jobUrl: `${self.source}/Jobs/${f.id}`,
            jobType: f.type,
            jobStatus: f.status,
            receivedText: ROW_FMT.format(f.received),
            closedText: f.closed ? ROW_FMT.format(f.closed) : "—",
            addressText: f.address || "—",
            situationText: f.situation || "—",
        };
    }

    self.resetBreakdown = function (breakdown) {
        charts.resetChart(breakdown.key);
    };
    self.resetChart = function (key) {
        charts.resetChart(key);
    };
    self.resetReceived = () => self.resetChart("received");
    self.resetClosed = () => self.resetChart("closed");
    self.resetDuration = () => self.resetChart("duration");
    self.resetAll = function () {
        charts.resetAll();
    };

    // ---- loading --------------------------------------------------------

    let inFlight = null;

    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
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
        const firstLoad = !charts.built;
        const range = rangeForChoice(launchRange, self.rangeChoice(), now());
        self.range(range);
        self.error(null);
        if (firstLoad) {
            self.loading(true);
            self.loadPhase("starting");
            self.loadLoaded(0);
            self.loadTotal(null);
            self.firstPageAt(null);
            self.lastPageAt(null);
            self.loadStartedAt(+now());
            self.clock(+now());
        } else {
            self.refreshing(true);
        }

        const run = (async () => {
            if (!isValidRange(range)) throw new Error("This page was opened without a valid start and end date.");
            if (self.units() === null) {
                self.units(await loadUnits(client, params.hqIds, ctx({ signal: controller.signal })));
                if (deps.clusters) self.clusters = await deps.clusters();
            }
            const result = await loadJobs(client, { units: self.units(), ...range, clusters: self.clusters }, ctx({
                signal: controller.signal,
                onProgress: (done, total) => {
                    if (!firstLoad || controller.signal.aborted) return;
                    const at = +now();
                    if (self.firstPageAt() === null) self.firstPageAt(at);
                    self.lastPageAt(at);
                    self.loadTotal(total);
                    self.loadLoaded(done);
                    self.clock(at);
                    self.loadPhase("incidents");
                },
            }));
            if (controller.signal.aborted) return;
            if (firstLoad) {
                if (self.loadTotal() === null) self.loadTotal(result.total);
                self.loadLoaded(result.total);
                self.loadPhase("charts");
                // Let "Building charts…" paint before the (synchronous) chart build.
                await new Promise((resolve) => setTimeout(resolve, 30));
                if (controller.signal.aborted) return;
            }
            self.events(result.events);
            charts.load(result.facts, range.start, range.end);
            self.syncFromCharts();
            self.loadedAt(now());
            self.loading(false);
        })();

        // Callers joining this load get the handled promise, never a rejection.
        const settled = (async () => {
            try {
                await run;
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("Incident statistics load failed", err);
                self.error(errorText(err));
            } finally {
                if (inFlight && inFlight.controller === controller) {
                    inFlight = null;
                    self.refreshing(false);
                }
                self.secondsToRefresh(REFRESH_SECONDS);
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

    /** Called once a second by main.js. */
    self.tick = function () {
        self.clock(+now());
        if (self.loading() || self.error()) return;
        const next = self.secondsToRefresh() - 1;
        if (next <= 0) {
            self.secondsToRefresh(REFRESH_SECONDS);
            self.load();
        } else {
            self.secondsToRefresh(next);
        }
    };

    self.rangeChoice.subscribe(() => {
        if (self.token()) self.load({ replace: true });
    });

    /** The first token starts the first load; renewed tokens are just stored. */
    self.setToken = function (token) {
        const first = !self.token();
        self.token(token);
        if (first) self.load();
    };
}
