/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { isValidRange, rangeText, scopeTitle } from "../../shared/params.js";
import { loadUnits, errorText } from "../../shared/beacon.js";
import { describeLoad } from "../../shared/incidentLoad.js";
import { waitingRing } from "../../shared/loadRing.js";
import { toCsv, fileName } from "../../shared/csv.js";
import { fileStamp } from "../../shared/dates.js";
import { REPORTS, PREVIEW_LABELS, buildReport } from "../data/reports.js";
import { filtersText } from "../data/filters.js";

const PAGE_NAME = "NITC Export";
// The preview is one small request: the newest PREVIEW_ROWS tasks, with
// Beacon's total. Download CSV fetches every task then.
export const PREVIEW_ROWS = 10;
// Beacon hands the page its sign-in when it opens it. If none has come by
// then, the page wasn't opened from Beacon (or the sign-in has gone).
export const NO_TOKEN_MS = 15000;
export const NO_TOKEN_TEXT = "Lighthouse has no Beacon sign-in for this page. Open NITC Export again from Beacon's NITC screen.";
// The report picked last time (localStorage).
export const REPORT_KEY = "lh-nitcexport-report";

const FILE_NAMES = { activity: "NITC activities", member: "NITC members" };

function loadReport(storage) {
    try {
        const value = storage && storage.getItem(REPORT_KEY);
        return REPORTS.some((r) => r.value === value) ? value : "activity";
    } catch {
        return "activity";
    }
}

/**
 * NITC Export page: pick the report, preview it from the newest tasks, and
 * download a CSV built from every task the NITC screen's filters match.
 *
 * @param {object} deps
 * @param {{host, source, userId, hqIds, start, end}} deps.params  parsePageParams()
 * @param {object} deps.filters  nitcFilters(): what BeaconClient.nitc.search takes
 * @param {object} deps.client   BeaconClient (unit.getName, nitc.search)
 * @param {string} [deps.guideUrl]
 * @param {Storage} [deps.storage]  remembers the report (localStorage)
 * @param {(name: string, text: string) => void} [deps.saveFile]  hands the CSV to the browser
 * @param {() => Date} [deps.now]
 */
