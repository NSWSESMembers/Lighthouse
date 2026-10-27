/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { isValidRange, rangeText, scopeTitle } from "../../shared/params.js";
import { loadUnits, errorText } from "../../shared/beacon.js";
import { describeLoad } from "../../shared/incidentLoad.js";
import { FIELD_GROUPS, DEFAULT_KEYS, fieldFor, buildRows, orderedKeys } from "../data/fields.js";
import { toCsv, fileName } from "../data/csv.js";
import { fileStamp } from "../data/dates.js";
import { icemsIncidents, countIcemsUpdates } from "../data/icemsUpdates.js";
import { loadChoices, saveChoices, clearChoices } from "../data/choices.js";

const PAGE_NAME = "Incident Export";
// Rows in the preview table; the download has them all.
export const PREVIEW_ROWS = 10;
// Beacon hands the page its sign-in when it opens it. If none has come by
// then, the page wasn't opened from Beacon (or the sign-in has gone).
export const NO_TOKEN_MS = 15000;
export const NO_TOKEN_TEXT = "Lighthouse has no Beacon sign-in for this page. Open Incident Export again from Beacon.";

/**
 * Incident Export page: pick columns, see the first rows, download a CSV
 * of every incident in the range the page was opened with.
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

    self.loading = ko.observable(true);   // first load: the ring
    self.reloading = ko.observable(false); // Reload: small spinner
    self.loadPhase = ko.observable("starting"); // starting | incidents | finishing
    self.loadLoaded = ko.observable(0);
    self.loadTotal = ko.observable(null);
    self.loadStartedAt = ko.observable(+now());
    self.firstPageAt = ko.observable(null);
    self.lastPageAt = ko.observable(null);
    self.clock = ko.observable(+now());
    self.error = ko.observable(null);

    self.jobs = ko.observableArray([]);
    self.loadedAt = ko.observable(null);

    // ---- headings -------------------------------------------------------

    self.scopeTitle = ko.pureComputed(() => {
        const units = self.units();
        return units ? scopeTitle(units) : "…";
    });
    self.pageTitle = ko.pureComputed(() => `${PAGE_NAME}: ${self.scopeTitle()}`);
    self.rangeText = rangeText(range);

    self.loader = ko.pureComputed(() => describeLoad({
        phase: self.loadPhase(),
        loaded: self.loadLoaded(),
        total: self.loadTotal(),
        startedAt: self.loadStartedAt(),
        firstPageAt: self.firstPageAt(),
        lastPageAt: self.lastPageAt(),
        now: self.clock(),
        finishingTitle: "Preparing the export…",
    }));

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

    // ---- ICEMS update counts (only when that column is ticked) ----------

    self.icemsUpdates = ko.observable(null); // Map once counted for the current incidents
    self.icemsCounting = ko.observable(false);
    self.icemsDone = ko.observable(0);
    self.icemsTotal = ko.observable(0);
    self.icemsFailed = ko.observable(0);
    self.needsIcems = ko.pureComputed(() => self.selectedKeys().some((k) => fieldFor(k).needsIcemsUpdates));

    let icemsRun = null;
    function ctx(extra) {
        return { host: params.host, userId: params.userId, token: self.token(), ...extra };
    }

    self.countIcems = async function () {
        if (icemsRun) return icemsRun.promise;
        const controller = new AbortController();
        const jobs = icemsIncidents(self.jobs());
        self.icemsCounting(true);
        self.icemsFailed(0);
        const promise = countIcemsUpdates(client, jobs, ctx({ signal: controller.signal }), {
            onProgress: (done, total) => {
                self.icemsDone(done);
                self.icemsTotal(total);
            },
        }).then(({ counts, failed }) => {
            if (controller.signal.aborted) return;
            self.icemsUpdates(counts);
            self.icemsFailed(failed);
        }).finally(() => {
            if (icemsRun && icemsRun.controller === controller) {
                icemsRun = null;
                self.icemsCounting(false);
            }
        });
        icemsRun = { controller, promise };
        return promise;
    };

    function stopIcems() {
        if (icemsRun) icemsRun.controller.abort();
        icemsRun = null;
        self.icemsCounting(false);
        self.icemsUpdates(null);
    }

    self.needsIcems.subscribe((needed) => {
        if (needed && !self.loading() && !self.icemsUpdates()) self.countIcems();
    });

    self.icemsText = ko.pureComputed(() => {
        if (self.icemsCounting()) return `Counting ICEMS updates: ${self.icemsDone()} of ${self.icemsTotal()} ICEMS incidents`;
        const failed = self.icemsFailed();
        if (failed) return `Couldn't read the Ops Log for ${failed} ICEMS ${failed === 1 ? "incident" : "incidents"}: their count is left empty.`;
        return "";
    });
    self.icemsPct = ko.pureComputed(() => {
        const total = self.icemsTotal();
        return { width: (total ? Math.round((self.icemsDone() / total) * 100) : 0) + "%" };
    });

    // ---- preview and download -------------------------------------------

    self.countText = ko.pureComputed(() => {
        const n = self.jobs().length;
        return `${n.toLocaleString()} ${n === 1 ? "incident" : "incidents"}`;
    });
    self.isEmpty = ko.pureComputed(() => !self.loading() && !self.error() && self.jobs().length === 0);

    // Cells are { text } objects, not bare strings: knockout-secure-binding
    // falls back to `window` for a falsy binding value, and `text` isn't a
    // window global, so an empty cell stays empty.
    self.previewHeader = ko.pureComputed(() => self.selectedKeys().map((k) => fieldFor(k).label));
    self.previewRows = ko.pureComputed(() => {
        const keys = self.selectedKeys();
        const extra = { icemsUpdates: self.icemsUpdates() };
        const pending = self.needsIcems() && !self.icemsUpdates();
        return buildRows(self.jobs().slice(0, PREVIEW_ROWS), keys, extra).map((cells) => ({
            cells: cells.map((c, i) => ({
                text: pending && fieldFor(keys[i]).needsIcemsUpdates ? "…" : String(c),
            })),
        }));
    });
    self.previewNote = ko.pureComputed(() => {
        const n = self.jobs().length;
        if (n <= PREVIEW_ROWS) return "";
        return `First ${PREVIEW_ROWS} of ${n.toLocaleString()} incidents. The download has them all.`;
    });

    self.canDownload = ko.pureComputed(() =>
        !self.loading() && !self.reloading() && !self.noneSelected() && self.jobs().length > 0 && !self.icemsCounting());
    self.downloadText = ko.pureComputed(() => {
        if (self.icemsCounting()) return "Counting ICEMS updates…";
        return `Download CSV (${self.countText()})`;
    });
    self.downloadHint = ko.pureComputed(() => {
        if (self.noneSelected()) return "Tick at least one column to export.";
        return "";
    });

    /** The CSV for the ticked columns (header = Beacon field names, as the old page). */
    self.csvText = function () {
        const keys = self.selectedKeys();
        return toCsv(keys, buildRows(self.jobs(), keys, { icemsUpdates: self.icemsUpdates() }));
    };

    self.download = async function () {
        if (!self.canDownload()) return;
        if (self.needsIcems() && !self.icemsUpdates()) await self.countIcems();
        saveFile(fileName(self.scopeTitle(), fileStamp(now())), self.csvText());
    };

    // ---- loading --------------------------------------------------------

    let inFlight = null;

    /** Fetch every incident in the range (first load, Try again, Reload). */
    self.load = async function () {
        if (inFlight) return inFlight;
        const firstLoad = self.loadedAt() === null;
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
            self.reloading(true);
        }

        inFlight = (async () => {
            try {
                if (!isValidRange(range)) throw new Error("This page was opened without a valid start and end date. Open it again from Beacon.");
                if (self.units() === null) self.units(await loadUnits(client, params.hqIds, ctx()));
                const units = self.units();
                // job.search takes a single entity, an array, or [] for no HQ filter.
                const scope = units.length === 1 ? units[0] : units;
                const { results } = await client.job.search(scope, range.start, range.end, ctx({
                    onProgress: (done, total) => {
                        if (!firstLoad) return;
                        const at = +now();
                        if (self.firstPageAt() === null) self.firstPageAt(at);
                        self.lastPageAt(at);
                        self.loadTotal(total);
                        self.loadLoaded(done);
                        self.clock(at);
                        self.loadPhase("incidents");
                    },
                }));
                if (firstLoad) {
                    if (self.loadTotal() === null) self.loadTotal(results.length);
                    self.loadLoaded(results.length);
                    self.loadPhase("finishing");
                }
                stopIcems();
                self.jobs(results);
                self.loadedAt(now());
                self.loading(false);
                if (self.needsIcems()) self.countIcems();
            } catch (err) {
                console.error("Incident export load failed", err);
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

    self.loadedText = ko.pureComputed(() => {
        const at = self.loadedAt();
        if (!at) return "";
        return "Loaded " + at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    });

    /** Each second, for the ring's waiting time. */
    self.tick = function () {
        if (!self.loading()) return;
        self.clock(+now());
        if (!self.token() && !self.error() && +now() - self.loadStartedAt() >= NO_TOKEN_MS) self.error(NO_TOKEN_TEXT);
    };

    self.setToken = function (token) {
        const first = !self.token();
        self.token(token);
        if (first) self.load();
    };
}
