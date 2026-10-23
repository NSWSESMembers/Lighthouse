/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import L from "leaflet";
import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { showAlert } from '../components/windowAlert.js';
import { Enum } from "../utils/enum.js";



// Shared across every Tasking instance -- a single 5-minute interval for the
// life of the module, rather than one per Tasking. Taskings are never pruned
// from the registry (main.js taskingsById/taskings only grow), so a
// per-instance timer would leak one live setInterval per tasking ever seen
// for the whole session.
const _tick = ko.observable(Date.now());
setInterval(() => _tick(Date.now()), 300000);

// Separate, faster clock for the ETA/ETC countdowns and the overdue alert --
// a 5-minute tick would leave "ETA 3m" on screen long after the team was due.
const _etaTick = ko.observable(Date.now());
setInterval(() => _etaTick(Date.now()), 30000);

// "Due soon" (amber) at this many minutes or less to go.
export const ETA_SOON_MINUTES = 5;
// The "Teams overdue" alert fires once an ETA/ETC is this many minutes past.
export const ETA_ALERT_MINUTES = 5;

// 9m, 1h 35m, 1d 21h -- two units at most, so a long-stale estimate stays short.
function formatMinutes(m) {
    if (m < 60) return `${m}m`;
    if (m < 1440) {
        const h = Math.floor(m / 60);
        const r = m % 60;
        return r ? `${h}h ${r}m` : `${h}h`;
    }
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    return h ? `${d}d ${h}h` : `${d}d`;
}

// Largest unit only (14m, 3h, 1d), for the chips in the narrow Team and
// Incident Register cells. Lateness rounds down ("at least 5h late");
// time left rounds to nearest (95m -> 2h).
function formatMinutesCompact(m, { round = false } = {}) {
    const r = round ? Math.round : Math.floor;
    if (m < 60) return `${m}m`;
    if (m < 1440) return `${r(m / 60)}h`;
    return `${r(m / 1440)}d`;
}

// The estimate that applies to a tasking right now: the ETA (Beacon's
// EnrouteEstimatedCompletion) while Enroute, the ETC
// (OnsiteEstimatedCompletion) while Onsite, nothing in any other status.
// Returns null when there's no usable estimate, else
//   { kind: 'ETA'|'ETC', time: Date, minutesLeft, minutesLate,
//     state: 'ok'|'soon'|'late', label, compactLabel, clockLabel, title,
//     chipClass, lineClass, iconClass }
// minutesLeft rounds up (1m until it's due); minutesLate rounds down (so
// "5m late" means a full five minutes past).
export function etaInfoFor(status, enrouteEstimate, onsiteEstimate, nowMs = Date.now()) {
    const s = (status || '').toLowerCase();
    let kind, raw;
    if (s === 'enroute') { kind = 'ETA'; raw = enrouteEstimate; }
    else if (s === 'onsite') { kind = 'ETC'; raw = onsiteEstimate; }
    else return null;
    if (!raw) return null;
    const m = moment(raw);
    if (!m.isValid()) return null;

    const diffMin = (m.valueOf() - nowMs) / 60000;
    const minutesLeft = diffMin > 0 ? Math.ceil(diffMin) : 0;
    const minutesLate = diffMin > 0 ? 0 : Math.max(0, Math.floor(-diffMin));
    const state = diffMin <= 0 ? 'late' : minutesLeft <= ETA_SOON_MINUTES ? 'soon' : 'ok';

    // Chip labels drop to whole days past 24 h so they fit their cells;
    // the clock line and the hover title keep the detail (1d 21h).
    const short = (mins) => (mins >= 1440 ? formatMinutesCompact(mins) : formatMinutes(mins));
    let rel, chipRel, compactRel, titleRel;
    if (state !== 'late') {
        rel = formatMinutes(minutesLeft);
        chipRel = short(minutesLeft);
        compactRel = formatMinutesCompact(minutesLeft, { round: true });
        titleRel = `in ${rel}`;
    } else if (minutesLate < 1) {
        rel = chipRel = compactRel = 'now';
        titleRel = 'due now';
    } else {
        rel = `${formatMinutes(minutesLate)} late`;
        chipRel = `${short(minutesLate)} late`;
        compactRel = `+${formatMinutesCompact(minutesLate)}`;
        titleRel = `${formatMinutes(minutesLate)} overdue`;
    }
    const clock = m.format('HH:mm');
    const full = kind === 'ETA' ? 'Estimated arrival' : 'Estimated completion';
    return {
        kind,
        time: m.toDate(),
        minutesLeft,
        minutesLate,
        state,
        label: `${kind} ${chipRel}`,
        compactLabel: `${kind} ${compactRel}`,
        clockLabel: `${kind} ${clock} · ${rel}`,
        compactClockLabel: `${kind} ${clock} · ${compactRel}`,
        clock,
        relative: titleRel,
        title: `${full} ${clock} (${titleRel})`,
        chipClass: `eta-chip--${state}`,
        lineClass: `eta-line--${state}`,
        iconClass: state === 'late' ? 'fa-exclamation-circle' : 'fa-clock',
    };
}

