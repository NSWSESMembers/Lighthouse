/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import { Entity } from "./Entity.js";
import { Address } from "./Address.js";
import { Tag } from "./Tag.js";

import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { jobsToUI } from "../utils/jobTypesToUI.js";


export function Job(data = {}, deps = {}) {
    const self = this;

    // ---- injected adapters (all optional, safe defaults) ----
    const {
        makeJobLink = (_id) => "#",
        fetchJobTasking = (_jobId, cb) => cb(null),
        fetchJobById = (_jobId, cb) => cb(null),
        flyToJob = (_job) => {/* noop */ },
        attachAndFillOpsLogModal = (_jobId) => ([]),
        attachAndFillTimelineModal = (_job) => { /* noop */ },
        fetchUnacknowledgedJobNotifications = async (_job) => ([]),
    } = deps;

    self.isFilteredIn = ko.observable(false);

    // raw
    self.id = ko.observable(data.Id ?? null);
    self.identifier = ko.observable(data.Identifier ?? "");
    self.typeId = ko.observable(data.TypeId ?? null);
    self.type = ko.observable(data.Type ?? "");
    self.callerName = ko.observable(data.CallerName ?? "");
    self.callerNumber = ko.observable(data.CallerNumber ?? "");
    self.contactName = ko.observable(data.ContactName ?? "");
    self.contactNumber = ko.observable(data.ContactNumber ?? "");
    self.permissionToEnterPremises = ko.observable(!!data.PermissionToEnterPremises);
    self.howToEnterPremises = ko.observable(data.HowToEnterPremises ?? null);
    self.jobReceived = ko.observable(data.JobReceived ?? null);
    self.jobPriorityType = ko.observable(data.JobPriorityType || null); // {Id,Name,Description}
    self.jobStatusType = ko.observable(data.JobStatusType || null);     // {Id,Name,Description}
    self.jobType = ko.observable(data.JobType || null);                 // {Id,Name,...}
    self.entityAssignedTo = new Entity(data.EntityAssignedTo || {});
    self.lga = ko.observable(data.LGA ?? "");
    self.address = new Address(data.Address || {});
    self.tags = ko.observableArray((data.Tags || []).map(t => new Tag(t)));
    self.taskingCategory = ko.observable(data.TaskingCategory ?? 0);
    self.situationOnScene = ko.observable(data.SituationOnScene ?? "");
    self.eventId = ko.observable(data.EventId ?? null);
    self.printCount = ko.observable(data.PrintCount ?? 0);
    self.actionRequiredTags = ko.observableArray(data.ActionRequiredTags || []);
    self.categories = ko.observableArray((data.Categories || []).filter(c => (c?.Id ?? 0) >= 9)); //ditch pscu categories
    self.inFrao = ko.observable(!!data.InFrao);
    self.imageCount = ko.observable(data.ImageCount ?? 0);
    self.icemsIncidentIdentifier = ko.observable(data.ICEMSIncidentIdentifier);
    self.expanded = ko.observable(false);
    self.toggle = () => self.expanded(!self.expanded());
    self.expand = () => self.expanded(true);
    self.collapse = () => self.expanded(false);
    self.taskingLoading = ko.observable(false);

    self.opsLogEntriesLoading = ko.observable(false);
    self.opsLogEntries = ko.observableArray([]);

    self.unacceptedNotifications = ko.observableArray([]);


    //refs to other obs
    self.marker = null;  // will hold the L.Marker instance
    self.taskings = ko.observableArray(); //array of taskings


    // computed
    self.jobLink = ko.pureComputed(() => makeJobLink(self.id()));
    self.priorityName = ko.pureComputed(() => (self.jobPriorityType() && self.jobPriorityType().Name) || "");
    self.statusName = ko.pureComputed(() => (self.jobStatusType() && self.jobStatusType().Name) || "");
    self.typeName = ko.pureComputed(() => (self.jobType() && self.jobType().Name) || self.type());
    self.tagsCsv = ko.pureComputed(() => self.tags().map(t => t.name()).join(", "));
    self.receivedAt = ko.pureComputed(() => (self.jobReceived() ? moment(self.jobReceived()).format("DD/MM/YYYY HH:mm:ss") : null));
    self.receivedAtShort = ko.pureComputed(() => (self.jobReceived() ? moment(self.jobReceived()).format("DD/MM/YY HH:mm:ss") : null));



    self.lastDataUpdate = new Date();

    // ---- DATA REFRESH CHECK ----
    const dataRefreshInterval = makeFilteredInterval(async () => {
        const now = Date.now();
        const last = self.lastDataUpdate?.getTime?.() ?? 0;
        // only refresh if we haven't had an update in > 2 minutes
        if (now - last > 120000) {
            await self.refreshData();
        }
    }, 30000, { runImmediately: false });

    self.startDataRefreshCheck = function () {
        dataRefreshInterval.start();
    };

    self.stopDataRefreshCheck = function () {
        dataRefreshInterval.stop();
    };

    // Start/stop with filter state
    self.isFilteredIn.subscribe((flag) => {
        if (flag) {
            self.startDataRefreshCheck();
        } else {
            self.stopDataRefreshCheck();
        }
    });


    // ---- UNACCEPTED NOTIFICATIONS POLLING ----
    const unacceptedNotificationsInterval = makeFilteredInterval(() => {
        // extra guard: only if ICEMS id exists
        if (!self.icemsIncidentIdentifier()) return;
        console.log("Polling unaccepted notifications for job", self.id());
        fetchUnacknowledgedJobNotifications(self);
    }, 30000, { runImmediately: true });

    self.startUnacceptedNotificationsPolling = function () {
        unacceptedNotificationsInterval.start();
    };

    self.stopUnacceptedNotificationsPolling = function () {
        unacceptedNotificationsInterval.stop();
    };

    // Restart / stop polling when identifiers or filters change
    self.icemsIncidentIdentifier.subscribe((id) => {
        if (id && self.isFilteredIn()) {
            self.startUnacceptedNotificationsPolling();
        } else {
            self.stopUnacceptedNotificationsPolling();
        }
    });

    self.isFilteredIn.subscribe((flag) => {
        if (flag && self.icemsIncidentIdentifier()) {
            self.startUnacceptedNotificationsPolling();
        } else {
            self.stopUnacceptedNotificationsPolling();
        }
    });

    self.toggleAndLoad = function () {
        if (!self.expanded()) {
            self.fetchTasking();
            self.refreshData();
        }
        self.expanded(!self.expanded())
    };

    self.typeShort = ko.pureComputed(() => {
        const fullType = self.type() || "";
        return fullType.replace(/Evacuation/i, 'Evac').trim();
    })




    self.attachAndFillOpsLogModal = function () {
        console.log("Fetching ops log entries for job", self.id());
        attachAndFillOpsLogModal(self)
    }

    self.attachAndFillTimelineModal = function () {
        console.log("Fetching timeline entries for job", self.id());
        attachAndFillTimelineModal(self)
    }

    self.openRadioLogModal = function (tasking) {
        deps.openRadioLogModal(tasking)
    };

    self.openNewOpsLogModal = function (job) {
        deps.openNewOpsLogModal(job)
    };


    self.incompleteTaskingsOnly = ko.computed(() =>
        self.taskings().filter(t => {
            const status = t.currentStatus();
            return status !== "Complete" && status !== "CalledOff";
        })
    );

    self.sortedTaskings = ko.computed(() =>
        self.taskings().slice().sort((a, b) =>
            new Date(a.currentStatusTime) - new Date(b.currentStatusTime)
        )
    );



    self.identifierTrimmed = ko.pureComputed(() => {
        //trim leading zeros for compact display
        return self.identifier().replace(/^0+/, '') || '0';
    });

    self.ageSeconds = ko.pureComputed(() => {
        const d = self.receivedAt();
        return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)) : null;
    });

    self.rowColour = ko.pureComputed(() => {
        switch (self.priorityName()) {
            case 'Rescue': return '#f1bfbf';
            case 'Priority': return '#fcf8e3';
            case 'Immediate': return '#d9edf7';
            case 'General': return '#ffffff';
            default: return '';
        }
    });

    self.bannerBGColour = ko.pureComputed(() => {
        const style = jobsToUI(self);
        return style.fillcolor || '#6b7280ff'; // default gray
    })


    self.categoriesName = ko.pureComputed(() => {
        const beaconCats = {
            7: "Orange",
            8: "Red",
            9: "Category1",
            10: "Category2",
            11: "Category3",
            12: "Category4",
            13: "Category5"
        }
        if (!self.categories || self.categories().length === 0) return "";
        const c = self.categories()[0].Id;
        return beaconCats[c] || "";
    })


    self.categoriesNameNumberDash = ko.pureComputed(() => {
        const beaconCats = {
            7: "-Orange",
            8: "-Red",
            9: "-1",
            10: "-2",
            11: "-3",
            12: "-4",
            13: "-5"
        }
        if (!self.categories || self.categories().length === 0) return "";
        const c = self.categories()[0].Id;
        return beaconCats[c] || "";
    })


    self.categoriesParent = ko.pureComputed(() => {
        const beaconJobParentCats = {
            1: "Storm",
            2: "Support",
            4: "FloodSupport",
            5: "Rescue",
            6: "Tsunami"
        }
        if (!self.jobType) return "";
        const c = self.jobType().ParentId;
        return beaconJobParentCats[c] || "";
    })

    self.returnParentEntityName = ko.pureComputed(() => {
        if (self.entityAssignedTo.parentEntity()) {
            return self.entityAssignedTo.parentEntity().name();
        }
        return '-';
    })



    Job.prototype.updateFromJson = function (d = {}) {

        this.lastDataUpdate = new Date();
        this.startDataRefreshCheck(); // restart timer


        // scalars
        if (d.Identifier !== undefined) this.identifier(d.Identifier);
        if (d.TypeId !== undefined) this.typeId(d.TypeId);
        if (d.Type !== undefined) this.type(d.Type);
        if (d.CallerName !== undefined) this.callerName(d.CallerName || "");
        if (d.CallerNumber !== undefined) this.callerNumber(d.CallerNumber || "");
        if (d.ContactName !== undefined) this.contactName(d.ContactName || "");
        if (d.ContactNumber !== undefined) this.contactNumber(d.ContactNumber || "");
        if (d.PermissionToEnterPremises !== undefined) this.permissionToEnterPremises(!!d.PermissionToEnterPremises);
        if (d.HowToEnterPremises !== undefined) this.howToEnterPremises(d.HowToEnterPremises ?? null);
        if (d.JobReceived !== undefined) this.jobReceived(d.JobReceived || null);
        if (d.LGA !== undefined) this.lga(d.LGA || "");
        if (d.TaskingCategory !== undefined) this.taskingCategory(d.TaskingCategory ?? 0);
        if (d.SituationOnScene !== undefined) this.situationOnScene(d.SituationOnScene || "");
        if (d.EventId !== undefined) this.eventId(d.EventId ?? null);
        if (d.PrintCount !== undefined) this.printCount(d.PrintCount ?? 0);
        if (d.InFrao !== undefined) this.inFrao(!!d.InFrao);
        if (d.ImageCount !== undefined) this.imageCount(d.ImageCount ?? 0);

        if (d.ICEMSIncidentIdentifier !== undefined) this.icemsIncidentIdentifier(d.ICEMSIncidentIdentifier || null);

        // structured
        if (d.JobPriorityType !== undefined) this.jobPriorityType(d.JobPriorityType || null);
        if (d.JobStatusType !== undefined) this.jobStatusType(d.JobStatusType || null);
        if (d.JobType !== undefined) this.jobType(d.JobType || null);

        if (d.EntityAssignedTo !== undefined) {
            const ea = d.EntityAssignedTo;

            this.entityAssignedTo.id(ea?.Id ?? null);
            this.entityAssignedTo.code(ea?.Code ?? "");
            this.entityAssignedTo.name(ea?.Name ?? "");
            this.entityAssignedTo.latitude(ea?.Latitude ?? null);
            this.entityAssignedTo.longitude(ea?.Longitude ?? null);

            // Correct handling of ParentEntity
            if (ea.ParentEntity !== null) {
                const existingParent = this.entityAssignedTo.parentEntity();
                if (existingParent) {
                    // update existing parent entity observables
                    existingParent.id(ea.ParentEntity.Id ?? null);
                    existingParent.code(ea.ParentEntity.Code ?? "");
                    existingParent.name(ea.ParentEntity.Name ?? "");
                } else {
                    // or create a new one if none exists yet
                    this.entityAssignedTo.parentEntity(new Entity(ea.ParentEntity));
                }
            } else {
                // if API can legitimately send "no parent", clear it
                this.entityAssignedTo.parentEntity(null);
            }
        }

        if (d.Address !== undefined) {
            this.address.gnafId(d.Address?.GnafId ?? null);
            this.address.latitude(d.Address?.Latitude ?? null);
            this.address.longitude(d.Address?.Longitude ?? null);
            this.address.streetNumber(d.Address?.StreetNumber ?? "");
            this.address.street(d.Address?.Street ?? "");
            this.address.locality(d.Address?.Locality ?? "");
            this.address.postCode(d.Address?.PostCode ?? "");
            this.address.prettyAddress(d.Address?.PrettyAddress ?? "");
        }

        if (Array.isArray(d.Tags)) {
            this.tags(d.Tags.map(t => new Tag(t)));
        }
        if (Array.isArray(d.ActionRequiredTags)) {
            this.actionRequiredTags(d.ActionRequiredTags.slice());
        }
        //ditch pscu categories
        if (Array.isArray(d.Categories)) {
            this.categories(d.Categories.filter(c => (c?.Id ?? 0) >= 9));
        }
    };

    self.addTasking = function (t) {
        if (!t || typeof t.id !== 'function') return;
        const id = t.id();
        if (!self.taskings().some(x => x.id() === id)) self.taskings.push(t);
        // ensure backref points to this canonical job
        if (!t.job || typeof t.job !== 'function' || t.job() !== self) {
            t.setJob(self);
        }
    };

    self.removeTasking = function (t) {
        if (!t || typeof t.id !== 'function') return;
        const id = t.id();
        self.taskings.remove(x => x.id() === id);
        if (t.job && typeof t.job === 'function' && t.job() === self) {
            t.setJob(null);
        }
    };

    self.openBeaconJobDetails = function () {
        const url = self.jobLink();
        console.log("Opening job in Beacon:", url);
        openURLInBeacon(url);
    }
    // ---- map focus (delegated) ----
    self.focusMap = function () {
        if (self.isFilteredIn() === false) return;
        flyToJob(self);
    };

    self.toggleAndExpand = function () {
        self.toggleAndLoad();
        if (!self.expanded()) {
            self.fetchTasking();
            self.refreshData();
        }
        requestAnimationFrame(() => {
            // find the row for this job
            const row = document.querySelector(`tr.job-row[data-job-id="${self.id()}"]`);
            if (!row) return;

            // find the scroll container (the table wrapper in the bottom pane)
            const container = row.closest('.pane--bottom .table-responsive')
                || row.closest('.table-responsive')
                || row.parentElement?.parentElement; // fallback

            if (!container) {
                // fallback to normal scrollIntoView if we can't find a container
                row.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            // sticky header height
            const table = row.closest('table');
            const thead = table ? table.querySelector('thead') : null;
            const headerHeight = thead ? thead.getBoundingClientRect().height : 0;

            // compute how far we need to move the container's scrollTop
            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            // desired: row just under header, with a tiny padding
            const padding = 2;
            const delta = (rowRect.top - containerRect.top) - headerHeight - padding;

            container.scrollTo({
                top: container.scrollTop + delta,
                behavior: "smooth"
            });
        });
    }

    self.focusAndExpandInList = function () {
        // expand the job row
        self.expand();

        requestAnimationFrame(() => {
            // find the row for this job
            const row = document.querySelector(`tr.job-row[data-job-id="${self.id()}"]`);
            if (!row) return;

            // find the scroll container (the table wrapper in the bottom pane)
            const container = row.closest('.pane--bottom .table-responsive')
                || row.closest('.table-responsive')
                || row.parentElement?.parentElement; // fallback

            if (!container) {
                // fallback to normal scrollIntoView if we can't find a container
                row.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            // sticky header height
            const table = row.closest('table');
            const thead = table ? table.querySelector('thead') : null;
            const headerHeight = thead ? thead.getBoundingClientRect().height : 0;

            // compute how far we need to move the container's scrollTop
            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            // desired: row just under header, with a tiny padding
            const padding = 2;
            const delta = (rowRect.top - containerRect.top) - headerHeight - padding;

            container.scrollTo({
                top: container.scrollTop + delta,
                behavior: "smooth"
            });
        });
    };


    // ---- lifecycle hooks (delegated) ----
    self.onPopupOpen = function () { self.refreshDataAndTasking(); self.focusAndExpandInList(); };

    self.onPopupClose = function () {
        self.collapse();
    };

    self.refreshDataAndTasking = function () {
        self.fetchTasking();
        self.refreshData();
    }

    self.fetchTasking = function () {
        self.taskingLoading(true);
        fetchJobTasking(self.id(), () => {
            self.taskingLoading(false);
        });

    };

    self.refreshData = async function () {



        self.taskingLoading(true);
        fetchJobById(self.id(), () => {
            self.taskingLoading(false);
        });
    };

    // interval that only runs while job is filtered in
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

}

