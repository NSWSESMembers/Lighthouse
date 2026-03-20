/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { Entity } from "./Entity.js";

import { openURLInBeacon } from '../utils/chromeRunTime.js';

import { Enum } from '../utils/enum.js';

import { loadSharedMapping, saveSharedMapping, pushSharedDefault, fetchSharedDefaults } from '../utils/defaultAssetSync.js';

// Shared across all Team instances — single localStorage key
const _capKey = 'lh_showCapabilities';
const _showCapabilities = ko.observable(localStorage.getItem(_capKey) !== 'false');
_showCapabilities.subscribe(v => localStorage.setItem(_capKey, v ? 'true' : 'false'));

// ── Default-asset persistence (shared across all teams) ──
// Uses the shared mapping (lh_sharedDefaultAssets) backed by Lambda/S3.
// An asset can only be the default for one team.

/**
 * Bumped whenever any team's default-asset changes so that all
 * `defaultAsset` computeds in every Team re-evaluate.
 * Can also be bumped externally after a shared-defaults fetch.
 * @type {ko.Observable<number>}
 */
const _defaultAssetTick = ko.observable(0);

/** Allow main.js to force re-evaluation after a shared-defaults fetch. */
export function bumpDefaultAssetTick() {
    _defaultAssetTick(_defaultAssetTick() + 1);
}

/**
 * Set the default asset for a team.  Enforces the constraint that an
 * asset may only be default for one team — if the same asset was
 * previously claimed by another team, that mapping is removed.
 *
 * @param {string} teamId
 * @param {string|null} assetId  Pass `null` to clear.
 */
/**
 * The Beacon API URL, set once via `setDefaultAssetApiUrl()` so that
 * shared pushes are namespaced correctly.
 * @type {string|null}
 */
let _apiUrl = null;

/** Called once from main.js after params are resolved. */
export function setDefaultAssetApiUrl(url) { _apiUrl = url; }

function _setDefaultAsset(teamId, assetId) {
    const map = loadSharedMapping();

    // Remove any existing mapping pointing to this asset (one-asset-one-team)
    if (assetId != null) {
        for (const [tid, aid] of Object.entries(map)) {
            if (String(aid) === String(assetId)) {
                delete map[tid];
            }
        }
    }

    if (assetId != null) {
        map[String(teamId)] = String(assetId);
    } else {
        delete map[String(teamId)];
    }

    saveSharedMapping(map);
    _defaultAssetTick(_defaultAssetTick() + 1);

    // Push to Lambda / S3 backend so other browsers pick it up (fire-and-forget)
    if (_apiUrl) {
        pushSharedDefault(_apiUrl, teamId, assetId);
    }
}