// Of a set of taskings, the one whose estimate matters most: the soonest
// (or most overdue) ETA, else the soonest ETC. Null if none has one.
export function primaryEtaTasking(taskings) {
    let best = null;
    for (const t of taskings || []) {
        const e = t.etaInfo && t.etaInfo();
        if (!e) continue;
        if (!best) { best = { t, e }; continue; }
        if (e.kind !== best.e.kind) {
            if (e.kind === 'ETA') best = { t, e };
        } else if (e.time < best.e.time) {
            best = { t, e };
        }
    }
    return best ? best.t : null;
}

// Quick-add buttons for an ETA/ETC (a datetime-local observable), measured
// from a fixed reference time -- `anchor`, a computed moment: the status time
// on the status-change page, the current estimate (or now) in the Change
// ETA/ETC editor. Each click adds to the ETA/ETC picked so far, or to the
// anchor if it's blank or earlier. The label reads "From 10:00, add:" and then
// "From 10:00: +25m" -- how far the ETA/ETC is past the anchor, however it was
// set (buttons or typed) -- so the "from" time only moves if the anchor does.
const QUICK_ADD_MINUTES = [5, 10, 15, 30, 60];
function quickAdd(target, anchor) {
    const pickedAfterAnchor = () => {
        const v = target();
        return v && moment(v).isValid() && !moment(v).isBefore(anchor(), "minute") ? moment(v) : null;
    };
    const label = ko.pureComputed(() => {
        const a = anchor();
        const when = a.isSame(moment(), "minute") ? `now (${a.format("HH:mm")})` : a.format("HH:mm");
        const picked = pickedAfterAnchor();
        const diff = picked ? picked.diff(a, "minutes") : 0;
        return diff > 0 ? `From ${when}: +${formatMinutes(diff)}` : `From ${when}, add:`;
    });
    const buttons = QUICK_ADD_MINUTES.map(minutes => ({ minutes, label: `+${minutes}` }));
    const click = (btn, event) => {
        const base = pickedAfterAnchor() || anchor().clone();
        target(base.add(btn.minutes, "minutes").format("YYYY-MM-DDTHH:mm"));
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
    };
    return { label, buttons, click };
}

// A tasking's forward progress, in order. Complete is a Beacon handoff.
export const TASKING_STEPS = [
    { key: "Tasked", label: "Tasked" },
    { key: "Enroute", label: "En route" },
    { key: "Onsite", label: "On site" },
    { key: "Offsite", label: "Off site" },
    { key: "Complete", label: "Complete" },
];

// Port of Beacon's own canCallOff (its tasking UI), from a tasking's
// JobTeamStatusTypeHistory ([{ Name, TimeLogged }], in Beacon's order).
// Matches what trainbeacon accepts/refuses (tested 2026-10-23):
//   - ever Complete or ever Offsite -> no
//   - been Onsite: no if the first Onsite is at/after the last Enroute and
//     there's only one Enroute (a normal arrival, or a skip straight to
//     Onsite then one Enroute override); a correction back to Enroute adds a
//     second Enroute entry and allows it again
//   - otherwise yes
export function canCallOffFromHistory(history) {
    const list = history || [];
    if (list.some(h => h.Name === "Complete")) return false;
    if (list.some(h => h.Name === "Offsite")) return false;

    const firstOnsite = list.find(h => h.Name === "Onsite");
    if (firstOnsite) {
        const enroutes = list.filter(h => h.Name === "Enroute");
        const lastEnroute = enroutes.length ? enroutes[enroutes.length - 1] : null;
        if (lastEnroute && !moment(firstOnsite.TimeLogged).isBefore(moment(lastEnroute.TimeLogged)) && enroutes.length <= 1) {
            return false;
        }
    }
    return true;
}

