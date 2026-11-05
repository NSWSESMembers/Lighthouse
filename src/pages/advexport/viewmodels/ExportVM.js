/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { isValidRange, rangeText, scopeTitle } from "../../shared/params.js";
import { loadUnits, errorText } from "../../shared/beacon.js";
import { describeLoad } from "../../shared/incidentLoad.js";
import { waitingRing } from "../../shared/loadRing.js";
import { FIELD_GROUPS, DEFAULT_KEYS, fieldFor, buildRows, orderedKeys } from "../data/fields.js";
import { toCsv, fileName } from "../../shared/csv.js";
import { fileStamp } from "../../shared/dates.js";
import { icemsIncidents, countIcemsUpdates } from "../data/icemsUpdates.js";
import { loadChoices, saveChoices, clearChoices } from "../data/choices.js";

const PAGE_NAME = "Incident Export";
// The preview is one small request: the newest PREVIEW_ROWS incidents, with
// Beacon's total. Download CSV fetches every incident then.
export const PREVIEW_ROWS = 10;
// Beacon hands the page its sign-in when it opens it. If none has come by
// then, the page wasn't opened from Beacon (or the sign-in has gone).
export const NO_TOKEN_MS = 15000;
export const NO_TOKEN_TEXT = "Lighthouse has no Beacon sign-in for this page. Open Incident Export again from Beacon.";

/**
 * Incident Export page: pick columns, preview the newest incidents, and
 * download a CSV of every incident in the range the page was opened with.
 *
 * @param {object} deps
 * @param {{host, source, userId, hqIds, start, end}} deps.params  parsePageParams()
 * @param {object} deps.client   BeaconClient (unit.getName, job.search, operationslog.search)
 * @param {string} [deps.guideUrl]
 * @param {Storage} [deps.storage]  remembers the ticked columns (localStorage)
 * @param {(name: string, text: string) => void} [deps.saveFile]  hands the CSV to the browser
 * @param {() => Date} [deps.now]
 */
