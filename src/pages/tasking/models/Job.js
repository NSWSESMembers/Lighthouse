/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import { Entity } from "./Entity.js";
import { Address } from "./Address.js";
import { Tag } from "./Tag.js";

export function Job(data = {}, deps = {}) {
    const self = this;

    // ---- injected adapters (all optional, safe defaults) ----
    const {
        makeJobLink = (_id) => "#",
        fetchJobTasking = async (_jobId) => ({ Results: [] }),
        fetchJobById = async (_jobId) => null,
        flyToJob = (_job) => {/* noop */ },
    } = deps;

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
    self.categories = ko.observableArray(data.Categories || []);
    self.inFrao = ko.observable(!!data.InFrao);
    self.imageCount = ko.observable(data.ImageCount ?? 0);
    self.icemsIncidentIdentifier = ko.observable(data.ICEMSIncidentIdentifier);
    self.expanded = ko.observable(false);
    self.toggle = () => self.expanded(!self.expanded());
    self.expand = () => self.expanded(true);
    self.collapse = () => self.expanded(false);
    self.taskingLoading = ko.observable(true);

    self.lastDataUpdate = new Date();
    let refreshTimer = null;

    self.startDataRefreshCheck = function () {
        self.stopDataRefreshCheck();
        refreshTimer = setInterval(async () => {
            const now = Date.now();
            const last = self.lastDataUpdate?.getTime?.() ?? 0;
            if (now - last > 120000) {
                await self.refreshData();
            }
        }, 30000);
    };
    self.startDataRefreshCheck = function () {
        if (self.dataRefreshTimer) clearInterval(self.dataRefreshTimer);

        self.dataRefreshTimer = setInterval(() => {
            const now = new Date();
            const last = self.lastDataUpdate;
            if (!last || (now - last) > 120000) {
                self.refreshData();
            }
        }, 30000);
    };

    self.stopDataRefreshCheck = function () {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    };

    self.startDataRefreshCheck();

    //refs to other obs
    self.marker = null;  // will hold the L.Marker instance
    self.taskings = ko.observableArray(); //array of taskings


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

    // computed
    self.jobLink = ko.pureComputed(() => makeJobLink(self.id()));
    self.priorityName = ko.pureComputed(() => (self.jobPriorityType() && self.jobPriorityType().Name) || "");
    self.statusName = ko.pureComputed(() => (self.jobStatusType() && self.jobStatusType().Name) || "");
    self.typeName = ko.pureComputed(() => (self.jobType() && self.jobType().Name) || self.type());
    self.tagsCsv = ko.pureComputed(() => self.tags().map(t => t.name()).join(", "));
    self.receivedAt = ko.pureComputed(() => (self.jobReceived() ? moment(self.jobReceived()).format("DD/MM/YYYY HH:mm:ss") : null));
    self.ageSeconds = ko.pureComputed(() => {
        const d = self.receivedAt();
        return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)) : null;
    });
    self.tagsCsv = ko.pureComputed(() => {
        return self.tags().map(t => t.name()).join(", ");
    })

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
        const p = self.jobPriorityType()
        const desc = p.Description;
        if (desc === "Life Threatening") return "red";
        if (desc === "Priority Response") return "rgb(255, 165, 0)";
        if (desc === "Immediate Response") return "rgb(79, 146, 255)";
        return "#1f2937";
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

    Job.prototype.updateFromJson = function (d = {}) {

        self.startDataRefreshCheck(); // restart timer


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

        // structured
        if (d.JobPriorityType !== undefined) this.jobPriorityType(d.JobPriorityType || null);
        if (d.JobStatusType !== undefined) this.jobStatusType(d.JobStatusType || null);
        if (d.JobType !== undefined) this.jobType(d.JobType || null);

        if (d.EntityAssignedTo !== undefined) {
            this.entityAssignedTo.id(d.EntityAssignedTo?.Id ?? null);
            this.entityAssignedTo.code(d.EntityAssignedTo?.Code ?? "");
            this.entityAssignedTo.name(d.EntityAssignedTo?.Name ?? "");
            this.entityAssignedTo.latitude(d.EntityAssignedTo?.Latitude ?? null);
            this.entityAssignedTo.longitude(d.EntityAssignedTo?.Longitude ?? null);
            this.entityAssignedTo.parentEntity(
                d.EntityAssignedTo?.ParentEntity
                    ? {
                        id: d.EntityAssignedTo.ParentEntity.Id,
                        code: d.EntityAssignedTo.ParentEntity.Code,
                        name: d.EntityAssignedTo.ParentEntity.Name
                    }
                    : null
            );
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
        if (Array.isArray(d.Categories)) {
            this.categories(d.Categories.slice());
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

    // ---- map focus (delegated) ----
    self.focusMap = function () { flyToJob(self); };

    // ---- lifecycle hooks (delegated) ----
    self.onPopupOpen = function () { self.fetchTasking(); };
    self.onPopupClose = function () { /* popup closing logic goes here */ };

    self.onPopupClose = function () {
        // popup closing logic goes here
    };

    self.fetchTasking = function () {
        self.taskingLoading(true);
        fetchJobTasking(self.id(), () => {
            self.taskingLoading(false);
        });

    };

    self.refreshData = async function () {
        const r = await fetchJobById(self.id());
        if (r) { self.updateFromJson(r); self.lastDataUpdate = new Date(); }
    };

}