// JobHistory.js

/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import { HistoryEntry } from "../models/HistoryEntry.js";
import { OpsLogEntry } from "../models/OpsLogEntry.js";

export function JobTimeline(parentVm) {
    const self = this;

    self.job = ko.observable(null);

    self.jobCreated = null;

    self.historyEntries = ko.observableArray([]);
    self.opsLogEntries = ko.observableArray([]);

    self.loading = ko.observable(false);
    self.jobIdentifier = ko.observable();

    self.selectedTags = ko.observableArray([]);

    // lane view mode: "both" | "history" | "ops"
    self.laneViewMode = ko.observable("both");

    self.showHistoryLane = ko.pureComputed(function () {
        var m = self.laneViewMode();
        return m === "both" || m === "history";
    });

    self.showOpsLane = ko.pureComputed(function () {
        var m = self.laneViewMode();
        return m === "both" || m === "ops";
    });

    self.showMiddleAxis = ko.pureComputed(function () {
        return self.showHistoryLane() && self.showOpsLane();
    });

    self.opsColClass = ko.pureComputed(function () {
        if (!self.showOpsLane()) {
            return "d-none";
        }
        if (self.showHistoryLane()) {
            // both lanes
            return "col-5";
        }
        // ops only
        return "col-12";
    });

    self.historyColClass = ko.pureComputed(function () {
        if (!self.showHistoryLane()) {
            return "d-none";
        }
        if (self.showOpsLane()) {
            // both lanes
            return "col-5";
        }
        // history only
        return "col-12";
    });

    self.middleColClass = ko.pureComputed(function () {
        if (!self.showMiddleAxis()) {
            return "d-none";
        }
        // keep the existing centre alignment
        return "col-2 d-flex flex-column align-items-center";
    });

    // button classes for the view mode toggle (KSB-safe: used via attr: { class: ... })
    self.laneBtnBothClass = ko.pureComputed(function () {
        var cls = "btn btn-sm btn-outline-secondary me-1";
        if (self.laneViewMode() === "both") {
            cls += " active";
        }
        return cls;
    });

    self.laneBtnHistoryClass = ko.pureComputed(function () {
        var cls = "btn btn-sm btn-outline-secondary me-1";
        if (self.laneViewMode() === "history") {
            cls += " active";
        }
        return cls;
    });

    self.laneBtnOpsClass = ko.pureComputed(function () {
        var cls = "btn btn-sm btn-outline-secondary";
        if (self.laneViewMode() === "ops") {
            cls += " active";
        }
        return cls;
    });

    // click handlers (no params; KSB-safe)
    self.setLaneViewBoth = function () {
        self.laneViewMode("both");
    };

    self.setLaneViewHistory = function () {
        self.laneViewMode("history");
    };

    self.setLaneViewOps = function () {
        self.laneViewMode("ops");
    };


    self.isTagSelected = function (tag) {
        return self.selectedTags.indexOf(tag) >= 0;
    };

    self.isIcems = function (tag) {
        return tag && tag.toLowerCase() === "icems";
    };

    self.tagButtonCss = function (tag) {
        return {
            "btn-outline-secondary": !self.isTagSelected(tag),
            "btn-secondary": self.isTagSelected(tag),
            "active": self.isTagSelected(tag),
            "jobhistory-tag-icems": self.isIcems(tag)
        };
    };

    self.tagFilterItems = ko.observableArray([]);

    self.rebuildTagFilterItems = function () {
        const existing = self.tagFilterItems();
        const map = new Map();

        // keep existing objects so selection state is preserved
        existing.forEach(item => {
            map.set(item.name().toLowerCase(), item);
        });

        // collect tags from OpsLog entries
        const neededKeys = new Set();

        self.opsLogEntries().forEach(o => {
            const tags = o.tags ? o.tags() : [];
            tags.forEach(t => {
                const n = (t.name?.() || "").trim();
                if (!n) return;
                neededKeys.add(n);
            });
        });

        const newItems = [];
        neededKeys.forEach(key => {
            let item = map.get(key);
            if (!item) {
                item = new TagFilterItem(key);
            }
            newItems.push(item);
        });

        // ICEMS first, then alpha
        newItems.sort((a, b) => {
            const al = (a.name() || "").toLowerCase();
            const bl = (b.name() || "").toLowerCase();
            if (al === "icems") return -1;
            if (bl === "icems") return 1;
            if (al < bl) return -1;
            if (al > bl) return 1;
            return 0;
        });

        self.tagFilterItems(newItems);
    };

    // rebuild tags whenever ops log entries change
    self.opsLogEntries.subscribe(() => {
        self.rebuildTagFilterItems();
    });

    // toggle when a button is clicked
    self.toggleTagFilter = function (tagItem) {
        console.log("Toggling tag filter:", tagItem);
        if (!tagItem || !tagItem.isSelected) return;
        tagItem.isSelected(!tagItem.isSelected());
    };

    function activeTagNames() {
        return self.tagFilterItems()
            .filter(t => t.isSelected())
            .map(t => (t.name() || ""));
    }

    function opsEntryMatchesTags(entry) {
        const selected = activeTagNames();
        if (!selected.length) return true; // no filter

        if (!entry || !entry.tags) return false;
        const tags = entry.tags();
        if (!Array.isArray(tags)) return false;

        const names = tags
            .map(t => (t.name?.() || ""))
            .filter(Boolean);

        // AND logic: every selected tag must be present
        return selected.every(tag => names.indexOf(tag) !== -1);
    }

    self.availableTags = ko.pureComputed(function () {
        var map = {}; // key = lowercase, value = display name

        if (self.opsLogEntries) {
            self.opsLogEntries().forEach(function (o) {
                if (!o.tags) return;
                var tags = o.tags();
                if (!Array.isArray(tags)) return;

                tags.forEach(function (t) {
                    var name = t.name ? t.name() : "";
                    if (!name) return;
                    var key = name;
                    if (!map[key]) {
                        map[key] = name; // preserve original case
                    }
                });
            });
        }

        var list = Object.keys(map).map(function (k) { return map[k]; });

        // ICEMS first, then alpha
        list.sort(function (a, b) {
            var al = a.toLowerCase();
            var bl = b.toLowerCase();
            if (al === "icems") return -1;
            if (bl === "icems") return 1;
            if (al < bl) return -1;
            if (al > bl) return 1;
            return 0;
        });

        return list;
    });


    const parseDate = (v) => {
        if (!v) return null;
        const m = moment(v, [
            moment.ISO_8601,
            "YYYY-MM-DDTHH:mm:ss",
            "YYYY-MM-DD HH:mm:ss",
            "YYYY-MM-DD HH:mm",
            "YYYY-MM-DDTHH:mm"
        ], true);
        return m.isValid() ? m : null;
    };

    // still useful if you want separate views anywhere
    self.sortedHistoryEntries = ko.pureComputed(() => {
        return self.historyEntries()
            .slice()
            .sort((a, b) => {
                const am = parseDate(a.timeStampRaw && a.timeStampRaw() || a.timeLoggedRaw && a.timeLoggedRaw());
                const bm = parseDate(b.timeStampRaw && b.timeStampRaw() || b.timeLoggedRaw && b.timeLoggedRaw());
                const aT = am ? am.valueOf() : 0;
                const bT = bm ? bm.valueOf() : 0;
                return bT - aT; // newest first
            });
    });

    self.sortedOpsLogEntries = ko.pureComputed(() => {
        return self.opsLogEntries()
            .slice()
            .sort((a, b) => {
                const am = parseDate(a.timeLogged && a.timeLogged() || a.createdOn && a.createdOn());
                const bm = parseDate(b.timeLogged && b.timeLogged() || b.createdOn && b.createdOn());
                const aT = am ? am.valueOf() : 0;
                const bT = bm ? bm.valueOf() : 0;
                return bT - aT; // newest first
            });
    });

    // --- combined “two-lane” timeline ---
    // --- combined “two-lane” timeline ---
    self.timelineBuckets = ko.pureComputed(() => {
        const map = new Map();

        const add = (kind, entry, raw) => {
            const m = parseDate(raw);
            if (!m) return;

            // *** group by minute ***
            const minute = m.clone().seconds(0).milliseconds(0);

            const key = minute.valueOf();
            let bucket = map.get(key);
            if (!bucket) {
                let tPlus = "";
                if (self.jobCreated) {
                    const diffMs = minute.diff(self.jobCreated);   // milliseconds
                    const dur = moment.duration(diffMs);

                    // absolute values for formatting
                    const hh = String(Math.floor(Math.abs(dur.asHours()))).padStart(2, "0");
                    const mm = String(Math.abs(dur.minutes())).padStart(2, "0");
                    const ss = String(Math.abs(dur.seconds())).padStart(2, "0");

                    const prefix = diffMs >= 0 ? "T+" : "T-";
                    tPlus = `${prefix}${hh}:${mm}:${ss}`;
                }


                bucket = {
                    key,
                    label: minute.format("DD/MM/YYYY HH:mm"),
                    rel: minute.fromNow(),
                    tPlus: tPlus,
                    ops: [],
                    history: []
                };
                map.set(key, bucket);
            }

            if (kind === "ops") {
                bucket.ops.push(entry);
            } else {
                bucket.history.push(entry);
            }
        };

        // history: prefer TimeStamp, fallback TimeLogged
        self.historyEntries().forEach(h => {
            const raw =
                (h.timeStampRaw && h.timeStampRaw()) ||
                (h.timeLoggedRaw && h.timeLoggedRaw());
            add("history", h, raw);
        });

        // ops: prefer TimeLogged, fallback CreatedOn
        self.opsLogEntries().forEach(o => {
            if (!opsEntryMatchesTags(o)) return;

            const raw =
                (o.timeLogged && o.timeLogged()) ||
                (o.createdOn && o.createdOn());
            add("ops", o, raw);
        });

        // drop buckets that ended up empty
        var buckets = Array.from(map.values()).filter(function (b) {
            return b.ops.length > 0 || b.history.length > 0;
        });

        // newest minute first
        buckets.sort(function (a, b) { return b.key - a.key; });
        return buckets;
    });

    self.openForJob = async (job) => {
        self.laneViewMode("both"); //this is just better. force people to like it
        self.jobIdentifier(job.identifier() || "");
        self.job(job);

        if (self.job() && self.job().receivedAt) {
            self.jobCreated = moment(self.job().jobReceived());
        }


        self.historyEntries([]);
        self.opsLogEntries([]);
        self.loading(true);

        const historyResults = new Promise((resolve, reject) => {
            parentVm.fetchHistoryForJob(
                job.id(),
                function (res) {
                    self.historyEntries((res || []).map((e) => new HistoryEntry(e)));
                    resolve(res);
                },
                reject
            );
        });

        const opsLogResults = new Promise((resolve, reject) => {
            parentVm.fetchOpsLogForJob(
                job.id(),
                function (res) {
                    self.opsLogEntries((res || []).map((e) => new OpsLogEntry(e)));
                    resolve(res);
                },
                reject
            );
        });

        try {
            await Promise.all([historyResults, opsLogResults]);
        } catch (e) {
            console.error("Error loading job history or ops log:", e);
        } finally {
            self.loading(false);
        }
    };
}


function TagFilterItem(name) {
    const self = this;

    self.name = ko.observable(name);
    self.isSelected = ko.observable(false);

    self.isIcems = ko.pureComputed(() => {
        const n = (self.name() || "").toLowerCase();
        return n === "icems";
    });

    // Used directly by css: cssClasses
    self.cssClasses = ko.pureComputed(() => ({
        "jobhistory-tag-btn": true,
        "btn-outline-secondary": !self.isSelected(),
        "btn-secondary": self.isSelected(),
        "active": self.isSelected(),
        "jobhistory-tag-icems": self.isIcems()
    }));
}