export function ExportVM(deps) {
    const self = this;
    const { params, client } = deps;
    const now = deps.now || (() => new Date());
    const storage = deps.storage || null;
    const saveFile = deps.saveFile || (() => {});
    const range = { start: params.start, end: params.end };

    self.source = params.source;
    self.guideUrl = deps.guideUrl || "https://lighthouse.ses.nsw.gov.au/guides/export/";

    // Token arrives from chrome.storage (setToken) after construction.
    self.token = ko.observable("");
    self.units = ko.observable(null); // null until looked up

    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
    }
    // job.search takes a single entity, an array, or [] for no HQ filter.
    function searchScope() {
        const units = self.units();
        return units.length === 1 ? units[0] : units;
    }

    self.clock = ko.observable(+now()); // ticks each second while something loads (tick)

    // ---- headings -------------------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeTitle(units) : "…";
    });
    self.pageTitle = ko.pureComputed(() => `${PAGE_NAME}: ${self.scopeTitle()}`);
    self.rangeText = rangeText(range);

    // ---- columns --------------------------------------------------------

    const saved = new Set(storage ? loadChoices(storage) : DEFAULT_KEYS);
    self.groups = FIELD_GROUPS.map((g, gi) => {
        const fields = g.fields.map((f) => ({
            key: f.key,
            label: f.label,
            id: `field-${gi}-${f.key.replace(/[^A-Za-z0-9]/g, "-")}`,
            checked: ko.observable(saved.has(f.key)),
        }));
        const group = {
            title: g.title,
            fields,
            selectAll: () => fields.forEach((f) => f.checked(true)),
            selectNone: () => fields.forEach((f) => f.checked(false)),
        };
        group.allChecked = ko.pureComputed(() => fields.every((f) => f.checked()));
        group.noneChecked = ko.pureComputed(() => fields.every((f) => !f.checked()));
        return group;
    });
    const allFields = self.groups.flatMap((g) => g.fields);

    self.selectedKeys = ko.pureComputed(() => orderedKeys(allFields.filter((f) => f.checked()).map((f) => f.key)));
    self.noneSelected = ko.pureComputed(() => self.selectedKeys().length === 0);
    self.isDefaultChoice = ko.pureComputed(() => {
        const keys = self.selectedKeys();
        return keys.length === DEFAULT_KEYS.length && orderedKeys(DEFAULT_KEYS).every((k, i) => k === keys[i]);
    });
    self.selectedKeys.subscribe((keys) => {
        if (storage) saveChoices(storage, keys);
    });
    self.resetChoices = function () {
        const defaults = new Set(DEFAULT_KEYS);
        allFields.forEach((f) => f.checked(defaults.has(f.key)));
        if (storage) clearChoices(storage);
    };
    self.needsIcems = ko.pureComputed(() => self.selectedKeys().some((k) => fieldFor(k).needsIcemsUpdates));

    // ---- preview: the newest PREVIEW_ROWS, one small request --------------

    self.loading = ko.observable(true);    // first preview: the loading card
    self.reloading = ko.observable(false); // Reload: small spinner
    self.loadStartedAt = ko.observable(+now());
    self.error = ko.observable(null);      // the preview's load error
    self.previewJobs = ko.observableArray([]);
    self.total = ko.observable(0);         // Beacon's count for the whole range
    self.loadedAt = ko.observable(null);

    self.loader = ko.pureComputed(() => waitingRing({
        startedAt: self.loadStartedAt(),
        now: self.clock(),
        title: "Asking Beacon for incidents…",
    }));

    // ICEMS counts for the preview rows only (a handful of Ops Logs).
    self.previewIcems = ko.observable(null);
    let previewIcemsFor = null;
    function countPreviewIcems() {
        const jobs = self.previewJobs();
        if (previewIcemsFor === jobs) return;
        previewIcemsFor = jobs;
        self.previewIcems(null);
        countIcemsUpdates(client, icemsIncidents(jobs), ctx()).then(({ counts }) => {
            if (previewIcemsFor === jobs) self.previewIcems(counts);
        });
    }
    self.needsIcems.subscribe((needed) => {
        if (needed && !self.loading()) countPreviewIcems();
    });

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
                if (!isValidRange(range)) throw new Error("This page was opened without a valid start and end date. Open it again from Beacon.");
                if (self.units() === null) self.units(await loadUnits(client, params.hqIds, ctx()));
                const { results, totalItems } = await client.job.search(searchScope(), range.start, range.end,
                    ctx({ pageSize: PREVIEW_ROWS, pageLimit: 1 }));
                const rows = results.slice(0, PREVIEW_ROWS);
                self.previewJobs(rows);
                self.total(Math.max(totalItems || 0, rows.length));
                self.loadedAt(now());
                self.loading(false);
                if (self.needsIcems()) countPreviewIcems();
            } catch (err) {
                console.error("Incident export preview failed", err);
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

    self.countText = ko.pureComputed(() => {
        const n = self.total();
        return `${n.toLocaleString()} ${n === 1 ? "incident" : "incidents"}`;
    });
    self.isEmpty = ko.pureComputed(() => !self.loading() && !self.error() && self.total() === 0);
    self.loadedText = ko.pureComputed(() => {
        const at = self.loadedAt();
        if (!at) return "";
        return "Checked " + at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    });

    // Cells are { text } objects, not bare strings: knockout-secure-binding
    // falls back to `window` for a falsy binding value, and `text` isn't a
    // window global, so an empty cell stays empty.
    self.previewHeader = ko.pureComputed(() => self.selectedKeys().map((k) => fieldFor(k).label));
    self.previewRows = ko.pureComputed(() => {
        const keys = self.selectedKeys();
        const icems = self.previewIcems();
        return buildRows(self.previewJobs(), keys, { icemsUpdates: icems }).map((cells) => ({
            cells: cells.map((c, i) => ({
                text: !icems && fieldFor(keys[i]).needsIcemsUpdates ? "…" : String(c),
            })),
        }));
    });
    self.previewNote = ko.pureComputed(() => {
        const n = self.total();
        if (n <= self.previewJobs().length) return "";
        return `Newest ${self.previewJobs().length} of ${n.toLocaleString()} incidents. Download CSV fetches them all.`;
    });

    // ---- download: every incident, then (if ticked) ICEMS counts ----------

    self.downloading = ko.observable(false);
    self.dlPhase = ko.observable("starting"); // starting | incidents | icems
    self.dlLoaded = ko.observable(0);
    self.dlTotal = ko.observable(null);
    self.dlStartedAt = ko.observable(+now());
    self.dlFirstPageAt = ko.observable(null);
    self.dlLastPageAt = ko.observable(null);
    self.dlError = ko.observable(null);
    self.icemsDone = ko.observable(0);
    self.icemsTotal = ko.observable(0);
    self.icemsFailed = ko.observable(0); // in the last download

    self.dlLoader = ko.pureComputed(() => {
        const icems = self.dlPhase() === "icems";
        return describeLoad({
            phase: icems ? "finishing" : self.dlPhase(),
            loaded: self.dlLoaded(),
            total: self.dlTotal(),
            startedAt: self.dlStartedAt(),
            firstPageAt: self.dlFirstPageAt(),
            lastPageAt: self.dlLastPageAt(),
            now: self.clock(),
            finishingTitle: `Counting ICEMS updates: ${self.icemsDone()} of ${self.icemsTotal()}`,
        });
    });
    self.icemsPct = ko.pureComputed(() => {
        const total = self.icemsTotal();
        return { width: (total ? Math.round((self.icemsDone() / total) * 100) : 0) + "%" };
    });
    self.dlCounting = ko.pureComputed(() => self.dlPhase() === "icems");
    self.icemsText = ko.pureComputed(() => {
        const failed = self.icemsFailed();
        if (!failed) return "";
        return `Couldn't read the Ops Log for ${failed} ICEMS ${failed === 1 ? "incident" : "incidents"}: their count is empty in the CSV.`;
    });

    self.canDownload = ko.pureComputed(() =>
        !self.loading() && !self.reloading() && !self.downloading() && !self.noneSelected() && self.total() > 0);
    self.downloadText = ko.pureComputed(() => `Download CSV (${self.countText()})`);
    self.downloadHint = ko.pureComputed(() => (self.noneSelected() ? "Tick at least one column to export." : ""));

    /** The CSV for the ticked columns (header = Beacon field names, as the old page). */
    self.csvText = function (jobs, icemsUpdates) {
        const keys = self.selectedKeys();
        return toCsv(keys, buildRows(jobs, keys, { icemsUpdates }));
    };

    let dlController = null;

    self.download = async function () {
        if (!self.canDownload()) return;
        const controller = new AbortController();
        dlController = controller;
        const aborted = () => controller.signal.aborted;
        self.downloading(true);
        self.dlError(null);
        self.dlPhase("starting");
        self.dlLoaded(0);
        self.dlTotal(null);
        self.dlFirstPageAt(null);
        self.dlLastPageAt(null);
        self.dlStartedAt(+now());
        self.clock(+now());
        self.icemsFailed(0);
        try {
            const { results } = await client.job.search(searchScope(), range.start, range.end, ctx({
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
            if (self.dlTotal() === null) self.dlTotal(results.length);
            self.dlLoaded(results.length);
            self.total(results.length); // Beacon's latest count

            let icemsUpdates = null;
            if (self.needsIcems()) {
                const icems = icemsIncidents(results);
                self.icemsDone(0);
                self.icemsTotal(icems.length);
                self.dlPhase("icems");
                const { counts, failed } = await countIcemsUpdates(client, icems, ctx({ signal: controller.signal }), {
                    onProgress: (done) => self.icemsDone(done),
                });
                if (aborted()) return;
                icemsUpdates = counts;
                self.icemsFailed(failed);
            }
            saveFile(fileName("Incident export", self.scopeTitle(), fileStamp(now())), self.csvText(results, icemsUpdates));
            self.downloading(false);
        } catch (err) {
            if (aborted()) return;
            console.error("Incident export download failed", err);
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
