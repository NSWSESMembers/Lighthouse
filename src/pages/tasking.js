/* eslint-disable @typescript-eslint/no-this-alias */
global.jQuery = $;

import BeaconClient from '../shared/BeaconClient.js';
const BeaconToken = require('./lib/shared_token_code.js');

require('./lib/shared_chrome_code.js'); // side-effect

import '../../styles/pages/tasking.css';

import { ResizeDividers } from './tasking/resize.js';
<<<<<<< Updated upstream
import { buildJobPopupKO } from './tasking/map_popup.js';

var $ = require('jquery');
var _ = require('underscore');
=======
import { addOrUpdateJobMarker, removeJobMarker } from './tasking/incidentMarker.js';
import { attachAssetMarker, detachAssetMarker } from './tasking/assetMarker.js';
var $ = require('jquery');
>>>>>>> Stashed changes
var moment = require('moment');
var L = require('leaflet');
var esri = require('esri-leaflet');

var token = '';
<<<<<<< Updated upstream
var tokenExp = '';

=======
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var tokenExp = '';

const safeStr = v => (v == null ? "" : String(v));

>>>>>>> Stashed changes

require('leaflet-easybutton');
require('leaflet-routing-machine');
require('leaflet-svg-shape-markers');
require('lrm-graphhopper'); // Adds L.Routing.GraphHopper onto L.Routing
require('leaflet/dist/leaflet.css');

<<<<<<< Updated upstream
require('bootstrap'); // for jq plugin: modal

import * as bootstrap from 'bootstrap'; // gives you Modal, Tooltip, etc.
=======
require('bootstrap5'); // for jq plugin: modal



import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.
>>>>>>> Stashed changes



const params = getSearchParameters();
const apiHost = params.host

var ko;
var myViewModel;


<<<<<<< Updated upstream

=======
/////////DATA REFRESH CODE   

var assetDataRefreshInterlock = false

var assetDataRefreshTimer = null

function startAssetDataRefreshTimer() {
    if (assetDataRefreshTimer) clearInterval(assetDataRefreshTimer);
    assetDataRefreshTimer = setInterval(() => {
        fetchAllTrackableAssets
    }, 10000);
};

startAssetDataRefreshTimer()
>>>>>>> Stashed changes

const teamLocationFilter = new Map();
const incidentLocationFilter = new Map();



// --- Leaflet map with Esri basemap
<<<<<<< Updated upstream
const map = L.map('map', { zoomControl: true }).setView([-33.8688, 151.2093], 11);
=======
const map = L.map('map', {
    zoomControl: true, // 1 / 10th of the original zoom step
    zoomSnap: .5,
    // Faster debounce time while zooming
    wheelDebounceTime: 50
}).setView([-33.8688, 151.2093], 11);
>>>>>>> Stashed changes

ResizeDividers(map)

// Esri default basemap (others: 'Streets','Imagery','Topographic','Gray','DarkGray', etc.)
esri.basemapLayer('Topographic', { ignoreDeprecationWarning: true }).addTo(map);


function Tag(data = {}) {
    const self = this;
    self.id = ko.observable(data.Id ?? null);
    self.name = ko.observable(data.Name ?? "");
    self.tagGroupId = ko.observable(data.TagGroupId ?? null);
}