// Pill colour for a tasking status name (Tasked, Enroute, Onsite, ...).
export function statusColorClass(statusName) {
    switch ((statusName || "").toLowerCase()) {
        case "tasked":
            return "bg-primary text-white";
        case "enroute":
            return "bg-info";
        case "onsite":
            return "bg-warning";
        case "complete":
            return "bg-success";
        default:
            return "bg-secondary text-white";
    }
}

// Adds minutes to a datetime-local input value (or to now if empty) and returns
// it in datetime-local format -- backs the ETA/ETC "+N" quick buttons.
export function addMinutesToInputTime(existingValue, minutes) {
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
    // Beacon's status history ({ Name, TimeLogged, ... }) -- gates Call off
    // (canCallOffFromHistory). Comes with every REST tasking fetch.
    self.statusHistory = ko.observableArray(data.JobTeamStatusTypeHistory || []);
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

    // status helpers
    self.statusSince = ko.pureComputed(() => (self.currentStatusTime() ? new Date(self.currentStatusTime()) : null));
    self.statusAgeSeconds = ko.pureComputed(() => {
        const d = self.statusSince();
        return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)) : null;
    });
    self.statusSetAt = ko.pureComputed(() => (self.currentStatusTime() ? moment(self.currentStatusTime()).format("DD/MM/YYYY HH:mm:ss") : null));

    self.statusTimeAgo = ko.pureComputed(() => {
        // read _tick so this recomputes every 30 seconds
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

    // ETA (Enroute) / ETC (Onsite) countdown -- see etaInfoFor. Re-reads the
    // 30-second clock so the countdown and overdue state stay current.
    self.etaInfo = ko.pureComputed(() => {
        _etaTick();
        return etaInfoFor(self.currentStatus(), self.enrouteEstimatedCompletion(), self.onsiteEstimatedCompletion());
    });
    self.etaOverdueForAlert = ko.pureComputed(() => {
        const e = self.etaInfo();
        return !!e && e.minutesLate >= ETA_ALERT_MINUTES;
    });

    // convenience proxies
    // self.team can be null -- a tasking may be upserted before its team
    // reference resolves (e.g. a REST tasking record with no/partial Team
    // data), so these must not assume it's set.
    self.teamCallsign = ko.pureComputed(() => self.team ? self.team.callsign() : '');
    self.jobIdentifier = ko.pureComputed(() => self.job.identifier());
    self.jobTypeName = ko.pureComputed(() => self.job.typeName());
    self.jobPriority = ko.pureComputed(() => self.job.priorityName());
    self.prettyAddress = ko.pureComputed(() => self.job.address.prettyAddress() || self.job.address.short());



    //task has job thats visible in the current filter
    self.hasJob = ko.pureComputed(() => !!self.job.isFilteredIn());

    //same same but different ^
    self.hasTeam = ko.pureComputed(() => !!(self.team && self.team.isFilteredIn()));



    // patch model with partial updates
    self.updateFrom = (patch = {}) => {
        const before = { status: self.currentStatus(), time: self.currentStatusTime() };
        if (patch.CurrentStatus !== undefined) {
            self.currentStatus(patch.CurrentStatus);
        } else if (patch.CurrentStatusId !== undefined) {
            // Some pushes (e.g. taskingUpdated) send only the id, not the
            // status name -- resolve it from the static enum so isTasked()/
            // isEnroute()/etc (which key off the string) don't go stale.
            const resolved = Object.values(Enum.JobTeamStatusType).find(s => s.Id === patch.CurrentStatusId);
            if (resolved) self.currentStatus(resolved.Name);
        }
        if (patch.CurrentStatusTime !== undefined) self.currentStatusTime(patch.CurrentStatusTime);
        if (patch.CurrentStatusId !== undefined) self.currentStatusId(patch.CurrentStatusId);
        if (patch.EstimatedStatusEndTime !== undefined) self.estimatedStatusEndTime(patch.EstimatedStatusEndTime);
        if (patch.Enroute !== undefined) self.enroute(patch.Enroute);
        if (patch.EnrouteEstimatedCompletion !== undefined) self.enrouteEstimatedCompletion(patch.EnrouteEstimatedCompletion);
        if (patch.Onsite !== undefined) self.onsite(patch.Onsite);
        if (patch.OnsiteEstimatedCompletion !== undefined) self.onsiteEstimatedCompletion(patch.OnsiteEstimatedCompletion);
        if (patch.Offsite !== undefined) self.offsite(patch.Offsite);
        if (patch.Complete !== undefined) self.complete(patch.Complete);

        if (patch.JobTeamStatusTypeHistory !== undefined) {
            self.statusHistory(patch.JobTeamStatusTypeHistory || []);
        } else if (self.currentStatus() !== before.status || self.currentStatusTime() !== before.time) {
            // A SignalR push carries no history -- record the change locally
            // so Call off gating doesn't wait for the next REST fetch.
            self.statusHistory.push({
                Name: self.currentStatus(),
                TimeLogged: self.currentStatusTime() || moment().format("YYYY-MM-DDTHH:mm:ss"),
            });
        }
    };

    self.setJob = function (newJob) {
        // self.job starts life as the ko.observable above, but every real
        // caller (main.js's _linkTaskingAndJob) replaces it with a plain Job
        // object reference on first link ("set shared ref") -- read/write
        // through that same plain-property convention rather than treating
        // self.job as an observable, or the previous job's value is lost.
        const prev = typeof self.job === 'function' ? self.job() : self.job;
        if (prev === newJob) return;

        // detach from previous job list
        if (prev && typeof prev.taskings === 'function') {
            prev.taskings.remove(x => x.id && x.id() === self.id());
        }

        // set new ref
        self.job = newJob || null;

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
            const a = t.defaultAsset ? t.defaultAsset() : assets[0];
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
        return statusColorClass(self.currentStatus());
    }

    /* 
        UPDATE STATUS DROPDOWN
    */

    self.onStatusDropdownToggleClick = function () {
        self.statusDropdownPage("status");
        self.statusChangeMode("forward");
        self.correctionTarget(null);
        self.correctionAck(false);
        self.estimateDraft(null);
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

    // UI-only state for time override checkbox
    self.timeOverrideEnabled = ko.observable(false);

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    // effective visibility
    self.showTimeInput = ko.pureComputed(function () {
        return self.needsTimeSet() && self.timeOverrideEnabled();
    });

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
        !self.cannotUpdateStatus() && self.isTasked()
    );

    // Beacon refuses to call off a team that has been on site ("Cannot call
    // off: Team has been onsite, team must be completed") -- offer Call off
    // exactly when Beacon's own UI does (canCallOffFromHistory). Without any
    // history yet (e.g. a tasking first seen via a push), fall back to the
    // current On site / Off site times.
    self.callOffAllowedByHistory = ko.pureComputed(() => {
        const history = self.statusHistory();
        return history.length ? canCallOffFromHistory(history) : !(self.onsite() || self.offsite());
    });
    self.canCalloff = ko.pureComputed(() =>
        !self.cannotUpdateStatus() && (self.isTasked() || self.isEnroute()) && self.callOffAllowedByHistory()
    );

    self.canOnsite = ko.pureComputed(() =>
        !self.cannotUpdateStatus() && (self.isTasked() || self.isEnroute())
    );

    self.canOffsite = ko.pureComputed(() =>
        !self.cannotUpdateStatus() && (self.isTasked() || self.isEnroute() || self.isOnsite())
    );

    self.canComplete = ko.pureComputed(() =>
        !self.cannotUpdateStatus() && self.isActiveStatus()
    );

    // ETA/ETC quick buttons on the status-change page -- see quickAdd. They
    // count from the time the status is being set: now, or the override time.
    const statusTimeAnchor = ko.pureComputed(() => {
        _etaTick();
        const t = self.timeOverrideEnabled() ? self.time() : null;
        return t && moment(t).isValid() ? moment(t).seconds(0).milliseconds(0) : moment().seconds(0).milliseconds(0);
    });
    const etaQuick = quickAdd(self.eta, statusTimeAnchor);
    self.etaQuickButtons = etaQuick.buttons;
    self.etaQuickLabel = etaQuick.label;
    self.onEtaQuickButtonClick = etaQuick.click;
    const etcQuick = quickAdd(self.etc, statusTimeAnchor);
    self.etcQuickButtons = etcQuick.buttons;
    self.etcQuickLabel = etcQuick.label;
    self.onEtcQuickButtonClick = etcQuick.click;

    self.statusOptions = ko.pureComputed(function () {
        return [
            { key: "Untask", label: "Remove Tasking", enabled: self.canUntask(), needsDetails: false, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false },
            { key: "Enroute", label: "En route", enabled: self.canEnroute(), needsDetails: true, needsTimeSet: true, needsETA: true, needsETC: false, needsReason: false },
            { key: "CallOff", label: "Call off", enabled: self.canCalloff(), needsDetails: true, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: true },
            { key: "Onsite", label: "On site", enabled: self.canOnsite(), needsDetails: true, needsTimeSet: true, needsETA: false, needsETC: true, needsReason: false },
            { key: "Offsite", label: "Off site", enabled: self.canOffsite(), needsDetails: true, needsTimeSet: true, needsETA: false, needsETC: false, needsReason: false },
            { key: "Complete", label: "Complete", enabled: self.canComplete(), needsDetails: false, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false }
        ];
    });

    self.onStatusOptionClick = function (option, event) {
        if (!option || !option.enabled) return;
        self.timeOverrideEnabled(false); // reset time override
        self.time(moment().seconds(0).milliseconds(0).format("YYYY-MM-DDTHH:mm"));

        self.newStatus(option.key)
        console.log("Selected Status: ", option.key);

        if (option.needsDetails) {
            self.statusDropdownPage("details");
        }

        if (option.needsTimeSet) {
            self.needsTimeSet(true);
        }

        if (option.needsETA) {
            self.needsETA(true);
        }

        if (option.needsETC) {
            self.needsETC(true);
        }

        if (option.needsReason) {
            self.needsReason(true);
        }

        if (option.key === "Untask") {
            self.updateTaskingStatus();
        }

        if (option.key === "Complete") {
            self.openCompletionInBeacon();
            self.closeStatusDropdown();
        }

        // stop Bootstrap dropdown doing odd things if needed
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
    };

    // Teams are completed in Beacon, not LAD -- opens the Beacon Remote tab on
    // this tasking's completion screen. Returns false if there's no source to open.
    self.openCompletionInBeacon = function () {
        //DO THE MAGIC LIGHTHOUSE STUFF OPENING HERE THINGO
        const url = self.taskCompletionLink()
        if (!url) return false;
        console.log("Opening completion in Beacon:", url);
        openURLInBeacon(url);
        showAlert("Teams must be completed from Beacon. Your Beacon Remote tab has been opened to the team completion screen for the selected team", "warning", 5000);
        return true;
    }

    self.goBackFromDetails = function () {
        self.statusDropdownPage(self.statusChangeMode() === "correction" ? "correct" : "status");
        self.statusChangeMode("forward");
        self.needsTimeSet(false);
        self.needsETA(false);
        self.needsETC(false);
        self.needsReason(false);
    }

    /*
        FORWARD-FIRST STATUS MENU
        The row dropdown leads with the next status, lists skip-aheads and
        stops separately, and hides going backwards behind "Correct an earlier
        status…" plus a tick box, since Beacon then removes the later status
        times. Changing the ETA/ETC of the current status is its own action.
        statusOptions (above) stays as-is for the Ops/Radio Log and Call Off
        modals, which only ever move forward.
    */

    // "forward" | "correction" | "estimate" -- what the details page is for.
    self.statusChangeMode = ko.observable("forward");
    self.correctPageVisible = ko.pureComputed(() => self.statusDropdownPage() === "correct");
    self.isCorrectionMode = ko.pureComputed(() => self.statusChangeMode() === "correction");
    self.isEstimateMode = ko.pureComputed(() => self.statusChangeMode() === "estimate");
    self.isForwardMode = ko.pureComputed(() => self.statusChangeMode() === "forward");

    // Where the tasking is in TASKING_STEPS (-1 for Untasked/CalledOff).
    self.stepIndex = ko.pureComputed(() => {
        if (self.isComplete()) return 4;
        if (self.isOffsite()) return 3;
        if (self.isOnsite()) return 2;
        if (self.isEnroute()) return 1;
        if (self.isTasked()) return 0;
        return -1;
    });

    // Time a step was reached, only for steps done so far (a later step's
    // stale timestamp from before an override isn't shown).
    const stepTime = (key) => {
        const i = TASKING_STEPS.findIndex(s => s.key === key);
        if (i > self.stepIndex()) return null;
        if (i === self.stepIndex()) return self.currentStatusTime();
        return { Enroute: self.enroute(), Onsite: self.onsite(), Offsite: self.offsite() }[key] || null;
    };
    const hhmm = (t) => (t && moment(t).isValid() ? moment(t).format("HH:mm") : "");
    const toInputTime = (m) => m.format("YYYY-MM-DDTHH:mm"); // datetime-local value

    self.progressSteps = ko.pureComputed(() => {
        const cur = self.stepIndex();
        return TASKING_STEPS.map((s, i) => ({
            label: s.label,
            css: i < cur ? "done" : i === cur ? "cur" : "",
            time: hhmm(stepTime(s.key)),
        }));
    });
    self.progressFillStyle = ko.pureComputed(() =>
        `width: calc((100% - 28px) * ${Math.max(0, self.stepIndex()) / (TASKING_STEPS.length - 1)})`
    );

    const optionFor = (key) => self.statusOptions().find(o => o.key === key);

    // Every later status the tasking can move to, in order.
    const forwardEntries = ko.pureComputed(() => {
        const cur = self.stepIndex();
        if (cur < 0) return [];
        return TASKING_STEPS
            .map((s, i) => ({ s, i, option: optionFor(s.key) }))
            .filter(({ i, option }) => i > cur && option && option.enabled)
            .map(({ s, i, option }) => {
                // Off site is optional before Complete, so it isn't "skipped".
                const skipped = TASKING_STEPS.slice(cur + 1, i)
                    .filter(x => !(s.key === "Complete" && x.key === "Offsite"))
                    .map(x => x.label);
                return {
                    option,
                    label: s.label,
                    isNext: skipped.length === 0,
                    note: skipped.length === 0 ? "" : skipped.length === 1 ? `skips ${skipped[0]}` : `skips ${skipped.length} steps`,
                    inBeacon: s.key === "Complete",
                };
            });
    });
    // Usually one next step; from On site both Off site and Complete are.
    self.nextStepEntries = ko.pureComputed(() => forwardEntries().filter(e => e.isNext));
    self.skipAheadEntries = ko.pureComputed(() => forwardEntries().filter(e => !e.isNext));
    self.stopEntries = ko.pureComputed(() =>
        ["CallOff", "Untask"]
            .map(optionFor)
            .filter(o => o && o.enabled)
            .map(option => ({ option, label: option.key === "CallOff" ? "Call off" : "Remove tasking" }))
    );

    self.chooseStatusEntry = function (entry, event) {
        self.statusChangeMode("forward");
        self.onStatusOptionClick(entry.option, event);
    };

    // --- Going backwards ---
    // Beacon can set En route / On site again (with overrideFutureStatuses);
    // there's no "back to Tasked", and Complete/Called off/Untasked are final.
    self.correctionEntries = ko.pureComputed(() => {
        const cur = self.stepIndex();
        if (self.cannotUpdateStatus() || cur < 2 || cur > 3) return [];
        return TASKING_STEPS
            .map((s, i) => ({ s, i }))
            .filter(({ s, i }) => i < cur && (s.key === "Enroute" || s.key === "Onsite"))
            .reverse() // nearest first
            .map(({ s, i }) => {
                const removed = TASKING_STEPS.slice(i + 1, cur + 1)
                    .map(x => `${x.label}${hhmm(stepTime(x.key)) ? " " + hhmm(stepTime(x.key)) : ""}`);
                // Back to En route: would Beacon still refuse a call off? (It
                // does once the team has been Off site.) Check the history as
                // it would be after this correction.
                const original = s.key === "Enroute" ? self.enroute() : null;
                const stillNoCallOff = s.key === "Enroute" && !canCallOffFromHistory([
                    ...self.statusHistory(),
                    { Name: "Enroute", TimeLogged: original || moment().format("YYYY-MM-DDTHH:mm:ss") },
                ]);
                return {
                    key: s.key,
                    label: s.label,
                    removes: removed.join(", "),
                    stillNoCallOff,
                    option: {
                        key: s.key, label: s.label, enabled: true, needsDetails: true, needsTimeSet: true,
                        needsETA: s.key === "Enroute", needsETC: s.key === "Onsite", needsReason: false,
                    },
                };
            });
    });
    self.canCorrect = ko.pureComputed(() => self.correctionEntries().length > 0);
    self.correctionTarget = ko.observable(null);
    self.correctionAck = ko.observable(false);
    self.correctionTitle = ko.pureComputed(() => {
        const t = self.correctionTarget();
        const cur = TASKING_STEPS[self.stepIndex()];
        return t && cur ? `${cur.label} → ${t.label}` : "";
    });
    self.openCorrection = function () {
        self.statusDropdownPage("correct");
    };
    self.backToStatusPage = function () {
        self.statusDropdownPage("status");
    };
    self.chooseCorrection = function (entry, event) {
        self.correctionTarget(entry);
        self.correctionAck(false);
        self.statusChangeMode("correction");
        self.onStatusOptionClick(entry.option, event);
        // A correction restores the earlier status as it was: start from the
        // time it was originally set (shown, and editable) and its estimate.
        const original = entry.key === "Enroute" ? self.enroute() : self.onsite();
        if (original && moment(original).isValid()) {
            self.time(toInputTime(moment(original)));
            self.timeOverrideEnabled(true);
        }
        const estimate = entry.key === "Enroute" ? self.enrouteEstimatedCompletion() : self.onsiteEstimatedCompletion();
        if (estimate && moment(estimate).isValid()) {
            self[entry.key === "Enroute" ? "eta" : "etc"](toInputTime(moment(estimate)));
        }
    };

    // --- New ETA/ETC for the current status ---
    self.estimateKind = ko.pureComputed(() => (self.isEnroute() ? "ETA" : self.isOnsite() ? "ETC" : null));
    self.estimateDraft = ko.observable(null); // datetime-local value
    const currentEstimate = () => (self.isEnroute() ? self.enrouteEstimatedCompletion() : self.onsiteEstimatedCompletion());
    // The editor counts from the current estimate, or from now once it has passed.
    const estimateAnchor = ko.pureComputed(() => {
        _etaTick();
        const now = moment().seconds(0).milliseconds(0);
        const cur = currentEstimate();
        return cur && moment(cur).isAfter(now) ? moment(cur).seconds(0).milliseconds(0) : now;
    });
    const estimateQuick = quickAdd(self.estimateDraft, estimateAnchor);
    self.estimateQuickLabel = estimateQuick.label;
    self.estimateQuickButtons = estimateQuick.buttons;
    self.onEstimateQuickClick = estimateQuick.click;
    // Back to the current estimate (or blank if there isn't one).
    self.resetEstimateDraft = function (data, event) {
        const cur = currentEstimate();
        self.estimateDraft(cur && moment(cur).isValid() ? toInputTime(moment(cur)) : null);
        if (event && event.stopPropagation) event.stopPropagation();
    };
    // Preview of the draft, in the same terms as the countdown chips.
    self.estimateDraftInfo = ko.pureComputed(() => {
        _etaTick();
        const d = self.estimateDraft();
        if (!d) return null;
        return etaInfoFor(self.currentStatus(), d, d);
    });
    self.estimateUnchanged = ko.pureComputed(() => {
        const d = self.estimateDraft();
        const cur = currentEstimate();
        return !d || (cur && moment(d).isSame(moment(cur), "minute"));
    });
    self.estimateSince = ko.pureComputed(() => hhmm(self.currentStatusTime()));
    self.estimateEditLabel = ko.pureComputed(() => (self.etaInfo() ? "Change" : `Set ${self.estimateKind()}`));
    self.currentStepLabel = ko.pureComputed(() => TASKING_STEPS[self.stepIndex()]?.label || self.currentStatus());
    self.openEstimateEditor = function (data, event) {
        const kind = self.estimateKind();
        if (!kind) return;
        self.onStatusDropdownToggleClick();
        self.statusChangeMode("estimate");
        self.newStatus(kind === "ETA" ? "Enroute" : "Onsite");
        // Keep the time the team reached this status -- only the estimate changes.
        self.time(self.currentStatusTime());
        self.resetEstimateDraft();
        self.statusDropdownPage("details");
        if (event && event.stopPropagation) event.stopPropagation();
    };

    // --- Status-change page header and time line ---
    self.statusChangeTitle = ko.pureComputed(() => {
        if (self.newStatus() === "CallOff") return "Call off";
        const to = TASKING_STEPS.find(s => s.key === self.newStatus());
        return `${self.currentStepLabel()} → ${to ? to.label : ""}`;
    });
    self.statusChangeIcon = ko.pureComputed(() => (self.newStatus() === "CallOff" ? "fa-ban tsm-head-stop" : "fa-arrow-right"));
    // "now (10:00)" until the user picks a different time.
    self.timeNowLabel = ko.pureComputed(() => {
        _etaTick();
        return `now (${moment().format("HH:mm")})`;
    });
    self.enableTimeOverride = function (data, event) {
        self.timeOverrideEnabled(true);
        if (event && event.stopPropagation) event.stopPropagation();
    };
    self.useNowTime = function (data, event) {
        self.timeOverrideEnabled(false);
        self.time(moment().seconds(0).milliseconds(0).format("YYYY-MM-DDTHH:mm"));
        if (event && event.stopPropagation) event.stopPropagation();
    };

    // --- Details page submit ---
    self.submitLabel = ko.pureComputed(() => {
        if (self.isEstimateMode()) {
            const i = self.estimateDraftInfo();
            return `Save ${self.estimateKind()}${i ? " " + moment(i.time).format("HH:mm") : ""}`;
        }
        const step = TASKING_STEPS.find(s => s.key === self.newStatus());
        if (self.isCorrectionMode()) return `Change to ${step ? step.label : ""}`;
        if (self.newStatus() === "CallOff") return "Call off";
        return step ? `Set ${step.label}` : "Submit";
    });
    self.submitDisabled = ko.pureComputed(() =>
        (self.isCorrectionMode() && !self.correctionAck()) ||
        (self.isEstimateMode() && self.estimateUnchanged())
    );
    self.submitCss = ko.pureComputed(() => (self.isCorrectionMode() ? "btn-warning" : "btn-primary"));

    // Builds the Beacon request for a status change from this tasking's current
    // state plus a draft ({ newStatus, time, eta, etc, reason }). Writes nothing --
    // shared by the row dropdown below and the Ops/Radio Log modal, which holds
    // its own draft and only sends on Submit. action is null for Complete (that's
    // a Beacon handoff, see openCompletionInBeacon) or an unknown status.
    self.buildStatusChange = function ({ newStatus, time, eta, etc, reason, description = "" } = {}) {
        const formattedTime = (time ? moment(time) : moment()).format("YYYY-MM-DDTHH:mm:ssZ");
        let action = null; // our friendly UI name is different to the Beacon API backend name, so this value is for that backend value that will be used to form the URL later on.
        let payload = { timeLogged: formattedTime, overrideFutureStatuses: 0, description, LighthouseFunction: "updatingTeamStatus" };

        if (newStatus === "Enroute") {
            action = "Enroute";
            if (eta && moment(eta).isValid()) {
                payload.estimatedCompletion = moment(eta).format("YYYY-MM-DDTHH:mm:ssZ");
            } else {
                payload.estimatedCompletion = null;
            }
        }

        // CONSTRUCT PAYLOD FOR ONSITE
        if (newStatus === "Onsite") {
            action = "Onsite";
            if (etc && moment(etc).isValid()) {
                payload.estimatedCompletion = moment(etc).format("YYYY-MM-DDTHH:mm:ssZ");
            } else {
                payload.estimatedCompletion = null;
            }
        }

        // CONSTRUCT PAYLOAD FOR OFFSITE
        if (newStatus === "Offsite") {
            action = "Offsite";
            payload.estimatedCompletion = null;
            payload.taskingId = self.id();
        }

        // Construct Payload for Call Off
        if (newStatus === "CallOff") {
            action = "CallOff";
            payload.TaskingId = self.id();
            payload.InjuriesSustained = false;
            payload.AARCompleted = false;
            payload.CISPRequired = false;
            payload.VesselUsed = false;
            payload.RiskAssessmentCompleted = false;
            payload.ReasonForCallOff = reason;
            payload.InjuredPeopleIds = [];
            payload.CompleteJob = false;
            payload.LighthouseFunction = "callOffTeamFromJob";
        }

        // Construct Payload for Untask
        if (newStatus === "Untask") {
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
        if (newStatus === "Enroute" && self.currentStatus() !== "Tasked") {
            payload.overrideFutureStatuses = self.id();
        }

        if (newStatus === "Onsite" && self.currentStatus() !== "Enroute") {
            payload.overrideFutureStatuses = self.id();
        }

        if (newStatus === "Offsite" && self.currentStatus() !== "Onsite") {
            payload.overrideFutureStatuses = self.id();
        }

        return { action, payload };
    }

    self.updateTaskingStatus = function () {
        console.log("SUBMITTING");
        if (self.submitDisabled()) return;
        const estimate = self.isEstimateMode() ? self.estimateDraft() : null;
        const target = self.correctionTarget();
        const { action, payload } = self.buildStatusChange({
            newStatus: self.newStatus(),
            time: self.time(),
            eta: estimate && self.newStatus() === "Enroute" ? estimate : self.eta(),
            etc: estimate && self.newStatus() === "Onsite" ? estimate : self.etc(),
            reason: self.callOffReason(),
            description: self.isCorrectionMode() && target
                ? `Status corrected from ${TASKING_STEPS[self.stepIndex()]?.label} to ${target.label} (Lighthouse)`
                : "",
        });

        // Send to ParentVM to make API Call
        // If it's a POST Request send it to the UpdateTeamStatus API - sends Tasking, Action (what status we are changing to), Payload and Callback.
        const UpdateTeamStatusAPI = ['Enroute', 'Onsite', 'Offsite']
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