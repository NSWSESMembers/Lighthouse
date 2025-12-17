/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import L from "leaflet";
import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { showAlert } from '../components/windowAlert.js';



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

    self.statusDropdownPage = ko.observable("details");
    self.newStatus = ko.observable(null);

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
    self.isOffsite = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "offsite");
    self.isCalledOff = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "calledoff");
    self.isUntasked = ko.pureComputed(() => (self.currentStatus() || "").toLowerCase() === "untasked");
    self.isComplete = ko.pureComputed(() => !!self.complete());

    // convenience proxies
    self.teamCallsign = ko.pureComputed(() => self.team.callsign());
    self.jobIdentifier = ko.pureComputed(() => self.job.identifier());
    self.jobTypeName = ko.pureComputed(() => self.job.typeName());
    self.jobPriority = ko.pureComputed(() => self.job.priorityName());
    self.prettyAddress = ko.pureComputed(() => self.job.address.prettyAddress() || self.job.address.short());



    //task has job thats visible in the current filter
    self.hasJob = ko.pureComputed(() => !!self.job.isFilteredIn());

    //same same but different ^
    self.hasTeam = ko.pureComputed(() => !!self.team.isFilteredIn());



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
    

    self.sendSMS = function () {
        self.team.sendSMSwithTasking(self);
    }

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

    self.openRadioLogModal = function () {
        this.job.openRadioLogModal(self);
    };