export function NitcExportVM(deps) {
    const self = this;
    const { params, client } = deps;
    const filters = deps.filters || {};
    const now = deps.now || (() => new Date());
    const storage = deps.storage || null;
    const saveFile = deps.saveFile || (() => {});
    const range = { start: params.start, end: params.end };

    self.source = params.source;
    self.guideUrl = deps.guideUrl || "https://lighthouse.ses.nsw.gov.au/guides/nitc/";

    // Token arrives from chrome.storage (setToken) after construction.
    self.token = ko.observable("");
    self.units = ko.observable(null); // null until looked up

    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
    }

    self.clock = ko.observable(+now()); // ticks each second while something loads (tick)

    // ---- headings -------------------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeTitle(units) : "…";
    });
    self.pageTitle = ko.pureComputed(() => `${PAGE_NAME}: ${self.scopeTitle()}`);
    self.rangeText = rangeText(range);
    self.filtersText = filtersText(filters);

    // ---- report ---------------------------------------------------------

    self.reports = REPORTS;
    self.report = ko.observable(loadReport(storage));
    self.report.subscribe((value) => {
        try {
            if (storage) storage.setItem(REPORT_KEY, value);
        } catch {
            // private window or storage full: just not remembered
        }
    });
    self.reportHint = ko.pureComputed(() => REPORTS.find((r) => r.value === self.report()).hint);
    self.isMemberList = ko.pureComputed(() => self.report() === "member");

    // ---- preview: the newest PREVIEW_ROWS, one small request --------------

    self.loading = ko.observable(true);    // first preview: the loading card
    self.reloading = ko.observable(false); // Reload: small spinner
    self.loadStartedAt = ko.observable(+now());
    self.error = ko.observable(null);      // the preview's load error
    self.previewTasks = ko.observableArray([]);
    self.total = ko.observable(0);         // Beacon's count for the whole range
    self.loadedAt = ko.observable(null);

    self.loader = ko.pureComputed(() => waitingRing({
        startedAt: self.loadStartedAt(),
        now: self.clock(),
        title: "Asking Beacon for tasks…",
    }));

    let inFlight = null;

    /** The preview (first load, Try again, Reload). */
    self.load = async function () {
        if (inFlight) return inFlight;
        const firstLoad = self.loadedAt() === null;
        self.error(null);
        if (firstLoad) {
            self.loading(true);
            self.loadStartedAt(+now());
            self.clock(+now());
        } else {
            self.reloading(true);
        }

        inFlight = (async () => {
            try {
                if (!isValidRange(range)) throw new Error("This page was opened without a valid start and end date. Open it again from Beacon's NITC screen.");
                if (self.units() === null) self.units(await loadUnits(client, params.hqIds, ctx()));
                const { results, totalItems } = await client.nitc.search(filters, range.start, range.end,
                    ctx({ pageSize: PREVIEW_ROWS, pageLimit: 1 }));
                const rows = results.slice(0, PREVIEW_ROWS);
                self.previewTasks(rows);
                self.total(Math.max(totalItems || 0, rows.length));
                self.loadedAt(now());
                self.loading(false);
            } catch (err) {
                console.error("NITC export preview failed", err);
                self.error(errorText(err, PAGE_NAME));
            } finally {
                self.reloading(false);
                inFlight = null;
            }
        })();
        return inFlight;
    };

    self.retry = function () {
        if (!self.token()) {
            self.error(NO_TOKEN_TEXT);
            return Promise.resolve();
        }
        return self.load();
    };
    self.reload = () => self.load();

    const tasksText = (n) => `${n.toLocaleString()} ${n === 1 ? "task" : "tasks"}`;
    self.countText = ko.pureComputed(() => tasksText(self.total()));
    self.isEmpty = ko.pureComputed(() => !self.loading() && !self.error() && self.total() === 0);
    self.loadedText = ko.pureComputed(() => {
        const at = self.loadedAt();
        if (!at) return "";
        return "Checked " + at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    });

    // Cells are { text } objects, not bare strings: knockout-secure-binding
    // falls back to `window` for a falsy binding value, and `text` isn't a
    // window global, so an empty cell stays empty.
    const preview = ko.pureComputed(() => buildReport(self.report(), self.previewTasks()));
    self.previewHeader = ko.pureComputed(() => preview().header.map((h) => ({ text: PREVIEW_LABELS[h] || h })));
    self.previewRows = ko.pureComputed(() => preview().rows.map((cells) => ({
        cells: cells.map((c) => ({ text: String(c) })),
    })));
    self.previewEmpty = ko.pureComputed(() => preview().rows.length === 0);
    self.previewNote = ko.pureComputed(() => {
        const n = self.total();
        const shown = self.previewTasks().length;
        if (n <= shown) return "";
        if (self.isMemberList()) return `Hours from the newest ${shown} of ${tasksText(n)}. Download CSV adds up all of them.`;
        return `Newest ${shown} of ${tasksText(n)}. Download CSV fetches them all.`;
    });

    // ---- download: every task ---------------------------------------------

    self.downloading = ko.observable(false);
    self.dlPhase = ko.observable("starting"); // starting | incidents (describeLoad's name for "fetching")
    self.dlLoaded = ko.observable(0);
    self.dlTotal = ko.observable(null);
    self.dlStartedAt = ko.observable(+now());
    self.dlFirstPageAt = ko.observable(null);
    self.dlLastPageAt = ko.observable(null);
    self.dlError = ko.observable(null);

    self.dlLoader = ko.pureComputed(() => describeLoad({
        phase: self.dlPhase(),
        loaded: self.dlLoaded(),
        total: self.dlTotal(),
        startedAt: self.dlStartedAt(),
        firstPageAt: self.dlFirstPageAt(),
        lastPageAt: self.dlLastPageAt(),
        now: self.clock(),
        one: "task",
        many: "tasks",
    }));

    self.canDownload = ko.pureComputed(() =>
        !self.loading() && !self.reloading() && !self.downloading() && self.total() > 0);
    self.downloadText = ko.pureComputed(() => `Download CSV (${self.countText()})`);

    let dlController = null;

    self.download = async function () {
        if (!self.canDownload()) return;
        const controller = new AbortController();
        dlController = controller;
        const aborted = () => controller.signal.aborted;
        const report = self.report();
        self.downloading(true);
        self.dlError(null);
        self.dlPhase("starting");
        self.dlLoaded(0);
        self.dlTotal(null);
        self.dlFirstPageAt(null);
        self.dlLastPageAt(null);
        self.dlStartedAt(+now());
        self.clock(+now());
        try {
            const { results } = await client.nitc.search(filters, range.start, range.end, ctx({
                signal: controller.signal,
                onProgress: (done, total) => {
                    if (aborted()) return;
                    const at = +now();
                    if (self.dlFirstPageAt() === null) self.dlFirstPageAt(at);
                    self.dlLastPageAt(at);
                    self.dlTotal(total);
                    self.dlLoaded(done);
                    self.clock(at);
                    self.dlPhase("incidents");
                },
            }));
            if (aborted()) return;
            self.total(results.length); // Beacon's latest count
            const { header, rows } = buildReport(report, results);
            saveFile(fileName(FILE_NAMES[report], self.scopeTitle(), fileStamp(now())), toCsv(header, rows));
            self.downloading(false);
        } catch (err) {
            if (aborted()) return;
            console.error("NITC export download failed", err);
            self.dlError(errorText(err, PAGE_NAME));
        } finally {
            if (dlController === controller) dlController = null;
        }
    };

    /** Stop a download in progress (or close its error). */
    self.cancelDownload = function () {
        if (dlController) dlController.abort();
        dlController = null;
        self.downloading(false);
        self.dlError(null);
    };
    self.retryDownload = function () {
        self.downloading(false);
        return self.download();
    };

    // ---- clock and token --------------------------------------------------

    /** Each second, for the rings' waiting times and the no-sign-in message. */
    self.tick = function () {
        if (!self.loading() && !self.downloading()) return;
        self.clock(+now());
        if (self.loading() && !self.token() && !self.error() && +now() - self.loadStartedAt() >= NO_TOKEN_MS) self.error(NO_TOKEN_TEXT);
    };

    self.setToken = function (token) {
        const first = !self.token();
        self.token(token);
        if (first) self.load();
    };
}