function Tasking(data = {}) {
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

    // status helpers
    self.statusSince = ko.pureComputed(() => (self.currentStatusTime() ? new Date(self.currentStatusTime()) : null));
    self.statusAgeSeconds = ko.pureComputed(() => {
        const d = self.statusSince();
        return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000)) : null;
    });
    self.statusSetAt = ko.pureComputed(() => (self.currentStatusTime() ? moment(self.currentStatusTime()).format("DD/MM/YYYY HH:mm:ss") : null));


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
<<<<<<< Updated upstream
=======

    self.routeControl = null;
    self.distanceMarkerRoute = null
    self._routeSubs = []; // KO subscriptions for live updates

    function getTeamLatLng() {
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

    function getJobLatLng() {
        const j = self.job;
        if (!j) return null;
        const lat = +ko.unwrap(j.address.latitude), lng = +ko.unwrap(j.address.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? L.latLng(lat, lng) : null;
    }

    self.clearRoute = function () {
        // remove LRM control and dispose subscriptions
        if (self.routeControl && map) {
            map.removeControl(self.routeControl);
        }
        self.routeControl = null;
        if (self.distanceMarkerRoute) {
            map.removeLayer(self.distanceMarkerRoute);
        }
        self.distanceMarkerRoute = null;
        while (self._routeSubs.length) {
            const sub = self._routeSubs.pop();
            try { sub?.dispose?.(); } catch { /* ignore */ }
        }
    };

    /**
     * Draw a route between the team's current position and the job.
     */
    self.drawRoute = function () {
        console.log(`Drawing route for tasking ${self.id()}`);

        const from = getTeamLatLng();
        const to = getJobLatLng();
        if (!from || !to) {
            console.warn('Cannot draw route: missing team or job coordinates.');
            return;
        }

        // Recreate clean control each time
        self.clearRoute();
        if (myViewModel.activeRoute) {
            myViewModel.activeRoute.remove();
        }

        self.routeControl = L.Routing.control({
            waypoints: [from, to],
            router: L.Routing.graphHopper('lighthouse', {
                serviceUrl: 'https://graphhopper.lighthouse-extension.com/route',
                urlParameters: { 'ch.disable': true, instructions: false },
            }),
            lineOptions: {
                styles: [{ opacity: 0.9, weight: 6 }, { opacity: 1.0, weight: 3, dashArray: '6,8' }]
            },
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            createMarker: function () { return null },
            show: false // keep the big itinerary panel hidden
        })


        self.routeControl.on('routesfound', e => {
            const route = e.routes && e.routes[0];
            if (!route || !route.coordinates) return;

            var r = e.routes[0]
            let middle = r.coordinates[Math.floor(r.coordinates.length / 4)];

            let distance = r.summary.totalDistance;
            let time = r.summary.totalTime;
            let timeHr = parseInt(moment.utc(time * 1000).format('HH'));
            let timeMin = parseInt(moment.utc(time * 1000).format('mm'));
            let timeText = '';
            if (timeHr == 0) {
                timeText = `${timeMin} min`;
            } else {
                timeText = `${timeHr} hr ${timeMin} min`;
            }
            self.distanceMarkerRoute = new L.circleMarker([middle.lat, middle.lng], { radius: 0.1 }).addTo(
                map,
            ); //opacity may be set to zero
            self.distanceMarkerRoute.bindTooltip(
                `<div style="text-align: center;"><strong>${(distance / 1000).toFixed(
                    1,
                )} km - ${timeText}</strong></div>`,
                { permanent: true, offset: [0, 0] },
            );

            const bounds = L.latLngBounds(route.coordinates);
            console.log('Fitting map to route bounds:', bounds);

            //Smooth zoom/pan to fit the whole route with padding
            map.flyToBounds(bounds, {
                padding: [150, 150],  // add more if you have a sidebar, e.g. [200, 80]
                maxZoom: 13,        // optional: prevent over-zoom
                duration: 1.2       // seconds; optional for smoother transition
            });
        });
        myViewModel.activeRoute = self.routeControl;
        self.routeControl.addTo(map);

        // Auto-update route when the team's first asset or job location moves
        const team = self.team;
        if (team && team.trackableAssets && team.trackableAssets().length > 0) {
            const a = team.trackableAssets()[0];
            self._routeSubs.push(a.latitude.subscribe(() => {
                const s = getTeamLatLng(); const d = getJobLatLng();
                if (s && d && self.routeControl) self.routeControl.setWaypoints([s, d]);
            }));
            self._routeSubs.push(a.longitude.subscribe(() => {
                const s = getTeamLatLng(); const d = getJobLatLng();
                if (s && d && self.routeControl) self.routeControl.setWaypoints([s, d]);
            }));
        }

        const j = self.job;
        if (j) {
            self._routeSubs.push(j.address.latitude.subscribe(() => {
                const s = getTeamLatLng(); const d = getJobLatLng();
                if (s && d && self.routeControl) self.routeControl.setWaypoints([s, d]);
            }));
            self._routeSubs.push(j.address.longitude.subscribe(() => {
                const s = getTeamLatLng(); const d = getJobLatLng();
                if (s && d && self.routeControl) self.routeControl.setWaypoints([s, d]);
            }));
        }
    };

    self.drawLineToJob = function () {
        console.log('Drawing line to job for tasking', this.id());
        // clear any existing one first
        this.removeLine();

        const team = this.team;
        const job = this.job;
        if (!team || !job) return;

        // pick the team’s first asset coordinates
        let fromLat = null, fromLng = null;
        if (team.trackableAssets && team.trackableAssets().length > 0) {
            const a = team.trackableAssets()[0];
            fromLat = +ko.unwrap(a.latitude);
            fromLng = +ko.unwrap(a.longitude);
        }
        const toLat = +ko.unwrap(job.address.latitude);
        const toLng = +ko.unwrap(job.address.longitude);

        if (!(Number.isFinite(fromLat) && Number.isFinite(fromLng) &&
            Number.isFinite(toLat) && Number.isFinite(toLng))) return;

        self._polyline = L.polyline(
            [
                [fromLat, fromLng],
                [toLat, toLng],
            ],
            { weight: 4, color: 'green', dashArray: '6' }
        )
        self._polyline.addTo(map);
    };

    self.removeLine = function () {
        if (self._polyline) {
            map.removeLayer(this._polyline);
            self._polyline = null;
        }
    };
>>>>>>> Stashed changes
}

function Team(data = {}) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    self.id = ko.observable(data.Id ?? null);
    self.callsign = ko.observable(data.Callsign ?? "");
    self.assignedTo = new Entity(data.EntityAssignedTo || data.CreatedAt);
    self.status = ko.observable(data.TeamStatusType || null); // {Id,Name,Description}
<<<<<<< Updated upstream
    self.expanded = ko.observable(false);
=======
>>>>>>> Stashed changes
    self.members = ko.observableArray(data.Members);
    self.teamLeader = ko.computed(function () {
        const leader = ko.unwrap(self.members).find(m => m.TeamLeader === true);
        return leader ? `${leader.Person.FirstName} ${leader.Person.LastName}` : '-';
    });

<<<<<<< Updated upstream
=======
    self.trackableAssets = ko.observableArray([]);

    self.expanded = ko.observable(false);


>>>>>>> Stashed changes
    self.taskingLoading = ko.observable(true);
    self.taskings = ko.observableArray([]);

    self.statusName = ko.pureComputed(() => {
        return (self.status() && self.status().Name) || "Unknown";
    })

    self.activeTaskingsCount = ko.pureComputed(() => {
        return self.filteredTaskings() && self.filteredTaskings().length || 0;
    })

<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
    self.filteredTaskings = ko.pureComputed(() => {
        const ignoreList = [
            "Complete",
            "Untasked",
            "CalledOff"
        ];
        return ko.utils.arrayFilter(this.taskings(), ts => {
            if (ignoreList.includes(ts.currentStatus())) {
<<<<<<< Updated upstream
                return false
            }
            return true
        })
=======
                return false;
            }
            return true;
        }).sort((a, b) => new Date(b.currentStatusTime()) - new Date(a.currentStatusTime()));
>>>>>>> Stashed changes
    });

    self.taskingRowColour = ko.pureComputed(() => {
        if (self.activeTaskingsCount() === 0) {
            return '#d4edda'; // light green
        }
    })

    self.teamLink = ko.pureComputed(() => `${params.source}/Teams/${self.id()}/Edit`);

    self.editTasking = () => {
        window.open(self.teamLink(), '_blank');
        event.preventDefault();
    };


    self.toggle = () => self.expanded(!self.expanded());
    self.expand = () => self.expanded(true);
    self.collapse = () => self.expanded(false);
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
    self.expanded.subscribe(function (isExpanded) {
        if (isExpanded && self.taskingLoading()) {
            self.fetchTasking();
        }
    });
<<<<<<< Updated upstream
=======

    self.updateStatusById = function (statusId) {
        const status = teamStatusById[statusId];
        if (status) {
            self.status(status);
        }
    }
>>>>>>> Stashed changes
    self.fetchTasking = function () {
        BeaconClient.team.getTasking(self.id.peek(), apiHost, params.userId, token, function (tasking) {
            tasking.Results.forEach(t => {
                self.upsertTaskingFromPayload(myViewModel, t);
            })
            self.taskingLoading(false);
        })
    }

    self.findTaskingById = function (taskingId) {
        const arr = this.taskings && ko.unwrap(this.taskings);
        if (!arr) return undefined;
        return arr.find(t => t.id && t.id() === taskingId);
    }

    self.upsertTaskingFromPayload = function (vm, taskingJson) {
        const t = vm.upsertTaskingFromPayload(taskingJson, { teamContext: self });
        // ensure it's listed under this team locally
        const existsLocally = self.taskings().some(x => x.id() === t.id());
        if (!existsLocally) self.taskings.push(t);
    };