/*
    self.UpdateTeamStatusDropdown = function (tasking, anchorE1) {
        this.job.UpdateTeamStatusDropdown(tasking, anchorE1);
    };

    Need to get rid fo this.
*/ 
    self.tagColorFromStatus = function () {
        const status = (self.currentStatus() || "").toLowerCase();
        switch (status) {
            case "tasked":
                return "bg-primary";
            case "enroute":
                return "bg-info";
            case "onsite":
                return "bg-warning";
            case "complete":
                return "bg-success";
            default:
                return "bg-secondary";
        }
    }

    /* 
        UPDATE STATUS DROPDOWN
    */

    self.onStatusDropdownToggleClick = function () {
        self.statusDropdownPage("status");
        self.needsTimeSet(false);
        self.needsETA(false);
        self.needsETC(false);
        self.needsReason(false);
        self.time(null);
        self.eta(null);
        self.etc(null);
        self.callOffReason(null);
    };

    self.statusPageVisible = ko.pureComputed(() => self.statusDropdownPage() === "status");
    self.detailsPageVisible = ko.pureComputed(() => self.statusDropdownPage() === "details");
    self.needsTimeSet = ko.observable(false);
    self.needsETA = ko.observable(false);
    self.needsETC = ko.observable(false);
    self.needsReason = ko.observable(false);

    self.time = ko.observable(null);
    self.eta = ko.observable(null);
    self.etc = ko.observable(null);
    self.callOffReason = ko.observable(null);

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    self.taskCompletionLink = function () {
        const source = getQueryParam("source");
        if (!source) return null

        const cleanSource = source.replace(/\/$/, "");

        return `${cleanSource}/Jobs/${self.job.id()}?lhquickComplete=${self.id()}`;
    }

    self.cannotUpdateStatus = ko.pureComputed(() =>
    self.isUntasked() || self.isCalledOff() || self.isComplete()
    );

    self.isActiveStatus = ko.pureComputed(() =>
    self.isTasked() || self.isEnroute() || self.isOnsite() || self.isOffsite()
    );

    self.canUntask = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && self.isTasked()
    );

    self.canEnroute = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && self.isActiveStatus()
    );

    self.canCalloff = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && (self.isTasked() || self.isEnroute())
    );

    self.canOnsite = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && self.isActiveStatus()
    );

    self.canOffsite = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && self.isActiveStatus()
    );

    self.canComplete = ko.pureComputed(() =>
    !self.cannotUpdateStatus() && self.isActiveStatus()
    );

    self.etaQuickButtons = [
        { label: "+1", minutes: 1 },
        { label: "+5", minutes: 5 },
        { label: "+10", minutes: 10 },
        { label: "+30", minutes: 30 },
        { label: "+60", minutes: 60 }
    ];

    self.onEtaQuickButtonClick = function (btn, event) {
        self.eta(addMinutesToInputTime(self.eta(), btn.minutes));

        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
    }

    self.etcQuickButtons = [
        { label: "+1", minutes: 1 },
        { label: "+5", minutes: 5 },
        { label: "+10", minutes: 10 },
        { label: "+30", minutes: 30 },
        { label: "+60", minutes: 60 }
    ];

    self.onEtcQuickButtonClick = function (btn, event) {
        self.etc(addMinutesToInputTime(self.etc(), btn.minutes));

        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
    }

    self.statusOptions = ko.pureComputed(function () {
    return [
        { key: "Untask", label: "Remove Tasking", enabled: self.canUntask(), needsDetails: false ,needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false },
        { key: "Enroute", label: "En route", enabled: self.canEnroute(), needsDetails: true , needsTimeSet: true, needsETA: true, needsETC: false, needsReason: false },
        { key: "CallOff", label: "Call off", enabled: self.canCalloff(), needsDetails: true , needsTimeSet: false, needsETA: false, needsETC: false, needsReason: true },
        { key: "Onsite", label: "On site", enabled: self.canOnsite(), needsDetails: true , needsTimeSet: true, needsETA: false, needsETC: true, needsReason: false },
        { key: "Offsite", label: "Off site", enabled: self.canOffsite(), needsDetails: true , needsTimeSet: true, needsETA: false, needsETC: false, needsReason: false },
        { key: "Complete", label: "Complete", enabled: self.canComplete(), needsDetails: false , needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false }
    ];
    });

    self.onStatusOptionClick = function (option, event) {
        if (!option || !option.enabled) return;

        self.time(moment().seconds(0).milliseconds(0).format("YYYY-MM-DDTHH:mm"));

        self.newStatus(option.key)
        console.log("Selected Status: ", option.key);

        if(option.needsDetails) {
            self.statusDropdownPage("details");
        }

        if(option.needsTimeSet) {
            self.needsTimeSet(true);
        }

        if(option.needsETA) {
            self.needsETA(true);
        }

        if(option.needsETC) {
            self.needsETC(true);
        }

        if(option.needsReason){
            self.needsReason(true);
        }

        if(option.key === "Untask") {
            self.updateTaskingStatus();
        }

        if(option.key === "Complete") {
            //DO THE MAGIC LIGHTHOUSE STUFF OPENING HERE THINGO
            const url = self.taskCompletionLink()
            if (url) {
                console.log("Opening completion in Beacon:", url);
                openURLInBeacon(url);
                showAlert("Teams must be completed from Beacon. Your Beacon Remote tab has been opened to the team completion screen for the selected team", "warning", 5000);
            }
            self.closeStatusDropdown();
        }

        // stop Bootstrap dropdown doing odd things if needed
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
    };

    function addMinutesToInputTime(existingValue, minutes) {
        // Case 1: No existing time → start with current time
        let base = existingValue ? new Date(existingValue) : new Date();

        base.setMinutes(base.getMinutes() + minutes);

        // Convert back to datetime-local format
        const pad = (n) => n.toString().padStart(2, "0");
        return (
            base.getFullYear() + "-" +
            pad(base.getMonth() + 1) + "-" +
            pad(base.getDate()) + "T" +
            pad(base.getHours()) + ":" +
            pad(base.getMinutes())
        );
    }

    self.updateTaskingStatus = function () {
        console.log("SUBMITTING");
        const formattedTime = moment(self.time()).format("YYYY-MM-DDTHH:mm:ssZ");
        let action = null; // our friendly UI name is different to the Beacon API backend name, so this value is for that backend value that will be used to form the URL later on.
        let payload = { timeLogged: formattedTime, overrideFutureStatuses: 0, description: "", LighthouseFunction: "updatingTeamStatus" };

        if (self.newStatus() === "Enroute") {
                action = "Enroute";
                if (self.eta() && moment(self.eta()).isValid()) {
                    payload.estimatedCompletion = moment(self.eta()).format("YYYY-MM-DDTHH:mm:ssZ");
                } else {
                    payload.estimatedCompletion = null;
                }
        }

        // CONSTRUCT PAYLOD FOR ONSITE
        if (self.newStatus() === "Onsite") {
            action = "Onsite";
            if (self.etc() && moment(self.etc()).isValid()) {
                payload.estimatedCompletion = moment(self.etc()).format("YYYY-MM-DDTHH:mm:ssZ");
            } else {
                payload.estimatedCompletion = null;
            }
        }

        // CONSTRUCT PAYLOAD FOR OFFSITE
        if (self.newStatus() === "Offsite") {
            action = "Offsite";
            payload.estimatedCompletion = null;
            payload.taskingId = self.id();
        }

        // Construct Payload for Call Off
        if (self.newStatus() === "CallOff") {
            action = "CallOff";
            payload.TaskingId = self.id();
            payload.InjuriesSustained = false;
            payload.AARCompleted = false;
            payload.CISPRequired = false;
            payload.VesselUsed = false;
            payload.RiskAssessmentCompleted = false;
            payload.ReasonForCallOff = self.callOffReason();
            payload.InjuredPeopleIds = [];
            payload.CompleteJob = false;
            payload.LighthouseFunction = "callOffTeamFromJob";
        }

        // Construct Payload for Untask
        if (self.newStatus() === "Untask") {
            action = "Untask";
            delete payload.timeLogged;
            delete payload.description;
            delete payload.overrideFutureStatuses;
            payload.Id = self.id();
            payload.TeamId = self.team.id();
            payload.JobId = self.job.id();
            payload.LighthouseFunction = "untaskTeamFromJob";
        }


        // Decide whether we are overriding tasking - and apply tasking override value if we are.
        if (self.newStatus() === "Enroute" && self.currentStatus() !== "Tasked") {
            payload.overrideFutureStatuses = self.id();
        }

        if (self.newStatus() === "Onsite" && self.currentStatus() !== "Enroute") {
            payload.overrideFutureStatuses = self.id();
        }

        if (self.newStatus() === "Offsite" && self.currentStatus() !== "Onsite") {
            payload.overrideFutureStatuses = self.id();
        }

        // Send to ParentVM to make API Call
        // If it's a POST Request send it to the UpdateTeamStatus API - sends Tasking, Action (what status we are changing to), Payload and Callback.
        const UpdateTeamStatusAPI = ['Enroute','Onsite','Offsite']
        if (UpdateTeamStatusAPI.includes(action)) {
            this.job.updateTeamStatus(self, action, payload, function (result) {

                if (!result) {
                    console.error("Team Status Update failed");
                    return;
                }
            });
        }

        // If it's a PUT request to Call off we need to send it to the callOffTeam API - Sends Tasking, Payload and Callback.
        if (action === "CallOff") {
            console.log(payload.formattedTime)
            this.job.callOffTeam(self, payload, function (result) {

                if (!result) {
                    console.error("Failed to CallOff Team");
                    return;
                }
            });
        }

        // If it's a DELETE request for Untask we need to send it to the untaskTeam API - sends Tasking, Payload and Callback.
        if (action === "Untask") {
            this.job.untaskTeam(self, payload, function (result) {

                if (!result) {
                    console.error("Failed to Untask Team");
                    return;
                }
            });  
        }

        self.closeStatusDropdown();
    }

    self.closeStatusDropdown = function () {
        document.querySelectorAll(".show").forEach(function (el) {
            if (el.classList && el.classList.contains("tasking-dropdown-menu")) {
                el.classList.remove("show");
            }
        });
    }
    

}