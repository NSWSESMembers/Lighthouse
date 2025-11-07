/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import L from "leaflet";

export function Tasking(data = {}) {
    const self = this;

    self.job = ko.observable(null);

    self.team = null;

    // raw
    self.id = ko.observable(data.Id ?? null);
    self.currentStatus = ko.observable(data.CurrentStatus ?? "");
    self.currentStatusTime = ko.observable(data.CurrentStatusTime ?? null);
    self.currentStatusId = ko.observable(data.CurrentStatusId ?? null);
    self.estimatedStatusEndTime = ko.observable(data.EstimatedStatusEndTime ?? null);
    self.enroute = ko.observable(data.Enroute ?? null);
    self.enrouteEstimatedCompletion = ko.observable(data.EnrouteEstimatedCompletion ?? null);
    self.onsite = ko.observable(data.Onsite ?? null);
    self.onsiteEstimatedCompletion = ko.observable(data.OnsiteEstimatedCompletion ?? null);
    self.offsite = ko.observable(data.Offsite ?? null);
    self.complete = ko.observable(data.Complete ?? null);

    self.sequence = ko.observable(data.Sequence ?? 0);
    self.manifest = ko.observableArray(data.Manifest || []);
    self.distanceToScene = ko.observable(data.DistanceToScene ?? null);
    self.injuriesSustained = ko.observable(!!data.InjuriesSustained);
    self.aarCompleted = ko.observable(!!data.AARCompleted);
    self.cispRequired = ko.observable(!!data.CISPRequired);
    self.riskAssessmentCompleted = ko.observable(!!data.RiskAssessmentCompleted);
    self.vesselUsed = ko.observable(!!data.VesselUsed);
    self.primaryActivityType = ko.observable(data.PrimaryActivityType ?? null);
    self.primaryTaskType = ko.observable(data.PrimaryTaskType ?? null);
    self.actionTaken = ko.observable(data.ActionTaken ?? null);
    self.equipmentUsed = ko.observableArray(data.EquipmentUsed || []);
    self.equipmentKeptByName = ko.observable(data.EquipmentKeptByName ?? null);
    self.equipmentKeptByNumber = ko.observable(data.EquipmentKeptByNumber ?? null);
    self.injuries = ko.observableArray(data.Injuries || []);
    self.safetyManagementSheet = ko.observable(data.SafetyManagementSheet ?? null);

    //hacky way to make the time since tick up every 30 seconds
    const _tick = ko.observable(Date.now());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _timer = setInterval(() => _tick(Date.now()), 300000);

    // status helpers
    self.statusSince = ko.pureComputed(() => (self.currentStatusTime() ? new Date(self.currentStatusTime()) : null));
    self.statusAgeSeconds = ko.pureComputed(() => {
        const d = self.statusSince();
        return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)) : null;
    });
    self.statusSetAt = ko.pureComputed(() => (self.currentStatusTime() ? moment(self.currentStatusTime()).format("DD/MM/YYYY HH:mm:ss") : null));

 self.statusTimeAgo = ko.pureComputed(() => {
    // read _tick so this recomputes every second
    _tick();

    const time = self.currentStatusTime();
    return time ? Math.floor((Date.now() - new Date(time).getTime()) / 1000) : null;
  });

  // optional: nice label (e.g., "3m", "1h")
  self.statusTimeAgoLabel = ko.pureComputed(() => {
    const s = self.statusTimeAgo();
    if (s == null) return "-";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    const mr = m % 60;
    return mr ? `${h}h ${mr}m ago` : `${h}h ago`;
  });

    self.isTasked = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "tasked");
    self.isEnroute = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "enroute");
    self.isOnsite = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "onsite");
    self.isComplete = ko.pureComputed(() => !!self.complete());

    // convenience proxies
    self.teamCallsign = ko.pureComputed(() => self.team.callsign());
    self.jobIdentifier = ko.pureComputed(() => self.job.identifier());
    self.jobTypeName = ko.pureComputed(() => self.job.typeName());
    self.jobPriority = ko.pureComputed(() => self.job.priorityName());
    self.prettyAddress = ko.pureComputed(() => self.job.address.prettyAddress() || self.job.address.short());


    // patch model with partial updates
    self.updateFrom = (patch = {}) => {
        if (patch.CurrentStatus !== undefined) self.currentStatus(patch.CurrentStatus);
        if (patch.CurrentStatusTime !== undefined) self.currentStatusTime(patch.CurrentStatusTime);
        if (patch.CurrentStatusId !== undefined) self.currentStatusId(patch.CurrentStatusId);
        if (patch.EstimatedStatusEndTime !== undefined) self.estimatedStatusEndTime(patch.EstimatedStatusEndTime);
        if (patch.Enroute !== undefined) self.enroute(patch.Enroute);
        if (patch.Onsite !== undefined) self.onsite(patch.Onsite);
        if (patch.Offsite !== undefined) self.offsite(patch.Offsite);
        if (patch.Complete !== undefined) self.complete(patch.Complete);
    };

    self.setJob = function (newJob) {
        const prev = self.job;
        if (prev === newJob) return;

        // detach from previous job list
        if (prev && typeof prev.taskings === 'function') {
            prev.taskings.remove(x => x.id && x.id() === self.id());
        }

        // set new ref
        self.job(newJob || null);

        // attach to new job list without recursion
        if (newJob && typeof newJob.taskings === 'function') {
            const exists = newJob.taskings().some(x => x.id() === self.id());
            if (!exists) newJob.taskings.push(self);
        }
    };


    self.getTeamLatLng = function () {
        // Prefer live asset location if available; otherwise fall back to team HQ (assignedTo)
        const t = self.team;
        if (!t) return null;
        const assets = t.trackableAssets && t.trackableAssets();
        if (assets && assets.length > 0) {
            const a = assets[0];
            const lat = +ko.unwrap(a.latitude), lng = +ko.unwrap(a.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return L.latLng(lat, lng);
        }
        const lat = +ko.unwrap(t.assignedTo.latitude), lng = +ko.unwrap(t.assignedTo.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? L.latLng(lat, lng) : null;
    }

    self.getJobLatLng = function () {
        const j = self.job;
        if (!j) return null;
        const lat = +ko.unwrap(j.address.latitude), lng = +ko.unwrap(j.address.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? L.latLng(lat, lng) : null;
    }


}