export function Team(data = {}, deps = {}) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias


    /// TEAMS MIGHT NOT HAVE A CURRENTSTATUS IF THEY WERE CREATED FROM TASKING ONLY
    /// THERES ENOUGH GUARDS AROUND THIS NOW TO PREVENT ISSUES


    const self = this;
    self.lastTaskingDataUpdate = new Date();

    const {
        upsertTasking,
        getTeamTasking,
        fetchTeamById,
        makeTeamLink = () => '#',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        flyToAsset = () => { },
        teamTaskStatusFilter = () => [],
        currentlyOpenMapPopup = () => null,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        openRadioLogModal = () => { },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        openSMSTeamModal = () => { },
        isTeamPinned = () => false,
        toggleTeamPinned = () => false,
        saveTaskingSequence = () => Promise.resolve(),
    } = deps;

    self.isFilteredIn = ko.observable(false);

    // capabilities visibility (shared singleton)
    self.showCapabilities = _showCapabilities;
    self.toggleCapabilities = function () { _showCapabilities(!_showCapabilities()); };

    // pinning
    self.isPinned = ko.pureComputed(() => {
        try { return !!isTeamPinned(self.id()); } catch (e) { return false; }
    });

    self.togglePinned = function (_, e) {
        try { toggleTeamPinned(self.id()); } catch (err) { /* ignore */ }
        if (e) { e.stopPropagation?.(); e.preventDefault?.(); }
        return false;
    };


    self.id = ko.observable(data.Id ?? null);
    self.callsign = ko.observable(data.Callsign ?? "");
    self.assignedTo = ko.observable(new Entity(data.AssignedTo || data.CreatedAt)); //safety code for beacon bug
    self.teamStatusType = ko.observable(data.TeamStatusType || null); // {Id,Name,Description}
    self.members = ko.observableArray(data.Members);
    self.taskedJobCount = ko.observable(data.TaskedJobCount || 0);
    self.teamLeader = ko.computed(function () {
        const leader = ko.unwrap(self.members).find(m => m.TeamLeader === true);
        return leader ? `${leader.Person.FirstName} ${leader.Person.LastName}` : '-';
    });


    self.membersSorted = ko.pureComputed(() => {
        const members = ko.unwrap(self.members);
        return members.sort((a, b) => {
            if (a.TeamLeader && !b.TeamLeader) return -1;
            if (!a.TeamLeader && b.TeamLeader) return 1;
            return 0;
        });
    })

    self.statusDate = ko.observable((data.TeamStatusStartDate) ? new Date(data.TeamStatusStartDate) : null);

    self.popUpIsOpen = ko.observable(false);
    self.rowHasFocus = ko.observable(false);

    self.trackableAssets = ko.observableArray([]);

    // When this team first gets multiple assets, fetch its shared default
    // mapping so the correct asset is selected without waiting for the
    // next refresh cycle.
    let _hadMultipleAssets = false;
    self.trackableAssets.subscribe(assets => {
        if (assets.length > 1 && !_hadMultipleAssets && _apiUrl) {
            _hadMultipleAssets = true;
            fetchSharedDefaults(_apiUrl, [String(self.id())])
                .then(() => _defaultAssetTick(_defaultAssetTick() + 1))
                .catch(() => { /* im not empty i promise */ });
        } else if (assets.length <= 1) {
            _hadMultipleAssets = false;
        }
    });

    self.trackableAssetsWithMultipleTeams = ko.pureComputed(() => {
        return self.trackableAssets().filter(a => a.matchingTeamsInView().length > 1);
    });

    /**
     * The user-chosen default asset for this team, or falls back to the
     * first trackable asset.  Returns `null` if no assets exist.
     * @type {ko.PureComputed<Asset|null>}
     */
    self.defaultAsset = ko.pureComputed(() => {
        _defaultAssetTick();                        // re-evaluate when any default changes
        const assets = self.trackableAssets();
        if (!assets || assets.length === 0) return null;
        if (assets.length === 1) return assets[0];

        const teamId = String(self.id());

        // Check shared (Lambda/S3-backed) mapping
        const sharedMap = loadSharedMapping();
        const sharedId = sharedMap[teamId];
        if (sharedId != null) {
            const found = assets.find(a => String(ko.unwrap(a.id)) === String(sharedId));
            if (found) return found;
        }

        return assets[0]; // fallback
    });

    /**
     * Returns true if the given asset is the current default for this team.
     * @param {Asset} asset
     * @returns {boolean}
     */
    self.isDefaultAsset = function (asset) {
        return self.defaultAsset() === asset;
    };

    /**
     * Returns true if the given asset is NOT the current default for this team.
     * Used in secure-binding templates where inline negation is unavailable.
     * @param {Asset} asset
     * @returns {boolean}
     */
    self.isNotDefaultAsset = function (asset) {
        return self.defaultAsset() !== asset;
    };

    /**
     * Computed array of wrapper objects for the template foreach that exposes
     * per-asset `isDefault` / `isNotDefault` observables.  This avoids
     * function-call-with-arguments in secure-binding data-bind expressions.
     * @type {ko.PureComputed<Array<{asset: Asset, isDefault: boolean, isNotDefault: boolean}>>}
     */
    self.trackableAssetEntries = ko.pureComputed(() => {
        const def = self.defaultAsset();
        return self.trackableAssets().map(a => ({
            asset: a,
            isDefault: a === def,
            isNotDefault: a !== def,
        }));
    });

    /**
     * Set (or toggle off) the default asset for this team.
     * Accepts either an Asset or an entry wrapper `{asset}` from trackableAssetEntries.
     * @param {Asset|{asset: Asset}} assetOrEntry
     */
    self.setDefaultAsset = function (assetOrEntry) {
        const asset = assetOrEntry && assetOrEntry.asset ? assetOrEntry.asset : assetOrEntry;
        const currentDefault = self.defaultAsset();
        if (currentDefault === asset && self.trackableAssets().length > 1) {
            // Clicking the current default clears it (reverts to [0] fallback)
            _setDefaultAsset(String(self.id()), null);
        } else {
            _setDefaultAsset(String(self.id()), String(ko.unwrap(asset.id)));
        }
    };

    self.toggleAndExpand = function () {
        const wasExpanded = self.expanded();
        self.expanded(!wasExpanded);

        // If we just collapsed, no scroll
        if (wasExpanded) return;
        self.refreshDataAndTasking();
        scrollToThisInTable();

    };

    self.mouseEnterButton = function () {
        self.rowHasFocus(true);
    }
    self.mouseLeaveButton = function () {
        self.rowHasFocus(false);
    }

    self.refreshData = async function () {
        self.taskingLoading(true);
        fetchTeamById(self.id(), () => {
            self.taskingLoading(false);
        });
    };


    self.refreshDataAndTasking = function () {
        self.fetchTasking();
        self.refreshData();

        // If this team has multiple assets, refresh shared default mapping
        if (_apiUrl && (self.trackableAssets?.() || []).length > 1) {
            fetchSharedDefaults(_apiUrl, [String(self.id())])
                .then(() => _defaultAssetTick(_defaultAssetTick() + 1))
                .catch(() => {/* im not empty i promise */});
        }
    }

    self.focusAndExpandInList = function () {
        self.expand();
        scrollToThisInTable();
    };


    function scrollToThisInTable() {
        setTimeout(() => {
            const row = document.querySelector(
                `tr.team-row[data-team-id="${self.id()}"]`
            );
            if (!row) return;

            // Scroll container is the top pane
            const container = document.querySelector('#paneTop .table-responsive');
            if (!container) {
                row.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            // Sticky header height
            const table = row.closest("table");
            const thead = table ? table.querySelector("thead") : null;
            const headerHeight = thead
                ? thead.getBoundingClientRect().height
                : 0;

            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            const padding = 2;

            // Where we *want* the row: just under the header
            let target =
                container.scrollTop +
                (rowRect.top - containerRect.top) -
                headerHeight -
                padding;

            // Only clamp to >= 0; don't clamp to maxScroll here
            if (target < 0) target = 0;


            container.scrollTo({
                top: target,
                behavior: "smooth",
            });
        }, 150);
    }


    self.onPopupOpen = function () {
        self.popUpIsOpen(true);
        if (self.rowHasFocus()) return;
        self.focusAndExpandInList();
    };

    self.onPopupClose = function () {
        self.popUpIsOpen(false);
        if (self.rowHasFocus()) return;
        self.collapse();
    };


    // ---- Tasking REFRESH CHECK ----
    // ---- Because the tasking doesnt come down in the team search ----
    const dataRefreshInterval = makeFilteredInterval(async () => {
        const now = Date.now();
        const last = self.lastTaskingDataUpdate?.getTime?.() ?? 0;
        // only refresh if we haven't had an update in > 1 minute
        if (now - last > 60000) {
            self.fetchTasking();
        }
    }, 30000, { runImmediately: false });

    self.startDataRefreshCheck = function () {
        dataRefreshInterval.start();
    };

    self.stopDataRefreshCheck = function () {
        dataRefreshInterval.stop();
    };


    // interval that only runs while team is filtered in
    function makeFilteredInterval(fn, intervalMs, { runImmediately = false } = {}) {
        let handle = null;

        const tick = () => {
            // global guard: only run if still filtered in
            if (!self.isFilteredIn()) return;
            fn();
        };

        const start = () => {
            if (!self.isFilteredIn()) return; // don't start if already filtered out
            if (handle) clearInterval(handle);
            if (runImmediately) tick();
            handle = setInterval(tick, intervalMs);
        };

        const stop = () => {
            if (handle) {
                clearInterval(handle);
                handle = null;
            }
        };

        return { start, stop };
    }

    self.trackableAndIsFiltered = ko.pureComputed(() => {
        return self.isFilteredIn() && self.trackableAssets().length > 0;
    });

    self.trackableAssetsOrError = ko.pureComputed(() => {
        return !self.trackableAssets().length ? 'Unable to match team to a radio asset' : 'Zoom to'
    })

    self.expanded = ko.observable(false);


    self.taskingLoading = ko.observable(true);
    self.taskings = ko.observableArray([]);

    self.statusName = ko.pureComputed(() => {
        return (self.teamStatusType() && self.teamStatusType().Name);
    })

    self.activeTaskingsCount = ko.pureComputed(() => {
        return self.filteredTaskings() && self.filteredTaskings().length || 0;
    })

    self.hiddenTaskingCount = ko.pureComputed(() => {
        return self.taskings().length - self.filteredTaskings().length;
    })



    self.currentTaskingSummary = ko.pureComputed(() => {
        const typeCounts = {};
        const frCategoryCounts = {};

        self.filteredTaskings().forEach(t => {
            const typeKey = t.job.type?.();
            typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;

            // If type is FR, track category counts
            if (typeKey === "FR") {
                const category = t.job.categoriesName?.().replaceAll('Category', 'C');
                if (category) {
                    frCategoryCounts[category] = (frCategoryCounts[category] || 0) + 1;
                }
            }
        });

        const entries = Object.entries(typeCounts).map(([type, count]) => {
            if (type === "FR" && Object.keys(frCategoryCounts).length > 0) {
                const categoryBreakdown = Object.entries(frCategoryCounts)
                    .map(([cat, catCount]) => `${cat}: ${catCount}`)
                    .join(', ');
                return `${type}: ${count} (${categoryBreakdown})`;
            }
            return `${type}: ${count}`;
        });

        return entries.length ? entries.join(', ') : '';
    });

    self.filteredTaskings = ko.pureComputed(() => {

        return ko.utils.arrayFilter(this.taskings(), ts => {
            if (teamTaskStatusFilter().includes(ts.currentStatus())) {
                return true;
            }
            return false;
        }).sort((a, b) => {
            const seqA = a.sequence();
            const seqB = b.sequence();
            if (seqA !== seqB) return seqA - seqB;
            return new Date(b.currentStatusTime()) - new Date(a.currentStatusTime());
        });
    });

    // ── Reorder mode ──
    self.reorderMode = ko.observable(false);
    self.reorderList = ko.observableArray([]);
    self.reorderSaving = ko.observable(false);

    self.displayedTaskings = ko.pureComputed(() =>
        self.reorderMode() ? self.reorderList() : self.filteredTaskings()
    );

    self.enterReorderMode = function () {
        // snapshot the current filtered taskings into a mutable array
        self.reorderList(self.filteredTaskings().slice());
        self.reorderMode(true);
    };

    self.cancelReorderMode = function () {
        self.reorderMode(false);
        self.reorderList([]);
    };

    self.moveTaskingUp = function (tasking) {
        const arr = self.reorderList();
        const idx = arr.indexOf(tasking);
        if (idx <= 0) return;
        arr.splice(idx, 1);
        arr.splice(idx - 1, 0, tasking);
        self.reorderList(arr);
    };

    self.moveTaskingDown = function (tasking) {
        const arr = self.reorderList();
        const idx = arr.indexOf(tasking);
        if (idx < 0 || idx >= arr.length - 1) return;
        arr.splice(idx, 1);
        arr.splice(idx + 1, 0, tasking);
        self.reorderList(arr);
    };

    self.saveReorder = async function () {
        const sequences = self.reorderList().map((ts, i) => ({
            taskingId: ts.id(),
            sequence: i
        }));
        self.reorderSaving(true);
        try {
            await saveTaskingSequence(sequences);
            // Update local sequence values to match new order
            sequences.forEach(({ taskingId, sequence }) => {
                const ts = self.taskings().find(t => t.id() === taskingId);
                if (ts) ts.sequence(sequence);
            });
            self.reorderMode(false);
            self.reorderList([]);
        } catch (e) {
            console.error("Failed to save tasking sequence:", e);
        } finally {
            self.reorderSaving(false);
        }
    };

    self.taskingRowColour = ko.pureComputed(() => {
        if (self.taskedJobCount() === 0) {
            return 'row-team-green'; // light green
        }
        if (self.taskedJobCount() >= 1 && self.taskedJobCount() <= 2) {
            return 'row-team-yellow';
        }
        if (self.taskedJobCount() > 2) {
            return 'row-team-red'; // light red
        }
        return 'transparent';
    })

    //url to open in beacon
    self.teamLink = ko.pureComputed(() => makeTeamLink(self.id()));

    self.openBeaconEditTeam = (ev) => {
        const url = self.teamLink();
        console.log("Opening job in Beacon:", url);
        openURLInBeacon(url);
        ev?.preventDefault?.();
    };


    self.toggle = () => self.expanded(!self.expanded());
    self.expand = () => self.expanded(true);
    self.collapse = () => self.expanded(false);
    self.expanded.subscribe(function (isExpanded) {
        if (isExpanded && !self.taskingLoading()) {
            self.fetchTasking();
        }
    });

    self.updateStatusById = function (statusId) {
        const status = Enum.TeamStatusType.some(s => s.Id === statusId);
        if (status) {
            self.teamStatusType(status);
        }
    }

    self.fetchTasking = function () {
        if (!getTeamTasking || !upsertTasking) return;
        self.taskingLoading(true);
        getTeamTasking(self.id.peek())
            .then(tasking => {
                (tasking?.Results || []).forEach(t =>
                    upsertTasking(t, { teamContext: self })
                );
            })
            .finally(() => self.taskingLoading(false));
    };

    self.addTaskingFromPayload = function (taskingJson) {
        return upsertTasking && upsertTasking(taskingJson, { teamContext: self });
    };

    self.findTaskingById = function (taskingId) {
        const arr = this.taskings && ko.unwrap(this.taskings);
        if (!arr) return undefined;
        return arr.find(t => t.id && t.id() === taskingId);
    }

    self.addTaskingIfNotExists = function (job) {
        const existsLocally = self.taskings().some(x => x.id() === job.id());
        if (!existsLocally) self.taskings.push(job);
    };


    self.upsertTaskingFromPayload = function (vm, taskingJson) {
        const t = vm.upsertTaskingFromPayload(taskingJson, { teamContext: self });
        // ensure it's listed under this team locally
        const existsLocally = self.taskings().some(x => x.id() === t.id());
        if (!existsLocally) self.taskings.push(t);
    };

    self.markerFocus = function () {
        if (self.isFilteredIn() === false) return;

        const assets = self.trackableAssets();
        if (!assets || assets.length === 0) return;
        const op = currentlyOpenMapPopup();
        let nextIdx = 0;

        if (op && op.kind === 'asset') {
            const curIdx = assets.findIndex(a => a.id() === op.id);
            if (curIdx !== -1) {
                nextIdx = (curIdx + 1) % assets.length;
            }
        }

        const asset = assets[nextIdx];
        if (!asset) return;

        flyToAsset(asset);
    };

    self.flyToAsset = function (asset) {
        flyToAsset(asset);
    }

    self.openRadioLogModal = function () {
        openRadioLogModal(self);
    };

    //allow the team to call this with no tasking.
    self.sendSMS = function () {
        openSMSTeamModal(self);
    }

    self.sendSMSwithTasking = function (tasking) {
        openSMSTeamModal(self, tasking);
    }

    Team.prototype.updateFromJson = function (d = {}) {
        if (d.Id !== undefined) this.id(d.Id);
        if (d.TaskedJobCount !== undefined) this.taskedJobCount(d.TaskedJobCount);
        if (d.Callsign !== undefined) this.callsign(d.Callsign);
        if (d.TeamStatusType !== undefined) this.teamStatusType(d.TeamStatusType);
        if (d.Members !== undefined) this.members(d.Members);
        if (d.AssignedTo !== undefined && d.CreatedAt !== undefined) this.assignedTo(new Entity(d.AssignedTo || d.CreatedAt)); //safety for beacon bug
        if (d.statusId !== undefined) this.updateStatusById(d.statusId);
        if (d.TeamStatusStartDate !== undefined) this.statusDate(new Date(d.TeamStatusStartDate));
    }
}