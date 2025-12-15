/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { Entity } from "./Entity.js";

import { openURLInBeacon } from '../utils/chromeRunTime.js';

import { Enum } from '../utils/enum.js';

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
    } = deps;

    self.isFilteredIn = ko.observable(false);

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

    self.statusDate = ko.observable((data.TeamStatusStartDate) ? new Date(data.TeamStatusStartDate) : null);

    self.popUpIsOpen = ko.observable(false);

    self.trackableAssets = ko.observableArray([]);


    self.toggleAndExpand = function () {
        const wasExpanded = self.expanded();
        self.expanded(!wasExpanded);

        // If we just collapsed, no scroll
        if (wasExpanded) return;
        self.refreshDataAndTasking();
        scrollToThisInTable();

    };



    self.refreshData = async function () {
        self.taskingLoading(true);
        fetchTeamById(self.id(), () => {
            self.taskingLoading(false);
        });
    };


    self.refreshDataAndTasking = function () {
        self.fetchTasking();
        self.refreshData();
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
        self.focusAndExpandInList();
    };

    self.onPopupClose = function () {
        self.popUpIsOpen(false);
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
        return (self.teamStatusType() && self.teamStatusType().Name) || "Unknown";
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
        }).sort((a, b) => new Date(b.currentStatusTime()) - new Date(a.currentStatusTime()));
    });

    self.taskingRowColour = ko.pureComputed(() => {
        if (self.taskedJobCount() === 0) {
            return '#d4edda'; // light green
        }
        if (self.taskedJobCount() >= 1 && self.taskedJobCount() <= 2) {
            return '#fff3cd';
        }
        if (self.taskedJobCount() > 2) {
            return '#f8d7da'; // light red
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