<<<<<<< Updated upstream
=======
    //only handle single asset for now
    self.markerFocus = function () {
        if (!map) return;
        const lat = self.trackableAssets()[0].latitude();
        const lng = self.trackableAssets()[0].longitude();
        if (!lat || !lng) return;
        console.log("Focusing map to asset at:", lat, lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            map.flyTo([lat, lng], 14, { animate: true, duration: 0.10 });
            self.trackableAssets()[0].marker.openPopup();
        }
    }

    const teamStatusById = {
        1: {
            Key: "Standby",
            Id: 1,
            Name: "Standby",
            Description: "Standby",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        2: {
            Key: "OnAlert",
            Id: 2,
            Name: "OnAlert",
            Description: "On Alert",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        3: {
            Key: "Activated",
            Id: 3,
            Name: "Activated",
            Description: "Activated",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        4: {
            Key: "Rest",
            Id: 4,
            Name: "Rest",
            Description: "Rest",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        5: {
            Key: "StoodDown",
            Id: 5,
            Name: "StoodDown",
            Description: "Stood down",
            ParentId: null,
            GroupId: null,
            Colour: null
        }
    };
>>>>>>> Stashed changes
}

function Address(data = {}) {
    const self = this;
    self.gnafId = ko.observable(data.GnafId ?? null);
    self.latitude = ko.observable(data.Latitude ?? null);
    self.longitude = ko.observable(data.Longitude ?? null);
    self.streetNumber = ko.observable(data.StreetNumber ?? "");
    self.street = ko.observable(data.Street ?? "");
    self.locality = ko.observable(data.Locality ?? "");
    self.postCode = ko.observable(data.PostCode ?? "");
    self.prettyAddress = ko.observable(data.PrettyAddress ?? "");

    self.latLng = ko.pureComputed(() => {
        const lat = +self.latitude(), lng = +self.longitude();
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    });

    self.short = ko.pureComputed(() => {
        const a = [self.streetNumber(), self.street()].filter(Boolean).join(" ");
        const b = [self.locality(), "NSW"].filter(Boolean).join(", ");
        return [a, b].filter(Boolean).join(", ");
    });
}

<<<<<<< Updated upstream
=======
function Asset(data = {}) {
    const self = this;
    self.id = ko.observable(data.properties.id ?? null);
    self.name = ko.observable(data.properties.name ?? "");
    self.markerLabel = ko.observable(data.markerLabel ?? "");
    self.latitude = ko.observable(data.geometry.coordinates[1] ?? null);
    self.longitude = ko.observable(data.geometry.coordinates[0] ?? null);
    self.capability = ko.observable(data.properties.capability ?? "");
    self.entity = ko.observable(data.properties.entity ?? "");
    self.resourceType = ko.observable(data.properties.resourceType ?? "");
    self.lastSeen = ko.observable(data.lastSeen ?? "");
    self.licensePlate = ko.observable(data.properties.licensePlate ?? "");
    self.direction = ko.observable(data.properties.direction ?? null);
    self.talkgroup = ko.observable(data.properties.talkgroup ?? "");
    self.talkgroupLastUpdated = ko.observable(data.properties.talkgroupLastUpdated ?? "");
    self.marker = null;
    self.matchingTeams = ko.observableArray();


    self.lastSeenText = ko.pureComputed(() => {
        const v = safeStr(self.lastSeen?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d) + " — " + d.toLocaleString();
    });

    self.talkgroupLastUpdatedText = ko.pureComputed(() => {
        const v = safeStr(self.talkgroupLastUpdated?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d);
    });

    self.latLngText = ko.pureComputed(() => {
        const lat = self.latitude?.();
        const lng = self.longitude?.();
        if (lat == null || lng == null) return "";
        return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    });

    Asset.prototype.updateFromJson = function (d = {}) {
        if (!d) return;

        if (d.properties !== undefined) {
            if (d.properties.direction !== undefined) this.direction(d.properties.direction);
            if (d.properties.talkgroup !== undefined) this.talkgroup(d.properties.talkgroup);
            if (d.properties.talkgroupLastUpdated !== undefined) this.talkgroupLastUpdated(d.properties.talkgroupLastUpdated);
        }

        if (d.markerLabel !== undefined) this.markerLabel(d.markerLabel);
        if (d.geometry !== undefined && Array.isArray(d.geometry.coordinates)) {
            if (d.geometry.coordinates[1] !== undefined) this.latitude(d.geometry.coordinates[1]);
            if (d.geometry.coordinates[0] !== undefined) this.longitude(d.geometry.coordinates[0]);
        }

        if (d.lastSeen !== undefined) this.lastSeen(d.lastSeen);
    }
}

>>>>>>> Stashed changes
function Entity(data = {}) {
    const self = this;
    self.id = ko.observable(data.Id ?? null);
    self.code = ko.observable(data.Code ?? "");
    self.name = ko.observable(data.Name ?? "");
    self.latitude = ko.observable(data.Latitude ?? null);
    self.longitude = ko.observable(data.Longitude ?? null);
    self.parentEntity = ko.observable(
        data.ParentEntity ? { id: data.ParentEntity.Id, code: data.ParentEntity.Code, name: data.ParentEntity.Name } : null
    );
}

function Job(data = {}) {
    const self = this;

<<<<<<< Updated upstream
    self.marker = null;  // will hold the L.Marker instance
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
    self.taskings = ko.observableArray();
=======
    self.lastDataUpdate = new Date()

    self.dataRefreshTimer = null;

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
        if (self.dataRefreshTimer) {
            clearInterval(self.dataRefreshTimer);
            self.dataRefreshTimer = null;
        }
    };

    self.startDataRefreshCheck() //start counting for a refresh

    //refs to other obs
    self.marker = null;  // will hold the L.Marker instance
    self.taskings = ko.observableArray(); //array of taskings

>>>>>>> Stashed changes

    self.sortedTaskings = ko.computed(function () {
        return self.taskings()
            .slice() // clone array
            .sort(function (a, b) {
                return new Date(a.currentStatusTime) - new Date(b.currentStatusTime);
            });
    });

    // computed
    self.jobLink = ko.pureComputed(() => `${params.source}/Jobs/${self.id()}`);
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

<<<<<<< Updated upstream

=======
        self.startDataRefreshCheck() //restart counting for a refresh
>>>>>>> Stashed changes

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

    self.focusMap = function () {
        if (!map) return;
        const lat = self.address.latitude();
        const lng = self.address.longitude();
        console.log("Focusing map to job at:", lat, lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            map.flyTo([lat, lng], 16, { animate: true, duration: 0.10 });
            self.marker.openPopup();
        }
    }

    self.onPopupOpen = function () {
<<<<<<< Updated upstream
        // self.taskingLoading(true);
        // self.fetchTasking();
=======
        self.taskingLoading(true);
        self.fetchTasking();
>>>>>>> Stashed changes

    };

    self.onPopupClose = function () {
        // popup closing logic goes here
    };

    self.fetchTasking = function () {
        BeaconClient.job.getTasking(self.id(), apiHost, params.userId, token, function (tasking) {
            tasking.Results.forEach(t => {
                myViewModel.upsertTaskingFromPayload(t); // VM attaches the shared Job ref automatically
            });
            self.taskingLoading(false);
        })
    }
<<<<<<< Updated upstream
=======

    self.refreshData = function () {
        BeaconClient.job.get(self.id(), 1, apiHost, params.userId, token, function (r) {
            self.updateFromJson(r)
            self.lastDataUpdate = new Date()
        })
    }
>>>>>>> Stashed changes
}


function VM() {
    const self = this;

    self.tokenLoading = ko.observable(true);
<<<<<<< Updated upstream
=======
    self.teamsLoading = ko.observable(true);
    self.jobsLoading = ko.observable(true);
>>>>>>> Stashed changes

    // Registries
    self.teamsById = new Map();
    self.jobsById = new Map();
    self.taskingsById = new Map();
<<<<<<< Updated upstream
=======
    self.assetsById = new Map();
>>>>>>> Stashed changes

    // Global collections
    self.teams = ko.observableArray();
    self.jobs = ko.observableArray();
    self.taskings = ko.observableArray();

<<<<<<< Updated upstream
=======
    self.trackableAssets = ko.observableArray([]);

    self.activeRoute = null;

    // groups per type for easy toggling
    self.jobMarkerGroups = new Map(); // typeName → {layerGroup, markers: Map<JobId, Marker>}

    // --- Vehicle Layer ---
    self.vehicleLayer = L.layerGroup().addTo(map);
>>>>>>> Stashed changes


    self.jobSearch = ko.observable('');

<<<<<<< Updated upstream
    //TODO: filtering logic for jobs that come from tasking?
    self.filteredJobs = ko.pureComputed(() => {
        const hqsFilter = Array.from(incidentLocationFilter.values()).map(f => ({ Id: f.id }));
        return ko.utils.arrayFilter(this.jobs(), jb => {
            if (hqsFilter.some(f => f.Id === jb.entityAssignedTo.id())) {
                const term = self.jobSearch().toLowerCase();
                return (!term || jb.identifier().includes(term) ||
                    jb.address.prettyAddress().toLowerCase().includes(term));
            }
            return false
        })
    });

=======
    self.teamStatusFilterList = ko.observableArray([
        "Standby",
        "Stood down"
    ]);

    self.jobsStatusFilterList = ko.observableArray([
        "Finalised",
        "Cancelled",
        "Complete"
    ])

    self.filteredJobs = ko.pureComputed(() => {

        const hqsFilter = Array.from(incidentLocationFilter.values()).map(f => ({ Id: f.id }));
        const term = self.jobSearch().toLowerCase();

        return ko.utils.arrayFilter(this.jobs(), jb => {

            // If its an ignored status return false

            if (self.jobsStatusFilterList().includes(jb.statusName())) {
                return false
            }

            // If no HQ filters are active, skip HQ filtering
            const hqMatch = hqsFilter.length === 0 || hqsFilter.some(f => f.Id === jb.entityAssignedTo.id());

            if (!hqMatch) return false;

            // Apply text search
            return (!term ||
                jb.identifier().toLowerCase().includes(term) ||
                jb.address.prettyAddress().toLowerCase().includes(term));
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });


    self.filteredJobsIgnoreSearch = ko.pureComputed(() => {
        const ignoreList = [
            "Finalised",
            "Cancelled"
        ];

        const hqsFilter = Array.from(incidentLocationFilter.values()).map(f => ({ Id: f.id }));

        return ko.utils.arrayFilter(this.jobs(), jb => {

            // If its an ignored status return false

            if (ignoreList.includes(jb.statusName())) {
                return false
            }

            // If no HQ filters are active, skip HQ filtering
            const hqMatch = hqsFilter.length === 0 || hqsFilter.some(f => f.Id === jb.entityAssignedTo.id());

            if (!hqMatch) return false;

            return true
        });
    }).extend({ trackArrayChanges: true });
>>>>>>> Stashed changes

    self.teamSearch = ko.observable('');

    self.filteredTeams = ko.pureComputed(() => {
<<<<<<< Updated upstream
        const ignoreList = [
            "Standby",
            "Stood down"
        ];
=======

>>>>>>> Stashed changes
        return ko.utils.arrayFilter(this.teams(), tm => {
            if (tm.status() == null) {
                return false
            }
<<<<<<< Updated upstream
            if (ignoreList.includes(tm.status())) {
=======
            if (self.teamStatusFilterList().includes(tm.status())) {
>>>>>>> Stashed changes
                return false
            }
            const term = self.teamSearch().toLowerCase();
            if (tm.callsign().toLowerCase().includes(term)) {
                return true
            }
            return false
        })
<<<<<<< Updated upstream
    });

    // Team registry/upsert
    self.getOrCreateTeam = function (teamJson) {

=======
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

    const canon = s => (s || "")
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""); // drop hyphens, spaces, etc.

    self.filteredTrackableAssets = ko.pureComputed(() => {

        // No teams? Return nothing
        if (!self.trackableAssets) return [];


        return ko.utils.arrayFilter(self.trackableAssets() || [], a => {
            const teams = ko.unwrap(a.matchingTeams);
            if (!Array.isArray(teams) || teams.length === 0) return false;

            // Return true if at least one team's status() is not in ignoreList
            return teams.some(t => {
                const status = ko.unwrap(t.status);
                return status && !self.teamStatusFilterList().includes(status);
            });
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

    // Team registry/upsert - called from tasking OR team fetch so values might be missing
    self.getOrCreateTeam = function (teamJson) {
>>>>>>> Stashed changes
        if (!teamJson || teamJson.Id == null) return null;
        let team = self.teamsById.get(teamJson.Id);
        if (team) {
            team.callsign(teamJson.Callsign ?? team.callsign());
<<<<<<< Updated upstream
            return team;
        }
        team = new Team(teamJson);
        team.fetchTasking()
        self.teams.push(team);
        self.teamsById.set(team.id(), team);
=======
            if (teamJson.CurrentStatusId != null) {
                team.updateStatusById(teamJson.CurrentStatusId);
            } else {
                team.status(teamJson.TeamStatusType || team.status());
            }
            team.members = ko.observableArray(teamJson.Members);
            self._refreshTeamTrackableAssets(team); //incase the callsign changed
            return team;
        }
        team = new Team(teamJson);
        //team.fetchTasking()
        self.teams.push(team);
        self.teamsById.set(team.id(), team);
        self._refreshTeamTrackableAssets(team);
>>>>>>> Stashed changes
        return team;
    };

    // Job registry/upsert
    self.getOrCreateJob = function (jobJson) {
        if (!jobJson || jobJson.Id == null) return null;
        let job = this.jobsById.get(jobJson.Id);
        if (job) {
            job.updateFromJson(jobJson);
            return job;
        }
        job = new Job(jobJson);
<<<<<<< Updated upstream
        job.fetchTasking()
=======
>>>>>>> Stashed changes
        this.jobs.push(job);
        this.jobsById.set(job.id(), job);
        return job;
    };

<<<<<<< Updated upstream

    // Tasking registry/upsert (NEW magical 2.0 way of doing it)
    self.upsertTaskingFromPayload = function (taskingJson, { teamContext = null } = {}) {
=======
    // asset registry/upsert
    self.getOrCreateAsset = function (assetJson) {
        if (assetJson.type === 'telematics') return null;
        if (!assetJson || assetJson.properties.id == null) return null;

        let asset = self.assetsById.get(assetJson.properties.id);
        if (asset) {
            asset.updateFromJson(assetJson);
            self._attachAssetToMatchingTeams(asset);
            return asset;
        } else {
            asset = new Asset(assetJson);
            self.trackableAssets.push(asset);
            self._attachAssetToMatchingTeams(asset);
            self.assetsById.set(asset.id(), asset);
        }
        return asset;
    };


    self._assetMatchesTeam = function (asset, team) {
        if (!asset || !team) return false;
        const cs = canon(ko.unwrap(team.callsign));
        if (!cs) return false;     // prefer explicit name fields; fall back defensively
        const nameCanon = canon(asset.name());
        if (!nameCanon) return false;
        return nameCanon.includes(cs) || cs.includes(nameCanon);
    };

    // recompute one team's asset list
    self._refreshTeamTrackableAssets = function (team) {
        if (!team || typeof team.trackableAssets !== 'function') return;
        const out = [];
        (self.trackableAssets() || []).forEach(a => {
            if (self._assetMatchesTeam(a, team)) {
                out.push(a);
                a.matchingTeams.push(team)
            }
        });
        team.trackableAssets(out);
    };

    // when a single asset changes/arrives, patch all teams that match
    self._attachAssetToMatchingTeams = function (asset) {
        (self.teams() || []).forEach(team => {
            const list = team.trackableAssets();
            const has = list.includes(asset);
            const match = self._assetMatchesTeam(asset, team);
            if (match && !has) {
                asset.matchingTeams.push(team)
                team.trackableAssets.push(asset);
            }
            if (!match && has) {
                asset.matchingTeams.remove(team)
                team.trackableAssets.remove(asset);
            }
        });
    };

    // Tasking registry/upsert (NEW magical 2.0 way of doing it)
    self.upsertTaskingFromPayload = function (taskingJson, { teamContext = null } = {}) {

>>>>>>> Stashed changes
        if (!taskingJson || taskingJson.Id == null) return null;

        // Resolve shared refs
        const jobRef = self.getOrCreateJob(taskingJson.Job);
        const teamRef = teamContext || self.getOrCreateTeam(taskingJson.Team);

        let t = self.taskingsById.get(taskingJson.Id);
        if (t) {
            t.updateFrom(taskingJson);
        } else {
            t = new Tasking(taskingJson);
            self.taskings.push(t);
            self.taskingsById.set(t.id(), t);
        }

        // Attach shared references
        if (jobRef) t.job = jobRef;
        if (teamRef) t.team = teamRef;
        t.setJob(jobRef || null);
        self._linkTaskingToJob(t, jobRef);

        return t;
    };

<<<<<<< Updated upstream
=======
    self.initialFitDone = false;
    let initialFetchesPending = 3; // teams, jobs, assets

    function debounce(fn, ms) {
        let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    const tryInitialFit = debounce(() => {
        if (self.initialFitDone || initialFetchesPending > 0) return;

        // Gather every current marker into one feature group
        const fg = L.featureGroup();

        // vehicle (assets)
        self.vehicleLayer.eachLayer(l => fg.addLayer(l));

        // all job marker layer groups
        for (const { layerGroup } of self.jobMarkerGroups.values()) {
            layerGroup.eachLayer(l => fg.addLayer(l));
        }

        const layers = fg.getLayers();
        if (!layers.length) return;

        // Fit with a little padding, once
        map.fitBounds(fg.getBounds().pad(0.12), { maxZoom: 15 });
        self.initialFitDone = true;
    }, 150);

    // Call when each “first load” fetch finishes
    self._markInitialFetchDone = function () {
        console.log("Initial fetch done, remaining:", initialFetchesPending - 1);
        if (initialFetchesPending > 0) {
            initialFetchesPending -= 1;
            // Give subscriptions time to attach markers, then attempt fit
            tryInitialFit();
        }
    };

>>>>>>> Stashed changes
    self._linkTaskingToJob = function (tasking, job) {
        if (!tasking) return;
        const prev = tasking.job || null;
        if (prev && prev !== job) prev.removeTasking(tasking);   // detach from old job
        if (job) {
            tasking.job = job;                                     // set shared ref
            job.addTasking(tasking);                               // attach to new job
        } else {
            tasking.job = null;
        }
    };


<<<<<<< Updated upstream


    self.jobMarkerGroups = new Map();   // typeName → {layerGroup, markers: Map<JobId, Marker>}
    self.markerLayersControl = null;    // optional Leaflet layer control


    self.assignJobToTeam = function (teamVm, jobVm) {
        BeaconClient.tasking.task(teamVm.id(), jobVm.id(), apiHost, params.userId, token, function (tasking) {
=======
    self.markerLayersControl = null;    // optional Leaflet layer control



    self.assignJobToTeam = function (teamVm, jobVm) {
        BeaconClient.tasking.task(teamVm.id(), jobVm.id(), apiHost, params.userId, token, function () {
>>>>>>> Stashed changes
            jobVm.fetchTasking();
            teamVm.fetchTasking();
        })
    }

<<<<<<< Updated upstream
    // type → shape
    const typeShape = {
        "Storm": "circle",
        "Flood Misc": "diamond",
        "Flood": "square",
        "FR": "diamond",
        "Rescue": "triangle",
        "Welfare": "square",
        default: "circle"
    };

    // type → fill color
    const typeFill = {
        "Storm": "#22C55E",
        "Flood Misc": "#1C7ED6",
        "Flood": "#ffa200ff",
        "FR": "#000000",
        "Rescue": "#EF4444",
        default: "#9CA3AF"
    };

    // Priority → stroke color
    const priorityStroke = {
        "Priority": "#FFA500",  // goldy yellow
        "Immediate": "#4F92FF",  // blue
        "Rescue": "#FF0000",  // red
        "General": "#000000"   // black
    };

    // Flood Rescue categories → stroke color (overrides priority if job is Flood Rescue)
    const floodCatStroke = {
        "Category1": "#7F1D1D", // Critical assistance
        "Category2": "#DC2626", // Imminent threat
        "Category3": "#EA580C", // Trapped - rising
        "Category4": "#EAB308", // Trapped - stable
        "Category5": "#16A34A", // Animal
        "Red": "#DC2626",
        "Orange": "#EA580C"
    };

    function floodRescueCategoryKey(job) {
        // pick first matching known category if present
        const cat = job.categoriesName();
        if (floodCatStroke[cat]) return cat;
        return null;
    }

    // --- SVG factory (shape+style → L.divIcon) ---
    self.makeShapeIcon = function ({ shape, fill, stroke, radius = 7, strokeWidth = 2 }) {
        const d = radius * 2;
        const cx = radius, cy = radius;

        let inner = "";
        switch (shape) {
            case "circle":
                inner = `<circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
                break;
            case "square": {
                const s = d - strokeWidth;
                const o = strokeWidth / 2;
                inner = `<rect x="${o}" y="${o}" width="${s}" height="${s}"
                  rx="2" ry="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
                break;
            }
            case "diamond": {
                const r = radius - strokeWidth / 2;
                inner = `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
                break;
            }
            case "triangle": {
                const r = radius - strokeWidth / 2;
                const h = r * Math.sqrt(3);
                const p1 = `${cx},${cy - r}`;
                const p2 = `${cx - h / 2},${cy + r / 2}`;
                const p3 = `${cx + h / 2},${cy + r / 2}`;
                inner = `<polygon points="${p1} ${p2} ${p3}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
                break;
            }
            case "hex": {
                const r = radius - strokeWidth / 2;
                const pts = [];
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
                }
                inner = `<polygon points="${pts.join(" ")}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
                break;
            }
            default:
                inner = `<circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}"
                  fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">
      ${inner}
    </svg>`;

        return L.divIcon({
            className: "job-svg-marker",
            html: svg,
            iconSize: [d, d],
            iconAnchor: [radius, radius],
            popupAnchor: [0, -radius]
        });
    };

    // groups per type for easy toggling
    self.jobMarkerGroups = new Map(); // typeName → {layerGroup, markers: Map<JobId, Marker>}
    function ensureGroup(typeName) {
        if (!self.jobMarkerGroups.has(typeName)) {
            const group = L.layerGroup().addTo(map);
            self.jobMarkerGroups.set(typeName, { layerGroup: group, markers: new Map() });
        }
        return self.jobMarkerGroups.get(typeName);
    }

    // Build icon style for a given job
    function styleForJob(job) {
        const type = job.typeName() || "default";
        const shape = typeShape[type] || typeShape.default;
        const fill = typeFill[type] || typeFill.default;

        // Stroke: Flood Rescue categories override priority
        let stroke;
        if (type === "FR") {
            const catKey = floodRescueCategoryKey(job);
            stroke = (catKey && floodCatStroke[catKey]) || "#0EA5E9";
        } else {
            const pr = job.priorityName();
            stroke = priorityStroke[pr] || "#4B5563";
        }

        // Emphasise Priority/Immediate with larger radius
        const radius = (/^(Priority|Immediate)$/i.test(job.priorityName())) ? 8.5 : 7;

        return { shape, fill, stroke, radius, strokeWidth: 2.25 };
        // tweak strokeWidth if you need stronger outlines
    }

    // Sync markers to jobs
    self.syncJobMarkers = function () {
        const allSeen = new Map();


        for (const [type, { markers }] of self.jobMarkerGroups.entries())
            allSeen.set(type, new Set(markers.keys()));

        for (const job of self.filteredJobs()) {
            const id = job.id();
            const lat = +job.address.latitude();
            const lng = +job.address.longitude();
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || id == null) continue;

            const type = job.typeName() || "default";
            const { layerGroup, markers } = ensureGroup(type);
            const seenSet = allSeen.get(type);
            if (seenSet) seenSet.delete(id);

            const style = styleForJob(job);

            const html = buildJobPopupKO();


            if (markers.has(id)) {
                const m = markers.get(id);
                m.setLatLng([lat, lng]);
                m.setIcon(self.makeShapeIcon(style));
                m.setPopupContent(html);
                job.marker = m;
                wireKoForPopup(m, job);
            } else {
                const marker = L.marker([lat, lng], {
                    icon: self.makeShapeIcon(style),
                    title: job.identifier()
                }).bindPopup(html, {
                    minWidth: 350,
                    maxWidth: 500
                });
                marker.addTo(layerGroup);
                markers.set(id, marker);
                job.marker = marker;
                wireKoForPopup(marker, job);
            }
        }

        // remove stale markers
        for (const [type, ids] of allSeen.entries()) {
            const { markers, layerGroup } = self.jobMarkerGroups.get(type);
            for (const id of ids) {
                const m = markers.get(id);
                if (m) {
                    layerGroup.removeLayer(m);
                    // clear job.marker
                    const job = self.jobsById.get(id);
                    if (job) job.marker = null;
                }
                markers.delete(id);
            }
        }
    };

    // automatically refresh markers when jobs change
    self.filteredJobs.subscribe(self.syncJobMarkers);

}


=======
    // Used by the popup dropdown; KSB friendly
    self.assignJobToPopup = function (teamVm) {
        const jobVm = self._popupJob;
        if (!teamVm || !jobVm) return;
        return self.assignJobToTeam(teamVm, jobVm);
    };

    //incident popup team filterings
    self.popupTeamFilter = ko.observable('');
    self.popupFilteredTeams = ko.pureComputed(() => {
        const term = (self.popupTeamFilter() || '').toLowerCase().trim();
        const list = self.filteredTeams(); // already exists
        if (!term) return list;
        return list.filter(tm => (tm.callsign() || '').toLowerCase().includes(term));
    });


    //fetch tasking if a team is added
    self.filteredTeams.subscribe((data) => {
        data.forEach(change => {
            if (change.status === 'added') {
                change.value.fetchTasking()
            }
        });
    }, null, "arrayChange");

    // fetch tasking if a job is added
    // self.filteredJobs.subscribe((data) => {
    //     data.forEach(change => {
    //        change.value.fetchTasking()
    //     });
    // }, null, "arrayChange");


    // automatically refresh markers when jobs change
    self.filteredJobsIgnoreSearch.subscribe((changes) => {
        changes.forEach(ch => {
            if (ch.status === 'added') {
                addOrUpdateJobMarker(ko, map, self, ch.value);
            } else if (ch.status === 'deleted') {
                removeJobMarker(self, ch.value);
            }
        });
    }, null, 'arrayChange');


    // Maintain markers only for currently filtered assets
    self.filteredTrackableAssets.subscribe((changes) => {
        changes.forEach(ch => {
            const a = ch.value;
            if (ch.status === 'added') {
                attachAssetMarker(ko, map, self, a);
            } else if (ch.status === 'deleted') {
                // keep the asset in registry, but remove map marker + subs
                detachAssetMarker(ko, map, self, a);
            }
        });
    }, null, "arrayChange");

}
>>>>>>> Stashed changes
window.addEventListener('resize', () => map.invalidateSize());


function fetchAllTeamData() {
    const hqsFilter = Array.from(teamLocationFilter.values()).map(f => ({ Id: f.id }));
    console.log("Fetching teams for HQS:", hqsFilter);

    var end = new Date();
    var start = new Date();
    start.setDate(end.getDate() - 30); // last 7 days
<<<<<<< Updated upstream

    BeaconClient.team.teamSearch(hqsFilter, apiHost, start, end, params.userId, token, function (teams) {
        teams.Results.forEach(function (t) {
            myViewModel.getOrCreateTeam(t);
        })
    }, function (val, total) {
        console.log("Progress: " + val + " / " + total)
    },
        [1, 2, 3, 4])
=======
    myViewModel.teamsLoading(true);
    BeaconClient.team.teamSearch(hqsFilter, apiHost, start, end, params.userId, token, function (teams) {
        // teams.Results.forEach(function (t) {
        //     myViewModel.getOrCreateTeam(t);
        // })
        console.log("Total teams fetched:", teams.Results.length);
        myViewModel._markInitialFetchDone();
        myViewModel.teamsLoading(false);

    }, function () {
        //console.log("Progress: " + val + " / " + total)
    },
        [1, 2, 3, 4],
        function (teams) { //per page
            teams.Results.forEach(function (t) {
                myViewModel.getOrCreateTeam(t);
            })
        }
    )
>>>>>>> Stashed changes
}

function fetchAllJobsData() {
    const hqsFilter = Array.from(incidentLocationFilter.values()).map(f => ({ Id: f.id }));
    console.log("Fetching jobs for HQS:", hqsFilter);

    var end = new Date();
    var start = new Date();
    start.setDate(end.getDate() - 30); // last 30 days
<<<<<<< Updated upstream

    BeaconClient.job.searchwithStatusFilter(hqsFilter, apiHost, start, end, params.userId, token, function (jobs) {
        jobs.Results.forEach(function (t) {
            myViewModel.getOrCreateJob(t);
        })
=======
    myViewModel.jobsLoading(true);
    BeaconClient.job.searchwithStatusFilter(hqsFilter, apiHost, start, end, params.userId, token, function (allJobs) {
        console.log("Total jobs fetched:", allJobs.Results.length);
        myViewModel._markInitialFetchDone();
        myViewModel.jobsLoading(false);
>>>>>>> Stashed changes
    }, function (val, total) {
        console.log("Progress: " + val + " / " + total)
    },
        6, //view model
<<<<<<< Updated upstream
        [2, 1, 4, 5]) //status filter
=======
        [2, 1, 4, 5], //status filter
        function (jobs) {
            jobs.Results.forEach(function (t) {
                myViewModel.getOrCreateJob(t);
            })
        }
    )
}

function fetchAllTrackableAssets() {
    if (!assetDataRefreshInterlock) {
        console.log("Fetching all trackable assets");
        BeaconClient.asset.filter('', apiHost, params.userId, token, function (assets) {
            assets.forEach(function (a) {
                myViewModel.getOrCreateAsset(a);
            })
            myViewModel._markInitialFetchDone();
            assetDataRefreshInterlock = false;
        }, function (err) {
            console.error("Error fetching trackable assets:", err);
            assetDataRefreshInterlock = false;
        }
        )
    }
>>>>>>> Stashed changes
}


document.addEventListener('DOMContentLoaded', function () {

    require(["knockout", "knockout-secure-binding"], function (komod, ksb) {
        ko = komod;

        // Show all options, more restricted setup than the Knockout regular binding.
        var options = {
            attribute: "data-bind",      // ignore legacy data-bind values
            globals: window,
            bindings: ko.bindingHandlers, // still use default binding handlers
            noVirtualElements: false
        };

        ko.bindingHandlers.trVisible = {
            update: function (element, valueAccessor) {
                const value = ko.unwrap(valueAccessor());
                element.style.display = value ? 'table-row' : 'none';
            }
        };


        const dragStore = new Map();
        const genId = () => (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

        ko.bindingHandlers.draggableRow = {
            init(el, valueAccessor) {
                const opts = valueAccessor() || {};
                const payload = { data: opts.data, kind: opts.kind || 'item' };

                el.setAttribute('draggable', 'true');

                el.addEventListener('dragstart', (ev) => {
                    // create a handle id and cache payload
                    const id = genId();
                    dragStore.set(id, payload);

                    // put only the id on the DnD channel
                    ev.dataTransfer.setData('text/x-ko-drag-id', id);
                    ev.dataTransfer.effectAllowed = 'copyMove';

                    ev.dataTransfer.setData('text/plain', JSON.stringify({ kind: payload.kind }));

                });

                // clean up when drag ends
                el.addEventListener('dragend', () => {
                    // allow GC; not strictly necessary but keeps map small
                    dragStore.forEach((_v, k) => dragStore.delete(k));
                });
            }
        };

        ko.bindingHandlers.droppableRow = {
            init(el, valueAccessor, allBindings, viewModel, ctx) {
                const opts = valueAccessor() || {};
                const team = opts.team ?? viewModel;

                // Resolve handler
                const onDrop =
                    (typeof opts.onDrop === 'function' && opts.onDrop) ||
                    (typeof ctx.$root?.assignJobToTeam === 'function' && ctx.$root.assignJobToTeam) ||
                    (typeof viewModel?.assignJobToTeam === 'function' && viewModel.assignJobToTeam);

                if (typeof onDrop !== 'function') {
                    console.warn('droppableRow: no onDrop handler found; define $root.assignJobToTeam or pass {onDrop: fn}.');
                }

                el.addEventListener('dragover', (ev) => {
                    ev.preventDefault();
                    ev.dataTransfer.dropEffect = 'copy';
                    el.classList.add('drag-over');
                });

                el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

                // capture ctx in closure for later use
                el.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    el.classList.remove('drag-over');

                    const id = ev.dataTransfer.getData('text/x-ko-drag-id');
                    const payload = id && dragStore.get(id);
                    if (!payload || payload.kind !== 'job') return;

                    const jobVm = payload.data;
                    const teamVm = team;

                    // Fill modal text
                    document.getElementById('confirmJobId').textContent = jobVm.id();
                    document.getElementById('confirmTeamCallsign').textContent = teamVm.callsign() || '(unknown)';

                    // Bootstrap modal
                    const modalEl = document.getElementById('confirmTaskingModal');
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();

                    // Reset and rebind "Yes" button
                    const oldBtn = document.getElementById('confirmTaskingYes');
                    oldBtn.replaceWith(oldBtn.cloneNode(true));
                    const yesBtn = document.getElementById('confirmTaskingYes');

                    yesBtn.addEventListener('click', () => {
                        modal.hide();
                        if (typeof onDrop === 'function') {
                            onDrop.call(ctx.$root, teamVm, jobVm, { event: ev, context: ctx });
                        }
                    });
                });
            }
        };

<<<<<<< Updated upstream



=======
>>>>>>> Stashed changes
        ko.bindingProvider.instance = new ksb(options);
        window.ko = ko;
        ko.options.deferUpdates = true;
        myViewModel = new VM();

<<<<<<< Updated upstream

        ko.applyBindings(myViewModel);
    })

    //get tokens
    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(apiHost, params.source, function ({ token: rToken, exp }) {
        console.log("Fetched Beacon token," + rToken);
        token = rToken;
        tokenExp = exp;
        myViewModel.tokenLoading(false)
    })


=======
        ko.applyBindings(myViewModel);
    })


    //get tokens
    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(apiHost, params.source, function ({ token: rToken, tokenexp: rExp }) {
        console.log("Fetched Beacon token," + rToken);
        token = rToken;
        tokenExp = rExp;
        myViewModel.tokenLoading(false);
    })



>>>>>>> Stashed changes
    // Config Modal Stuff

    const modal = new bootstrap.Modal($('#configModal')[0]);
    modal.show();

    const $search = $('#locationSearch');
    const $clear = $('#clearSearch');
    const $status = $('#statusLine');
    const $results = $('#resultsList');
    const $save = $('#saveConfig');

    const $teamFilterList = $('#teamFilterList');
    const $incidentFilterList = $('#incidentFilterList');
    const $clearTeams = $('#clearTeams');
    const $clearIncidents = $('#clearIncidents');

    let searchTimer = null;
    let abortCtrl = null;

    function setStatus(msg) { $status.text(msg); }

    function norm(item) {
        return {
            id: item?.id ?? item?.code ?? item?.value ?? String(item),
            name: item?.name ?? item?.label ?? item?.fullName ?? String(item)
        };
    }

    function renderResults(items) {
        $results.empty();
        if (!items.length) {
            $results.append('<div class="list-group-item text-muted">No results.</div>');
            return;
        }
        items.forEach(raw => {
            const item = norm(raw);
            const $row = $(`
        <div class="list-group-item result-item">
          <div class="text-truncate" title="${item.name}">${item.name}</div>
          <div class="result-actions">
            <button class="btn btn-vsmall btn-outline-primary" data-action="add-team">Filter Teams</button>
            <button class="btn btn-vsmall btn-outline-success" data-action="add-incident">Filter Incidents</button>
          </div>
        </div>
      `);
            // attach item data
            $row.data('payload', item);
            $results.append($row);
        });
    }

    function pillHtml(item, type) {
        // type: 'team' | 'incident'
        return $(`
      <span class="badge text-bg-${type === 'team' ? 'primary' : 'success'} pill" data-id="${item.id}">
        ${item.name}
        <button type="button" class="btn-close btn-close-white ms-1" aria-label="Remove"></button>
      </span>
    `).data('payload', item);
    }

    function renderFilters() {
        $teamFilterList.empty();
        $incidentFilterList.empty();

        if (teamLocationFilter.size === 0) $teamFilterList.append('<span class="text-muted small">None</span>');
        if (incidentLocationFilter.size === 0) $incidentFilterList.append('<span class="text-muted small">None</span>');

        for (const item of teamLocationFilter.values()) {
            $teamFilterList.append(pillHtml(item, 'team'));
        }
        for (const item of incidentLocationFilter.values()) {
            $incidentFilterList.append(pillHtml(item, 'incident'));
        }
    }

    function addTeam(item) {
        if (!teamLocationFilter.has(item.id)) teamLocationFilter.set(item.id, item);
        renderFilters();
    }
    function addIncident(item) {
        if (!incidentLocationFilter.has(item.id)) incidentLocationFilter.set(item.id, item);
        renderFilters();
    }

    function searchAPI(query) {
        if (!query.trim()) {
            setStatus('Type to search.');
            renderResults([]);
            return;
        }

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();
        setStatus('Searching…');
        BeaconClient.entities.search(query, apiHost, params.userId, token, function (data) {
            renderResults(data.Results.map(e => ({ id: e.Id, name: e.Name })));
            setStatus(`${data.Results.length} result${data.Results.length === 1 ? '' : 's'}.`);
            abortCtrl = null;
        })
    }

    // Search input with debounce
    $search.on('input', function () {
        clearTimeout(searchTimer);
        const q = this.value;
        searchTimer = setTimeout(() => searchAPI(q), 300);
    });

    $clear.on('click', function () {
        $search.val('');
        renderResults([]);
        setStatus('Cleared.');
        $search.trigger('focus');
    });

    // Clicks on results (event delegation)
    $results.on('click', 'button[data-action]', function () {
        const $row = $(this).closest('.list-group-item');
        const item = $row.data('payload');
        const action = $(this).data('action');
        if (action === 'add-team') addTeam(item);
        else if (action === 'add-incident') addIncident(item);
    });

    // Remove pills
    $teamFilterList.on('click', '.pill .btn-close', function () {
        const id = $(this).closest('.pill').data('id');
        teamLocationFilter.delete(id);
        renderFilters();
    });
    $incidentFilterList.on('click', '.pill .btn-close', function () {
        const id = $(this).closest('.pill').data('id');
        incidentLocationFilter.delete(id);
        renderFilters();
    });

    // Clear buttons
    $clearTeams.on('click', function () { teamLocationFilter.clear(); renderFilters(); });
    $clearIncidents.on('click', function () { incidentLocationFilter.clear(); renderFilters(); });

    // Save
    $save.on('click', function () {
        const cfg = {
            refreshInterval: Number($('#refreshInterval').val()),
            theme: $('#themeSelect').val(),
            showAdvanced: $('#showAdvanced').is(':checked'),
            defaultHQ: $('#defaultHQ').val().trim(),
            filters: {
                teams: Array.from(teamLocationFilter.values()),
                incidents: Array.from(incidentLocationFilter.values())
            }
        };
        console.log('Save config:', cfg);
        localStorage.setItem('taskingFilters', JSON.stringify(cfg.filters));
        modal.hide();
        fetchAllTeamData();
        fetchAllJobsData();
<<<<<<< Updated upstream
=======
        fetchAllTrackableAssets();
>>>>>>> Stashed changes
    });

    function loadFiltersFromLocalStorage() {
        const savedFilters = localStorage.getItem('taskingFilters');
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);
            teamLocationFilter.clear();
            incidentLocationFilter.clear();

            filters.teams.forEach(item => teamLocationFilter.set(item.id, item));
            filters.incidents.forEach(item => incidentLocationFilter.set(item.id, item));

            renderFilters();
        }
    }

    // Call loadFiltersFromLocalStorage on page load
    loadFiltersFromLocalStorage();

    // initial render
    renderFilters();


})

<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
function getSearchParameters() {
    var prmstr = window.location.search.substr(1);
    return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = decodeURIComponent(tmparr[1]);
    }
    return params;
}

<<<<<<< Updated upstream
function wireKoForPopup(marker, job, origin) {
    // guard against duplicate wiring
    if (marker._koWired) return;
    marker.on('popupopen', e => {
        const el = e.popup.getElement();
        if (el && !el.__ko_bound__) {
            ko.applyBindings({ job, origin }, el);
            el.__ko_bound__ = true;
            job.onPopupOpen && job.onPopupOpen();
        }
    });
    marker.on('popupclose', e => {
        const el = e.popup.getElement();
        if (el && el.__ko_bound__) {
            ko.cleanNode(el);
            delete el.__ko_bound__;
            job.onPopupClose && job.onPopupClose();
        }
    });
    marker._koWired = true;
=======
function fmtRelative(dateObj) {
    const now = Date.now();
    const t = dateObj.getTime();
    if (isNaN(t)) return "";
    const s = Math.max(0, Math.floor((now - t) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "yesterday";
    if (d < 7) return `${d}d ago`;
    const w = Math.floor(d / 7);
    return `${w}w ago`;
>>>>>>> Stashed changes
}