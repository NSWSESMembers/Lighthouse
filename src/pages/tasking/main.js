/* eslint-disable @typescript-eslint/no-this-alias */
global.jQuery = $;

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

require('../lib/shared_chrome_code.js'); // side-effect


import { showAlert } from './components/windowAlert.js';

import { ResizeDividers } from './resize.js';
import { addOrUpdateJobMarker, removeJobMarker } from './markers/jobMarker.js';
import { attachAssetMarker, detachAssetMarker } from './markers/assetMarker.js';
import { attachUnmatchedAssetMarker, detachUnmatchedAssetMarker } from './markers/assetMarker.js';

import { MapVM } from './viewmodels/Map.js';

import { JobTimeline } from "./viewmodels/JobTimeline.js";

import { CreateOpsLogModalVM } from "./viewmodels/OpsLogModalVM.js";
import { CreateRadioLogModalVM } from "./viewmodels/RadioLogModalVM.js";
import { SendSMSModalVM } from "./viewmodels/SMSTeamModalVM.js";
import { JobStatusConfirmModalVM } from "./viewmodels/JobStatusConfirmModalVM.js";
import { TrackableAssetsModalVM } from "./viewmodels/TrackableAssetsModalVM.js";
import IncidentImagesModalVM from "./viewmodels/IncidentImagesModalVM";

import { installAlerts } from './components/alerts.js';
import { LegendControl } from './components/legend.js';
import { SpotlightSearchVM } from "./components/spotlightSearch.js";


import { Asset } from './models/Asset.js';
import { Tasking } from './models/Tasking.js';
import { Team } from './models/Team.js';
import { Job } from './models/Job.js';
import { Sector } from './models/Sector.js';
import { Tag } from "./models/Tag.js";

import { Enum } from './utils/enum.js';

import { ConfigVM } from './viewmodels/Config.js';

import { installSlideVisibleBinding } from "./bindings/slideVisible.js";
import { installStatusFilterBindings } from "./bindings/statusFilters.js";
import { installRowVisibilityBindings } from "./bindings/rowVisibility.js";
import { installDragDropRowBindings } from "./bindings/dragDropRows.js";
import { installSortableArrayBindings } from "./bindings/sortableArray.js";
import { noBubbleFromDisabledButtonsBindings } from "./bindings/noBubble.js"

import { registerTransportCamerasLayer } from "./mapLayers/transport.js";
import { registerUnitBoundaryLayer } from "./mapLayers/geoservices.js";
import { registerSESZonesGridLayer } from "./mapLayers/geoservices.js";
import { registerSESUnitsZonesHybridGridLayer } from "./mapLayers/geoservices.js";
import { registerSESUnitLocationsLayer } from "./mapLayers/geoservices.js";
import { registerTransportIncidentsLayer } from "./mapLayers/transport.js";
import { renderFRAOSLayer } from "./mapLayers/frao.js";
import { registerHazardWatchWarningsLayer } from "./mapLayers/hazardwatch.js"

import { fetchHqDetailsSummary } from './utils/hqSummary.js';

import { installModalHotkeys } from './components/modalHotKeys.js';
import { installMapContextMenu } from "./components/mapContextMenu.js";


import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.


var $ = require('jquery');

var L = require('leaflet');
require('leaflet.vectorgrid');

var esri = require('esri-leaflet');

var MiniMap = require('leaflet-minimap');

var esriVector = require('esri-leaflet-vector');

import { GeoSearchControl } from 'leaflet-geosearch';
import { AwsLambdaGeocoderProvider } from './utils/geocode.js';



require('leaflet-easybutton');
require('leaflet-routing-machine');
require('leaflet-svg-shape-markers');



import 'leaflet.polylinemeasure';

//css order reasons... load this last
import '../../../styles/pages/tasking.css';


let token = '';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let tokenExp = '';

let resolveTokenReady;
const tokenReady = new Promise((resolve) => {
    resolveTokenReady = resolve;
});



const defaultSvgIcon = L.divIcon({
    className: "default-svg-marker",
    html: `
    <svg width="26" height="42" viewBox="0 0 26 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 29 13 29s13-19.3 13-29C26 5.8 20.2 0 13 0z"
            fill="#2A81CB"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>
  `,
    iconSize: [26, 42],
    iconAnchor: [13, 42],
    popupAnchor: [0, -36],
});

const defaultRedSvgIcon = L.divIcon({
    className: "default-svg-marker",
    html: `
    <svg width="26" height="42" viewBox="0 0 26 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 29 13 29s13-19.3 13-29C26 5.8 20.2 0 13 0z"
            fill="#cb2a2aff"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>
  `,
    iconSize: [26, 42],
    iconAnchor: [13, 42],
    popupAnchor: [0, -36],
});

/**
 * Set the current token and wake any waiters.
 */
function setToken(newToken, newTokenExp) {
    token = newToken;
    tokenExp = newTokenExp;

    if (resolveTokenReady) {
        // First token arrival unblocks anyone awaiting getToken()
        resolveTokenReady(token);
        // Optional: keep future awaiters instant if they call before refresh:
        resolveTokenReady = null;
    }
}

/**
 * Async getter that only resolves once a token exists.
 */
async function getToken() {
    if (token) return token;     // already have one → return immediately
    return tokenReady;           // wait for first setToken() call
}


const params = getSearchParameters();
const apiHost = params.host

var ko;
var myViewModel;


if (params.source === "https://trainbeacon.ses.nsw.gov.au") {
    document.body.classList.add("env-trainbeacon");
}

if (params.source === "https://devbeacon.ses.nsw.gov.au") {
    document.body.classList.add("env-devbeacon");
}

/////////DATA REFRESH CODE   

// --- Leaflet map with Esri basemap
const map = L.map('map', {
    zoomControl: true, // 1 / 10th of the original zoom step
    zoomSnap: .5,
    // Faster debounce time while zooming
    wheelDebounceTime: 50
}).setView([-33.8688, 151.2093], 11);


installMapContextMenu({
    map,
    geocodeEndpoint: 'https://lambda.lighthouse-extension.com/lad/geocode',
    geocodeMarkerIcon: defaultSvgIcon,
    geocodeRedMarkerIcon: defaultRedSvgIcon,
    geocodeMaxResults: 10,
    onGeocodeResultClicked: (r) => {
        // TODO: replace with real action
        console.log("TODO: handle reverse-geocode pick", r);
    },
});


const polylineMeasure = L.control.polylineMeasure({
    position: 'topleft',
    measureControlLabel: '<i class="fas fa-ruler"></i>', // FontAwesome ruler icon
    unit: 'kilometres',
    showBearings: true,
    clearMeasurementsOnStop: false,
    showClearControl: true,
    showUnitControl: false,

    // Styling
    lineColor: '#db4a29',
    lineWeight: 3,
    lineOpacity: 0.8,
    tempLine: {
        color: '#db4a29',
        weight: 2
    }
});

polylineMeasure.addTo(map);

const geocoder = new AwsLambdaGeocoderProvider({
    endpoint: 'https://lambda.lighthouse-extension.com/lad/geocode',
});

const searchControl = new GeoSearchControl({
    provider: geocoder,
    style: 'button',          // looks like a button that expands
    position: 'topleft',
    autoClose: false,
    retainZoomLevel: false,
    searchLabel: 'Search address…',
    marker: {
        // optional: L.Marker    - default L.Icon.Default
        icon: defaultSvgIcon,
        draggable: false,
    },
    showMarker: true,
    showPopup: true,
    animateZoom: true,
    keepResult: true,
    updateMap: true,
    autoComplete: true,
    autoCompleteDelay: 250,
});

map.addControl(searchControl);

// Leaflet-Geosearch renders a container with class "leaflet-geosearch"
const gsEl = document.querySelector(".leaflet-control-geosearch");
if (gsEl) {
    L.DomEvent.disableScrollPropagation(gsEl);
    L.DomEvent.disableClickPropagation(gsEl);
    L.DomEvent.on(gsEl, "wheel", L.DomEvent.stopPropagation);
    // optional: stop trackpad pinch-zoom triggering map zoom
    L.DomEvent.on(gsEl, "mousewheel", L.DomEvent.stopPropagation);
}



map.createPane('pane-lowest'); map.getPane('pane-lowest').style.zIndex = 300;
map.createPane('pane-lowest-plus'); map.getPane('pane-lowest-plus').style.zIndex = 301;

map.createPane('pane-middle'); map.getPane('pane-middle').style.zIndex = 400;
map.createPane('pane-middle-plus'); map.getPane('pane-middle-plus').style.zIndex = 401;


map.createPane('pane-top'); map.getPane('pane-top').style.zIndex = 600;
map.createPane('pane-top-plus'); map.getPane('pane-top-plus').style.zIndex = 601;


map.createPane('pane-tippy-top'); map.getPane('pane-tippy-top').style.zIndex = 700;
map.createPane('pane-tippy-top-plus'); map.getPane('pane-tippy-top-plus').style.zIndex = 701;


var osm2 = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 0, maxZoom: 13 });
new MiniMap(osm2, { toggleDisplay: true }).addTo(map);

const legend = new LegendControl({ collapsed: false, persist: true });
legend.addTo(map);

ResizeDividers(map)

// Esri default basemap (others: 'Streets','Imagery','Topographic','Gray','DarkGray', etc.)
esri.basemapLayer('Topographic', { ignoreDeprecationWarning: true }).addTo(map);

function VM() {
    const self = this;


    self.mapVM = new MapVM(map, self);

    self.tokenLoading = ko.observable(true);
    self.teamsLoading = ko.observable(true);
    self.jobsLoading = ko.observable(true);
    self.tagsLoading = ko.observable(true);

    self.pageIsLoading = ko.pureComputed(() => {
        return self.tokenLoading() || self.tagsLoading();
    });

    // Registries
    self.teamsById = new Map();
    self.jobsById = new Map();
    self.taskingsById = new Map();
    self.assetsById = new Map();
    self.sectorsById = new Map();

    // Global collections
    self.teams = ko.observableArray();
    self.jobs = ko.observableArray();
    self.taskings = ko.observableArray();
    self.trackableAssets = ko.observableArray([]);
    self.sectors = ko.observableArray([]);

    self.allTags = ko.observableArray([]);

    ///opslog short cuts
    self.CreateOpsLogModalVM = new CreateOpsLogModalVM(self);
    self.CreateRadioLogModalVM = new CreateRadioLogModalVM(self);
    self.SendSMSModalVM = new SendSMSModalVM(self);
    self.selectedJob = ko.observable(null);

    self.trackableAssetsModalVM = new TrackableAssetsModalVM(self);

    self.jobStatusConfirmVM = new JobStatusConfirmModalVM(self);

    self.incidentImagesVM = new IncidentImagesModalVM({
        getToken,
        apiHost,
        userId: params.userId,
        BeaconClient
    });


    self.openIncidentImages = function (job, e) {
        if (e) { e.stopPropagation?.(); e.preventDefault?.(); }
        if (!job || typeof job.id !== "function") return false;
        self.incidentImagesVM.openForJob(job);
        return false;
    };

    self.attachJobStatusConfirmModal = function (job, newStatus) {
        const modalEl = document.getElementById("JobStatusConfirmModal");
        const modal = new bootstrap.Modal(modalEl);

        const vm = self.jobStatusConfirmVM;
        vm.modalInstance = modal;

        vm.open(job, newStatus);
        modal.show();

        installModalHotkeys({
            modalEl,
            onSave: () => vm.submit?.(),
            onClose: () => modal.hide(),
            allowInInputs: true
        });
    };
    self.jobTimelineVM = new JobTimeline(self);

    // --- TABLE SORTING MAGIC ---
    self.teamSortKey = ko.observable('callsign');
    self.teamSortAsc = ko.observable(true);
    self.jobSortKey = ko.observable('identifier');
    self.jobSortAsc = ko.observable(false);

    // --- pinning ---
    self.showPinnedTeamsOnly = ko.observable(false);
    self.showPinnedIncidentsOnly = ko.observable(false);

    self.togglePinnedTeamsOnly = () => { self.showPinnedTeamsOnly(!self.showPinnedTeamsOnly()); return true; };
    self.togglePinnedIncidentsOnly = () => { self.showPinnedIncidentsOnly(!self.showPinnedIncidentsOnly()); return true; };

    const normPinId = (v) => (v == null ? '' : String(v));

    self.isTeamPinned = (teamId) => {
        const arr = (self.config && self.config.pinnedTeamIds) ? self.config.pinnedTeamIds() : [];
        return arr.includes(normPinId(teamId));
    };

    self.isIncidentPinned = (jobId) => {
        const arr = (self.config && self.config.pinnedIncidentIds) ? self.config.pinnedIncidentIds() : [];
        return arr.includes(normPinId(jobId));
    };

    self.countPinnedTeams = ko.pureComputed(() => {
        if (!self.config || !self.config.pinnedTeamIds) return 0;
        return self.filteredTeams().filter(t => self.isTeamPinned(t.id())).length;
    })

    self.countPinnedIncidents = ko.pureComputed(() => {
        if (!self.config || !self.config.pinnedIncidentIds) return 0;
        return self.filteredJobs().filter(j => self.isIncidentPinned(j.id())).length;
    })

    self.toggleTeamPinned = (teamId) => {
        if (!self.config || !self.config.pinnedTeamIds) return false;
        const id = normPinId(teamId);
        const arr = self.config.pinnedTeamIds();
        if (arr.includes(id)) self.config.pinnedTeamIds.remove(id);
        else self.config.pinnedTeamIds.push(id);
        self.config.save?.();
        if (self.countPinnedTeams() === 0) {
            self.showPinnedTeamsOnly(false);
        }
        return true;
    };

    self.toggleIncidentPinned = (jobId) => {
        if (!self.config || !self.config.pinnedIncidentIds) return false;
        const id = normPinId(jobId);
        const arr = self.config.pinnedIncidentIds();
        if (arr.includes(id)) self.config.pinnedIncidentIds.remove(id);
        else self.config.pinnedIncidentIds.push(id);
        self.config.save?.();
        if (self.countPinnedIncidents() === 0) {
            self.showPinnedIncidentsOnly(false);
        }
        return true;
    };

    // --- sorted arrays ---
    let teamLastKey, teamLastAsc, teamLastInput, teamLastOutput;

    self.sortedTeams = ko.pureComputed(function () { //heavy caching to reduce the slice/sort load
        const key = self.teamSortKey();
        const asc = self.teamSortAsc();
        const input = self.filteredTeams();

        if (input === teamLastInput && key === teamLastKey && asc === teamLastAsc) {
            return teamLastOutput;
        }

        teamLastInput = input;
        teamLastKey = key;
        teamLastAsc = asc;
        teamLastOutput = input.slice().sort(function (a, b) {
            // Support nested keys like "entityAssignedTo.code"
            var av = key.includes('.')
                ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), a)
                : ko.unwrap(a[key]);

            var bv = key.includes('.')
                ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), b)
                : ko.unwrap(b[key]);

            var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
            var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
            var cmp = (an && bn) ? (Number(av) - Number(bv))
                : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
            return asc ? cmp : -cmp;
        });
        return teamLastOutput;
    }).extend({ rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });

    const JOB_STATUS_ORDER = [
        'New',
        'Active',
        'Tasked',
        'Referred',
        'Complete',
        'Cancelled',
        'Rejected',
        'Finalised'
    ];

    const JOB_STATUS_RANK = JOB_STATUS_ORDER.reduce((m, s, i) => {
        m[s] = i;
        return m;
    }, Object.create(null));

    let jobLastKey, jobLastAsc, jobLastInput, jobLastOutput;

    self.sortedJobs = ko.pureComputed(function () {
        const key = self.jobSortKey()
        const asc = self.jobSortAsc();
        const input = self.filteredJobs();

        if (input === jobLastInput && key === jobLastKey && asc === jobLastAsc) {
            return jobLastOutput;
        }

        jobLastInput = input;
        jobLastKey = key;
        jobLastAsc = asc;

        jobLastOutput = input.slice().sort(function (a, b) {
            // Support nested keys like "entityAssignedTo.code"
            var av = key.includes('.')
                ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), a)
                : ko.unwrap(a[key]);

            var bv = key.includes('.')
                ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), b)
                : ko.unwrap(b[key]);

            // --- custom status order ---
            if (key === 'statusName') {
                var ar = JOB_STATUS_RANK[av] ?? Number.MAX_SAFE_INTEGER;
                var br = JOB_STATUS_RANK[bv] ?? Number.MAX_SAFE_INTEGER;
                return asc ? (ar - br) : (br - ar);
            }

            // --- default behaviour ---
            var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
            var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
            var cmp = (an && bn)
                ? (Number(av) - Number(bv))
                : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });

            return asc ? cmp : -cmp;
        });
        return jobLastOutput;
    });

    // --- UI updater shared helper ---
    function updateSortHeaderUI(th, asc) {
        var thead = th.parentNode.parentNode; // <tr> -> <thead>
        // reset siblings
        Array.prototype.forEach.call(thead.querySelectorAll('th.sortable'), function (h) {
            h.setAttribute('aria-sort', 'none');
            var i = h.querySelector('.sort-icon');
            if (i) { i.classList.remove('fa-sort-up', 'fa-sort-down'); i.classList.add('fa-sort'); }
        });
        // set selected
        th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.classList.remove('fa-sort');
            icon.classList.toggle('fa-sort-up', asc);
            icon.classList.toggle('fa-sort-down', !asc);
        }
    }

    // --- KSB-safe click handlers using data-sort-key ---
    self.setTeamSortFromElement = function (_, e) {
        var th = e.currentTarget;
        var key = th.getAttribute('data-sort-key');
        if (!key) return;
        if (self.teamSortKey() === key) self.teamSortAsc(!self.teamSortAsc());
        else { self.teamSortKey(key); self.teamSortAsc(true); }
        updateSortHeaderUI(th, self.teamSortAsc());
    };

    self.setJobSortFromElement = function (_, e) {
        var th = e.currentTarget;
        var key = th.getAttribute('data-sort-key');
        if (!key) return;

        if (self.jobSortKey() === key) self.jobSortAsc(!self.jobSortAsc());
        else { self.jobSortKey(key); self.jobSortAsc(true); }

        updateSortHeaderUI(th, self.jobSortAsc());
    };

    // initialize default icons on first render ---
    ko.tasks.schedule(function () {
        var thTeams = document.querySelector('.teams thead th.sortable[data-sort-key="' + self.teamSortKey() + '"]');
        if (thTeams) updateSortHeaderUI(thTeams, self.teamSortAsc());
        var thJobs = document.querySelector('.jobs thead th.sortable[data-sort-key="' + self.jobSortKey() + '"]');
        if (thJobs) updateSortHeaderUI(thJobs, self.jobSortAsc());
    });

    // --- END TABLE SORTING MAGIC ---

    //Job filtering/searching
    self.jobSearch = ko.observable('');

    self.filteredJobsAgainstConfig = ko.pureComputed(() => {

        const hqsFilter = self.config.incidentFilters().map(f => ({ Id: f.id }));
        const sectorFilter = self.config.sectorFilters().map(s => s.id);

        // If sector filtering is active, only include jobs in those sectors


        const term = self.jobSearch().toLowerCase();

        const allowedStatus = self.config.jobStatusFilter(); // allow-list
        const incidentTypeAllowedById = self.config.allowedIncidentTypeIds(); // allow-list

        var start = new Date();
        var end = new Date();

        start.setDate(end.getDate() - self.config.fetchPeriod());

        // Add 5 minutes to the start time just to account for drift
        start.setMinutes(start.getMinutes() + 5);

        end.setDate(end.getDate() + self.config.fetchForward());




        return ko.utils.arrayFilter(this.jobs(), jb => {
            const statusName = jb.statusName();


            const hqMatch = hqsFilter.length === 0 || hqsFilter.some(f => f.Id === jb.entityAssignedTo.id());
            const sectorMatch = sectorFilter.length === 0 || (jb.sector() && sectorFilter.includes(jb.sector().id()));
            //must match sector filter

            //if no sector and config says to exclude, filter out
            if (!jb.sector().id() && self.config.includeIncidentsWithoutSector() === false) {
                return false;
            }

            if (jb.sector().id() && !sectorMatch) return false;

            // If allow-list non-empty, only show jobs whose status is in it
            if (allowedStatus.length > 0 && !allowedStatus.includes(statusName)) {
                return false;
            }

            // If incident type filter non-empty, only show jobs whose type is in it
            if (incidentTypeAllowedById.length > 0 && !incidentTypeAllowedById.includes(jb.typeId())) {
                return false;
            }

            //date matching
            const jobDate = new Date(jb.jobReceived());

            if (jobDate < start || jobDate > end) {
                return false;
            }

            //must match HQ filter
            if (!hqMatch) return false;

            // Apply text search
            return (!term ||
                jb.identifier().toLowerCase().includes(term) ||
                jb.id().toString().toLowerCase().includes(term) ||
                jb.address.prettyAddress().toLowerCase().includes(term));
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

    self.filteredJobs = ko.pureComputed(() => {

        const pinnedOnlyIncidents = self.showPinnedIncidentsOnly();
        const pinnedIncidentIds = (self.config && self.config.pinnedIncidentIds) ? self.config.pinnedIncidentIds() : [];

        return ko.utils.arrayFilter(this.filteredJobsAgainstConfig(), jb => {

            // pinned-only filter
            if (pinnedOnlyIncidents && !pinnedIncidentIds.includes(String(jb.id()))) {
                return false;
            }
            return true;
        })

    }).extend({ trackArrayChanges: true, rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });

    // Team filtering/searching
    self.teamSearch = ko.observable('');


    //just filtered against config not against UI searching
    self.filteredTeamsAgainstConfig = ko.pureComputed(() => {

        const allowed = self.config.teamStatusFilter(); // allow-list

        var start = new Date();
        var end = new Date();

        start.setDate(end.getDate() - self.config.fetchPeriod());

        // Add 5 minutes to the start time just to account for drift
        start.setMinutes(start.getMinutes() + 5);

        end.setDate(end.getDate() + self.config.fetchForward());



        return ko.utils.arrayFilter(self.teams(), tm => {
            const status = tm.teamStatusType()?.Name;


            const hqMatch = self.config.teamFilters().length === 0 || self.config.teamFilters().some((f) => f.id == tm.assignedTo().id());
            if (status == null) {
                return false;
            }

            // If allow-list non-empty, only show teams whose status is in it
            if (allowed.length > 0 && !allowed.includes(status)) {
                return false;
            }

            //must match HQ filter
            if (!hqMatch) {
                return false;
            }

            const statusDate = tm.statusDate();
            if (statusDate < start || statusDate > end) {
                return false;
            }

            return true;
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

    self.filteredTeams = ko.pureComputed(() => {
        const pinnedOnlyTeams = self.showPinnedTeamsOnly();
        const pinnedTeamIds = (self.config && self.config.pinnedTeamIds) ? self.config.pinnedTeamIds() : [];

        return ko.utils.arrayFilter(self.filteredTeamsAgainstConfig(), tm => {

            // pinned-only filter
            if (pinnedOnlyTeams && !pinnedTeamIds.includes(String(tm.id()))) {
                return false;
            }

            const term = self.teamSearch().toLowerCase();
            if (tm.callsign().toLowerCase().includes(term)) {
                return true;
            }

        })


    }).extend({ trackArrayChanges: true, rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });


    self.filteredTrackableAssets = ko.pureComputed(() => {

        // No assets? Return nothing
        if (!self.trackableAssets) return [];
        // for each filtered team, get their trackable assets and flatten to single array
        return self.filteredTeams().flatMap(t => t.trackableAssets() || []);

    }).extend({ trackArrayChanges: true, rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });


    self.unmatchedTrackableAssets = ko.pureComputed(() => {
        const all = self.trackableAssets?.() || [];
        return all.filter(a => {
            const mt = (typeof a.matchingTeams === 'function') ? a.matchingTeams() : [];
            return !mt || mt.length === 0;
        });
    }).extend({ trackArrayChanges: true, rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });

    self.sectorsLoading = ko.observable(false);

    // --- Fetch sectors for current filters
    self.fetchAllSectors = async function (hqs) {
        console.log("Fetching sectors for HQs:", hqs);
        self.sectorsLoading(true);
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.sectors.search(hqs, apiHost, params.userId, t, (res) => {
            (res?.Results || []).forEach(
                (sectorJson) => {
                    let sector = self.sectorsById.get(sectorJson.Id);
                    if (sector) {
                        sector.updateFromJson(sectorJson);
                    } else {
                        // new sector
                        sector = new Sector(sectorJson);
                        self.sectorsById.set(sector.id(), sector);
                        self.sectors.push(sector);
                    }
                }
            );
            self.sectorsLoading(false);
        }, (count, total) => {
            console.log(`Fetched ${count} / ${total} sectors...`);
        });
    }

    self.setSectorForJob = async function (job, sector) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.sectors.setSector(job, sector, apiHost, params.userId, t, (success) => {
            if (success) {
                showAlert('Incident assigned to sector successfully.', 'success', 3000);
                self.fetchJobById(job, null);
            } else {
                showAlert('Failed to assign incident to sector.', 'danger', 5000);
            }
        });
    }

    self.unSetSectorForJob = async function (job) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.sectors.unSetSector(job, apiHost, params.userId, t, (success) => {
            if (success) {
                showAlert('Incident removed from sector successfully.', 'success', 3000);
                self.fetchJobById(job, null);
            } else {
                showAlert('Failed to remove incident from sector.', 'danger', 5000);
            }
        });
    }

    function makeJobDeps() {
        return {
            makeJobLink: (id) => `${params.source}/Jobs/${id}`,

            fetchJobTasking: (jobId, cb) => {
                self.fetchJobTasking(jobId, cb);
            },

            fetchJobById: (jobId, cb) => {
                self.fetchJobById(jobId, cb);
            },

            flyToJob: (job) => {
                const lat = job.address.latitude?.();
                const lng = job.address.longitude?.();
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    map.flyTo([lat, lng], 16, { animate: true, duration: 0.10 });
                    job.marker?.openPopup?.();
                }
            },

            openRadioLogModal: (tasking) => {
                self.attachJobRadioLogModal(tasking);
            },

            openNewOpsLogModal: (job) => {
                self.attachNewOpsLogModal(job);
            },

            attachAndFillTimelineModal: (job) => {
                self.attachJobTimelineModal(job);
            },

            updateTeamStatus: (tasking, status, payload, cb) => {
                self.updateTeamStatus(tasking, status, payload, cb)
            },

            callOffTeam: (tasking, payload, cb) => {
                self.callOffTeam(tasking, payload, cb)
            },

            untaskTeam: (tasking, payload, cb) => {
                self.untaskTeam(tasking, payload, cb)
            },

            fetchUnacknowledgedJobNotifications: (job) => {
                self.fetchUnacknowledgedJobNotifications(job);
            },
            drawJobTargetRing: (job) => {
                self.drawJobTargetRing(job);
            },
            fetchUnresolvedActionsLog: (job) => {
                self.fetchUnresolvedActionsLog(job);
            },
            fetchSuppliersForJob: (jobId) => {
                return self.fetchSuppliersForJob(jobId);
            },
            openJobStatusConfirmModal: (job, newStatus) => {
                self.attachJobStatusConfirmModal(job, newStatus);
            },
            map: self.mapVM,
            filteredTeams: self.filteredTeams,
            isIncidentPinned: (id) => self.isIncidentPinned(id),
            toggleIncidentPinned: (id) => self.toggleIncidentPinned(id),
        }
    }
    // Team registry/upsert - called from tasking OR team fetch so values might be missing
    self.getOrCreateTeam = function (teamJson, source) {
        if (!teamJson || teamJson.Id == null) return null;

        let team = self.teamsById.get(teamJson.Id);
        if (team) { //existing team
            //if the team is from tasking, ignore as dont want to overwrite with old data
            if (source === 'tasking') {
                return team;
            }
            const prevCallsign = team.callsign?.();
            team.updateFromJson(teamJson);
            if (team.callsign?.() !== prevCallsign) { //only remap assets if the callsign changes
                self._refreshTeamTrackableAssets(team);
            }
            return team;
        }


        //new team
        const deps = {
            upsertTasking: (tj, opts) => self.upsertTaskingFromPayload(tj, opts),
            getTeamTasking: (teamId) =>
                new Promise((resolve, reject) => {
                    BeaconClient.team.getTasking(teamId, apiHost, params.userId, token, resolve, reject);
                }),
            makeTeamLink: (id) => `${params.source}/Teams/${id}/Edit`,
            flyToAsset: (asset) => {
                const lat = asset.latitude(), lng = asset.longitude();
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    map.flyTo([lat, lng], 14, { animate: true, duration: 0.10 });
                    asset.marker?.openPopup?.();
                }
            },

            fetchTeamById: (teamId) =>
                new Promise((resolve, reject) => {
                    self.fetchTeamById(teamId, resolve, reject); //can only resolve due to lazy code
                }),

            openRadioLogModal: (team) => {
                self.attachTeamRadioLogModal(team);
            },

            teamTaskStatusFilter: () => self.config.teamTaskStatusFilter(),

            openSMSTeamModal: (team, tasking) => {
                console.log("Opening SMS modal for team:", team, " tasking:", tasking);
                self.attachSendSMSModal([], team, tasking);
            },

            isTeamPinned: (id) => self.isTeamPinned(id),
            toggleTeamPinned: (id) => self.toggleTeamPinned(id),
            currentlyOpenMapPopup: self.mapVM?.openPopup,
        };

        team = new Team(teamJson, deps);
        self.teams.push(team);
        self.teamsById.set(team.id(), team);
        self._refreshTeamTrackableAssets(team);
        return team;
    };


    const configDeps = {
        entitiesSearch: (q) => new Promise((resolve) => {
            BeaconClient.entities.search(q, apiHost, params.userId, token, (data) => resolve(data.Results || []));
        }),
        entitiesChildren: (parentId) => new Promise((resolve) => {
            BeaconClient.entities.children(parentId, apiHost, params.userId, token, (data) => resolve(data || []));
        }),
        fetchAllSectors: (hqs) => self.fetchAllSectors(hqs),
    };

    self.config = new ConfigVM(self, configDeps);

    self.sectorSelectorClick = function (sectorVm, event) {
        // Find the KO context for the clicked element
        var ctx = ko.contextFor(event.currentTarget || event.target);
        if (!ctx) return;

        // Walk up until we find the context that has 'j' (the job VM)
        var jobCtx = ctx;
        while (jobCtx && !jobCtx.j) {
            jobCtx = jobCtx.$parentContext;
        }
        if (!jobCtx || !jobCtx.j) return;

        var job = jobCtx.j;

        // Now we have both job and sector VMs
        var jobId = job.id();
        var sectorId = sectorVm.id();

        if (job.sector().id() === sectorId) {
            // Sector is already assigned to job; unassign it
            self.unSetSectorForJob(jobId);
            console.log("Unassigning sector from job", jobId);
            return;
        }

        self.setSectorForJob(jobId, sectorId);

        console.log("Assigning sector", sectorId, "to job", jobId);

    };

    self.attachJobTimelineModal = function (job) {
        const modalEl = document.getElementById('jobTimelineModal');
        const modal = new bootstrap.Modal(modalEl);
        self.jobTimelineVM.openForJob(job);
        modal.show();
    }

    self.attachJobRadioLogModal = function (tasking) {
        const modalEl = document.getElementById('RadioLogModal');
        const modal = new bootstrap.Modal(modalEl);

        self.CreateRadioLogModalVM.modalInstance = modal;

        self.CreateRadioLogModalVM.openForTasking(tasking);
        modal.show();

        installModalHotkeys({
            modalEl,
            onSave: () => self.CreateRadioLogModalVM.submit?.(),
            onClose: () => modal.hide(),
            allowInInputs: true // text-heavy modal
        });

    };

    self.attachSendSMSModal = function (recipients, team = null, tasking = null, job = null) {
        var msgRecipients = [];
        var taskId = null;
        var headerLabel = "Send SMS";
        var initialText = "";

        // If team provided, use its members as recipients
        if (team) {
            msgRecipients = team.members().map(t => {
                console.log("Mapping team member for SMS:", t);
                return {
                    id: t.Person.Id,
                    name: t.Person.FirstName + ' ' + t.Person.LastName,
                    isTeamLeader: t.TeamLeader,
                }
            });
        } else {
            msgRecipients = recipients
        }

        // if a task was provided, use its job info to prefill
        if (tasking) {
            console.log("Opening SMS modal for tasking:", tasking);
            taskId = tasking.job.id();
            headerLabel = `Send SMS - Incident: ${tasking.job.identifier()}`;
            initialText = `Re: Inc ${tasking.job.identifier()} at ${tasking.job.address.prettyAddress()}: `;
        }

        // if a job was provided, use its info to prefill and assume its a new tasking
        if (job) {
            console.log("Opening SMS modal for job:", job);
            headerLabel = `Send SMS - Incident: ${job.identifier()}`;
            initialText = [
                job.priorityName(),
                job.typeShort() + job.categoriesNameNumberDash(),
                job.entityAssignedTo?.code(),
                job.identifier(),
                job.contactFirstName(),
                job.contactLastName(),
                job.address?.prettyAddress(),
                job.contactPhoneNumber(),
                job.tagsCsv(),
                job.situationOnScene()
            ]
                .filter(value => value) // Remove empty or undefined values
                .join(' ');
            initialText = initialText.toUpperCase();
        }

        const modalEl = document.getElementById('SendSMSModal');
        const modal = new bootstrap.Modal(modalEl);

        self.SendSMSModalVM.modalInstance = modal;

        self.SendSMSModalVM.openWithRecipients(msgRecipients, { taskId: taskId, headerLabel: headerLabel, initialText: initialText });
        modal.show();

        installModalHotkeys({
            modalEl,
            onSave: () => self.SendSMSModalVM.submit?.(),
            onClose: () => modal.hide(),
            allowInInputs: true // text-heavy modal
        });

    }

    self.attachTeamRadioLogModal = function (team) {
        const modalEl = document.getElementById('RadioLogModal');
        const modal = new bootstrap.Modal(modalEl);

        const vm = self.CreateRadioLogModalVM;

        vm.modalInstance = modal;

        vm.openForTeam(team);
        modal.show();

        installModalHotkeys({
            modalEl,
            onSave: () => self.CreateRadioLogModalVM.submit?.(),
            onClose: () => modal.hide(),
            allowInInputs: true // text-heavy modal
        });

    };

    self.attachNewOpsLogModal = function (job) {
        const modalEl = document.getElementById('CreateOpsLogModal');
        const modal = new bootstrap.Modal(modalEl);

        const vm = self.CreateOpsLogModalVM;

        vm.modalInstance = modal;

        vm.openForNewJobLog(job);
        modal.show();

        installModalHotkeys({
            modalEl,
            onSave: () => vm.submit?.(),
            onClose: () => modal.hide(),
            allowInInputs: true // text-heavy modal
        });
    };

    self.openTrackableAssetsModal = function (data, event) {
        // If called from a dropdown menu, close the dropdown
        if (event && event.target) {
            // Find the closest .dropdown and its .dropdown-toggle button
            let dropdown = event.target.closest('.dropdown');
            if (dropdown) {
                let toggleBtn = dropdown.querySelector('[data-bs-toggle="dropdown"]');
                if (toggleBtn) {
                    // Use Bootstrap 5 API to close the dropdown
                    let dropdownInstance = bootstrap.Dropdown.getOrCreateInstance(toggleBtn);
                    dropdownInstance.hide();
                }
            }
        }
        const modalEl = document.getElementById('trackableAssetsModal');
        if (modalEl) {
            self.trackableAssetsModalVM.isOpen(true)
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', () => {
                self.trackableAssetsModalVM.isOpen(false);
            });
        }
    }


    // Job registry/upsert
    // might be called from tasking OR job fetch so values might be missing
    self.getOrCreateJob = function (jobJson) {
        const deps = makeJobDeps();
        let job = this.jobsById.get(jobJson.Id);
        if (job) {
            //console.log("Updating existing job:", job.id());
            job.updateFromJson(jobJson);
            return job;
        }
        job = new Job(jobJson, deps);
        this.jobsById.set(job.id(), job);
        this.jobs.push(job);
        return job;
    }

    // asset registry/upsert
    self.getOrCreateAsset = function (assetJson) {
        if (assetJson.type === 'telematics') return null;
        if (!assetJson || assetJson.properties.id == null) return null;
        if (assetJson.properties.lastSeen) {
            const lastSeenDate = new Date(assetJson.properties.lastSeen);
            const now = new Date();
            const diffDays = (now - lastSeenDate) / (1000 * 60 * 60 * 24);
            if (diffDays > 14) return null;
        }

        let asset = self.assetsById.get(assetJson.properties.id);
        if (asset) { //existing asset - update values
            asset.updateFromJson(assetJson);
            return asset;
        } else { //new asset - create, store, attach to teams
            asset = new Asset(assetJson);
            self.trackableAssets.push(asset);
            self.assetsById.set(asset.id(), asset);
        }
        return asset;
    };


    // ---- Trackable asset matching (exact-first, fuzzy-second; token consumed once) ----

    function _normAssetName(v) {
        // asset names are like PAR56 / SES47 / SES47T (no spaces)
        const s = (v == null) ? '' : String(v);
        return s.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function _splitTeamCallsignIntoParts(v) {
        const s0 = (v == null) ? '' : String(v);

        // Make separators explicit BEFORE stripping spaces
        // e.g. "PAR56 + PAR18" => ["PAR56", "PAR18"]
        // also handle "and"
        const s1 = s0
            .replace(/\bteam\b/ig, ' ')
            .replace(/\s+\+\s+/g, '|')
            .replace(/[+&/,;]+/g, '|')
            .replace(/\s+\band\b\s+/ig, '|')
            .replace(/\s+\bwith\b\s+/ig, '|');

        return s1.split('|').map(p => p.trim()).filter(Boolean);
    }

    function _tokenVariantsFromPart(part) {
        // produce a small set of candidate tokens from one callsign part
        const raw = _normAssetName(part);
        if (!raw) return [];

        const out = new Set();

        // 1) raw as-is (already no spaces / punctuation)
        out.add(raw);

        // 2) if looks like <letters><digits><many letters>, drop the trailing word
        //    e.g. "par56truck" => "par56"
        const mLongSuffix = raw.match(/^([a-z]+[0-9]+)[a-z]{2,}$/);
        if (mLongSuffix) out.add(mLongSuffix[1]);

        // 3) if contains <letters><digits><optional single letter>, keep that prefix too
        //    e.g. "ses47talpha" => "ses47t"
        const mCore = raw.match(/^([a-z]+[0-9]+[a-z]?)$/) || raw.match(/^([a-z]+[0-9]+[a-z]?)/);
        if (mCore && mCore[1]) out.add(mCore[1]);

        // prune empties
        return [...out].map(x => x.trim()).filter(Boolean);
    }

    function _extractTeamTokens(team) {
        const cs = team?.callsign?.();
        if (!cs) return [];

        const s = String(cs);

        // 1) Primary: extract ALL occurrences of <letters><optional space><digits><optional letter>
        //    Handles: "PAR18 PAR911", "PAR 56 Team", "PAR56 + PAR18", "SES47T"
        const re = /[a-z]{2,6}\s*\d+[a-z]?/ig;
        const seen = new Set();
        const tokens = [];

        for (const m of s.matchAll(re)) {
            const tok = _normAssetName(m[0]); // strips spaces/punct => "par56"
            if (!tok || seen.has(tok)) continue;
            seen.add(tok);
            tokens.push(tok);
        }

        // If we found any, we're done (prevents weird whitespace-only splitting issues).
        if (tokens.length) return tokens;

        // 2) Fallback: previous behaviour (kept for edge cases)
        const parts = _splitTeamCallsignIntoParts(s);
        for (const p of parts) {
            for (const t of _tokenVariantsFromPart(p)) {
                if (!t || seen.has(t)) continue;
                seen.add(t);
                tokens.push(t);
            }
        }
        return tokens;
    }

    function _scoreFuzzy(token, assetName) {
        // Lower is better.
        // Exact matches are handled before fuzzy, so no 0 here.
        if (assetName.startsWith(token)) return 1;
        if (assetName.includes(token)) return 2;
        if (token.includes(assetName)) return 3;
        return 99;
    }

    function _computeMatchedAssetsForTeam(team, allAssets) {
        const tokens = _extractTeamTokens(team);
        if (!tokens.length) return new Set();

        // Map assetName -> list of assets (usually 1)
        const byName = new Map();
        for (const a of (allAssets || [])) {
            const n = _normAssetName(a?.name?.());
            if (!n) continue;
            if (!byName.has(n)) byName.set(n, []);
            byName.get(n).push(a);
        }

        const matchedAssetIds = new Set();
        const matchedAssets = new Set();
        const usedTokens = new Set();

        // 1) EXACT first: token === assetName
        for (const tok of tokens) {
            const exactList = byName.get(tok);
            if (!exactList || !exactList.length) continue;

            // allow multiple exact matches (duplicate assets with same name)
            let addedAny = false;
            for (const a of exactList) {
                if (matchedAssetIds.has(a.id())) continue;
                matchedAssetIds.add(a.id());
                matchedAssets.add(a);
                addedAny = true;
            }

            // consume the token if it produced at least one exact match,
            // so it won't be used for fuzzy matching.
            if (addedAny) usedTokens.add(tok);
        }

        // 2) FUZZY second (token consumed once; asset matched once)
        //    This is what prevents "SES59" matching "SES59T" when "SES59" exists:
        //    the exact pass consumes "ses59" and matches SES59 before fuzzy runs.
        for (const tok of tokens) {
            if (usedTokens.has(tok)) continue;

            let best = null;
            let bestScore = 999;

            for (const [assetName, list] of byName.entries()) {
                const score = _scoreFuzzy(tok, assetName);
                if (score >= 99) continue;

                // prefer shortest assetName on ties (reduces suffix grabs like SES59T)
                // and skip assets already matched
                for (const a of list) {
                    if (matchedAssetIds.has(a.id())) continue;

                    const tieBreaker = best ? (assetName.length - _normAssetName(best.name()).length) : 0;
                    const better =
                        (score < bestScore) ||
                        (score === bestScore && best && assetName.length < _normAssetName(best.name()).length) ||
                        (score === bestScore && !best);

                    if (better && tieBreaker <= 0) {
                        best = a;
                        bestScore = score;
                    }
                }
            }

            if (best) {
                usedTokens.add(tok);
                matchedAssetIds.add(best.id());
                matchedAssets.add(best);
            }
        }

        return matchedAssets;
    }

    // Replaces the old pairwise matcher
    self._assetMatchesTeam = function (_asset, _team) {
        // no longer used as the primary mechanism; keep for safety if anything external calls it
        // (fall back to the new computed set for correctness).
        try {
            const matches = _computeMatchedAssetsForTeam(_team, self.trackableAssets?.() || []);
            return [...matches].some(a => a?.id?.() === _asset?.id?.());
        } catch (_e) {
            return false;
        }
    };


    // recompute one team's asset list
    self._refreshTeamTrackableAssets = function (team) {
        console.log("Refreshing trackable assets for team:", team?.callsign?.());
        if (!team || typeof team.trackableAssets !== 'function') return;

        // Defer execution to avoid blocking UI thread
        setTimeout(() => {
            const all = self.trackableAssets?.() || [];
            const desired = _computeMatchedAssetsForTeam(team, all); // Set<Asset>

            // Remove no-longer-matching
            (team.trackableAssets() || []).slice().forEach(a => {
                if (!desired.has(a)) {
                    a?.matchingTeams?.remove?.(team);
                    team.trackableAssets.remove(a);
                }
            });

            // Add new matches
            for (const a of desired) {
                const has = (team.trackableAssets() || []).includes(a);
                if (!has) {
                    team.trackableAssets.push(a);
                    a?.matchingTeams?.push?.(team);
                }
            }
        }, 0);
    };

    // redo matching assets after an asset update
    self._attachAssetsToMatchingTeams = function () {
        // For correctness (token consumption + exact-first), reconcile per-team against full asset set
        (self.teams?.() || []).forEach(team => self._refreshTeamTrackableAssets(team));
    };

    // Tasking registry/upsert (NEW magical 2.0 way of doing it)
    self.upsertTaskingFromPayload = function (taskingJson, { teamContext = null } = {}) {
        if (!taskingJson || taskingJson.Id == null) return null;

        // Resolve shared refs
        const jobRef = self.getOrCreateJob(taskingJson.Job);

        //flag the team creation/update as from tasking so its not updated with stale data
        //otherwise we might overwrite an active team with old stuff
        const teamRef = teamContext || self.getOrCreateTeam(taskingJson.Team, 'tasking');

        let t = self.taskingsById.get(taskingJson.Id);
        if (t) {
            //console.log("Updating existing tasking:", t.id());
            t.updateFrom(taskingJson); //update the tasking inplace
        } else {
            //console.log("Creating new tasking:", taskingJson.Id);
            t = new Tasking(taskingJson); //make a new one
            self.taskings.push(t);
            self.taskingsById.set(t.id(), t);
        }

        // Attach shared references
        if (teamRef) t.team = teamRef; //bind the team to the tasking
        self._linkTaskingAndJob(t, jobRef);  //bind the tasking to the job
        teamRef.addTaskingIfNotExists(t);              //ensure the team has the tasking listed
        if (teamRef) teamRef.lastTaskingDataUpdate = new Date();    //touch last tasking update timer
        if (jobRef) jobRef.lastTaskingDataUpdate = new Date();      //touch last tasking update timer
        return t;
    };

    self.spotlightSearchVM = new SpotlightSearchVM({
        rootVm: self,
        getTeams: () => ko.unwrap(self.filteredTeamsAgainstConfig()),
        getJobs: () => ko.unwrap(self.filteredJobsAgainstConfig()),
    });

    self._spotlightModalEl = null;
    self._spotlightModal = null;

    self._openSpotlight = () => {

        self.teamSearch(''); // clear team search to avoid confusion
        self.jobSearch('');  // clear job search to avoid confusion

        const el = document.getElementById("SpotlightSearchModal");
        if (!el) return;

        self._spotlightModalEl = el;
        self._spotlightModal = bootstrap.Modal.getOrCreateInstance(el);

        self.spotlightSearchVM.query("");
        self.spotlightSearchVM.results.removeAll();
        self.spotlightSearchVM.activeIndex(0);
        self.spotlightSearchVM.rebuildIndex?.();

        self._spotlightModal.show();

        // focus input after show
       document.getElementById("spotlightSearchInput")?.focus();
        

        installModalHotkeys({
            modalEl: el,
            onSave: () => { /* empty */ }, // enter handled in VM keydown
            onClose: () => self._closeSpotlight(),
            allowInInputs: true
        });
    };

    self._closeSpotlight = () => {
        try { self._spotlightModal?.hide(); } catch { /* empty */ }
    };

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
        self.mapVM.assetLayer.eachLayer(l => fg.addLayer(l));

        // all job marker layer groups
        for (const { layerGroup } of self.mapVM.jobMarkerGroups.values()) {
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
        //console.log("Initial fetch done, remaining:", initialFetchesPending - 1);
        if (initialFetchesPending > 0) {
            initialFetchesPending -= 1;
            // Give subscriptions time to attach markers, then attempt fit
            tryInitialFit();
        }
    };

    self._linkTaskingAndJob = function (tasking, job) {
        //console.log("Linking tasking:", tasking.id(), "with job:", job.id());
        if (!tasking) return;
        const prev = tasking.job && tasking.job.id && tasking.job || null; // current job ref
        if (prev && prev.id() !== job.id()) {
            //console.log("Previous job does not match the new job");
            prev.removeTasking(tasking);   // detach from old job
        }
        if (job) {
            tasking.job = job;                                     // set shared ref
            job.addTasking(tasking);                               // attach to new job. has dup check
        } else {
            tasking.job = null;
        }
    };




    self.markerLayersControl = null;    // optional Leaflet layer control

    self.collapseAllIncidentPanels = function () {
        self.filteredJobs().forEach(j => j.expanded(false));
    }

    self.collapseAllTeamPanels = function () {
        self.filteredTeams().forEach(t => t.expanded(false));
    }

    self.drawJobTargetRing = function (job) {
        if (!job || !job.address) return;
        self.mapVM.drawJobAssetDistanceRings(job);
    }

    self.fetchSuppliersForJob = async function (id) {
        const t = await getToken();   // blocks here until token is ready
        return new Promise((resolve) => {
            BeaconClient.suppliers.get(id, apiHost, params.userId, t, function (data) {
                resolve(data || []);
            })
        });
    }

    self.fetchContactNumbers = async function (id) {
        const t = await getToken();   // blocks here until token is ready
        return new Promise((resolve) => {
            BeaconClient.contacts.search(id, apiHost, params.userId, t, function (data) {
                resolve(data.Results || []);
            })
        });
    }

    self.searchContacts = async function (query) {
        const t = await getToken();   // blocks here until token is ready
        return new Promise((resolve) => {
            BeaconClient.contacts.searchAll(query, apiHost, params.userId, t, function (data) {
                resolve(data.Results || []);
            })
        });
    }

    self.sendSMS = async function (recipients, jobId = '', message, isOperational) {
        const t = await getToken();   // blocks here until token is ready
        return new Promise((resolve, reject) => {
            BeaconClient.messages.send(recipients, jobId, message, isOperational, apiHost, params.userId, t, function (data) {
                if (data) {
                    resolve(data);
                } else {
                    reject(false);
                }
            })
        });
    }

    self.fetchUnresolvedActionsLog = async function (job) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.operationslog.unresolvedActionsLog(job, apiHost, params.userId, t, function (data) {
            job.updateFromJson({ ActionRequiredTags: data.Results.flatMap(entry => entry.Tags || []) });
        }, function (err) {
            console.error("Failed to fetch unresolved actions log entries for job:", err);
            showAlert('Failed to fetch unresolved actions log entries. Your session may have expired', 'danger', 5000);
        });
    }

    self.fetchUnacknowledgedJobNotifications = async function (job) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.notifications.unaccepted(job.id(), apiHost, params.userId, t, function (data) {
            job.unacceptedNotifications(data);
        }, function (err) {
            console.error("Failed to fetch unacknowledged job notifications:", err);
            showAlert('Failed to fetch unacknowledged job notifications. Your session may have expired', 'danger', 5000);
        });
    }

    self.assignJobToTeam = async function (teamVm, jobVm, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.tasking.task(teamVm.id(), jobVm.id(), apiHost, params.userId, t, function (r) {
            console.log(r)
            if (r && r.length > 0) {
                showAlert(`Incident ${jobVm.identifier()} assigned to team ${teamVm.callsign()}.`, 'success', 3000);
            } else {
                showAlert(`Failed to assign incident ${jobVm.identifier()} to team ${teamVm.callsign()}.`, 'danger', 5000);
            }
            jobVm.fetchTasking();
            teamVm.fetchTasking();
            if (cb) cb(r);
        })
    }

    //update spotlight index on team/job filter changes
    self.filteredTeamsAgainstConfig.subscribe(() => { self.spotlightSearchVM.rebuildIndex?.() }, null, "arrayChange");
    self.filteredJobsAgainstConfig.subscribe(() => { self.spotlightSearchVM.rebuildIndex?.() }, null, "arrayChange");

    //fetch tasking if a team is added
    self.filteredTeams.subscribe((changes) => {
        changes.forEach(ch => {
            if (ch.status === 'added') {
                console.log("Team filtered in, fetching tasking:", ch.value.callsign());
                ch.value.isFilteredIn(true);
                ch.value.fetchTasking();
            } else if (ch.status === 'deleted') {
                if (ch.value.expanded() || ch.value.popUpIsOpen()) {
                    showAlert("The team you were viewing has been refreshed and filtered out based on the current filters", "warning", 4000);
                }
                ch.value.isFilteredIn(false);
            }
        });
    }, null, "arrayChange");


    // automatically refresh markers when jobs change
    self.filteredJobs.subscribe((changes) => {
        changes.forEach(ch => {
            if (ch.status === 'added') {
                addOrUpdateJobMarker(ko, map, self, ch.value);
                ch.value.isFilteredIn(true);
                ch.value.fetchTasking();
            } else if (ch.status === 'deleted') {
                if (ch.value.expanded() || ch.value.popUpIsOpen()) {
                    showAlert("The job you were viewing has been refreshed and filtered out based on the current filters. It has probably been closed or completed.", "warning", 4000);
                }
                removeJobMarker(self, ch.value);

                ch.value.isFilteredIn(false);
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
                //console.log("Detaching marker for asset no longer filtered in:", a.id());
                // keep the asset in registry, but remove map marker + subs
                detachAssetMarker(ko, map, self, a);
            }
        });
    }, null, "arrayChange");

    self.unmatchedTrackableAssets.subscribe((changes) => {
        // bail fast if the layer is not currently visible
        if (!self.mapVM || !map.hasLayer(self.mapVM.unmatchedAssetLayer)) {
            return;
        }
        changes.forEach(ch => {
            const a = ch.value;
            if (ch.status === 'added') {
                attachUnmatchedAssetMarker(ko, map, self, a);
            } else if (ch.status === 'deleted') {
                detachUnmatchedAssetMarker(ko, map, self, a);
            }
        });
    }, null, "arrayChange");

    map.on('layeradd', (ev) => {
        if (ev.layer !== self.mapVM.unmatchedAssetLayer) return;
        // initial populate unmatchedTrackableAssets only when layer becomes visible
        const assets = self.unmatchedTrackableAssets?.() || [];
        assets.forEach(a => {
            attachUnmatchedAssetMarker(ko, self.map, self, a);
        });
    });

    // catch the unmatchedTrackableAssets layer being turned off to remove markers
    map.on('layerremove', (ev) => {
        if (ev.layer !== self.mapVM.unmatchedAssetLayer) return;
        const assets = self.unmatchedTrackableAssets?.() || [];
        assets.forEach(a => {
            attachUnmatchedAssetMarker(ko, self.map, self, a);
        });
    });

    self.showConfirmTaskingModal = function (jobVm, teamVm) {
        if (!jobVm || !teamVm) return;

        // Fill modal text
        const jobIdEl = document.getElementById('confirmJobId');
        const teamCallsignEl = document.getElementById('confirmTeamCallsign');
        if (jobIdEl) jobIdEl.textContent = jobVm.identifier();
        if (teamCallsignEl) teamCallsignEl.textContent = teamVm.callsign() || '(unknown)';

        // Bootstrap modal
        const modalEl = document.getElementById('confirmTaskingModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Reset and rebind "Yes" button
        const oldBtn = document.getElementById('confirmTaskingYes');
        if (!oldBtn) return;
        oldBtn.replaceWith(oldBtn.cloneNode(true));
        const yesBtn = document.getElementById('confirmTaskingYes');

        yesBtn.addEventListener('click', () => {
            modal.hide();
            self.assignJobToTeam(teamVm, jobVm);
        });

        const oldSMSBtn = document.getElementById('confirmTaskingYesSMS');
        if (!oldSMSBtn) return;
        oldSMSBtn.replaceWith(oldSMSBtn.cloneNode(true));
        const yesSMSBtn = document.getElementById('confirmTaskingYesSMS');

        yesSMSBtn.addEventListener('click', () => {
            modal.hide();
            self.assignJobToTeam(teamVm, jobVm, (r) => {
                if (r && r.length > 0) {
                    self.attachSendSMSModal([], teamVm, null, jobVm);
                }
            });
        });

    };

    self.fetchOpsLogForJob = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.operationslog.search(jobId, apiHost, params.userId, t, function (data) {
            cb(data?.Results || []);
        }, function (err) {
            console.error("Failed to fetch ops log for job:", err);
            showAlert("Failed to fetch ops log. Your session may have expired", "danger", 5000);
            cb([]);
        });
    }

    self.fetchHistoryForJob = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.getHistory(jobId, apiHost, params.userId, t, function (data) {
            cb(data || []);
        }, function (err) {
            console.error("Failed to fetch history for job:", err);
            showAlert("Failed to fetch job history. Your session may have expired", "danger", 5000);
            cb([]);
        });
    }

    self.createOpsLogEntry = async function (payload, cb) {
        const form = BeaconClient.toFormUrlEncoded(payload);
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.operationslog.create(apiHost, form, t, function (data) {
            cb(data);
        }, function (err) {
            console.error("Failed to create ops log entry:", err);
            showAlert("Failed to create ops log entry.", "danger", 5000);
            cb(null);
        });
    }

    self.updateTeamStatus = function (tasking, status, payload, cb) {
        BeaconClient.tasking.updateTeamStatus(apiHost, tasking.id(), status, payload, token, function (data) {
            tasking.job.fetchTasking();
            cb(data || []);
        }, function (err) {
            console.error("Failed to update team status:", err);
            showAlert("Failed to update team status.", "danger", 5000);
            cb([]);
        });
    }

    self.callOffTeam = function (tasking, payload, cb) {
        BeaconClient.tasking.callOffTeam(apiHost, tasking.id(), payload, token, function (data) {
            tasking.job.fetchTasking();
            cb(data || []);
        }, function (err) {
            console.error("Failed to call off team:", err);
            showAlert("Failed to call off team.", "danger", 5000);
            cb([]);
        });
    }

    self.untaskTeam = function (tasking, payload, cb) {
        const form = BeaconClient.toFormUrlEncoded(payload);
        BeaconClient.tasking.untaskTeam(apiHost, tasking.id(), form, token, function (data) {
            tasking.job.fetchTasking();
            cb(data);
        }, function (err) {
            console.error("Failed to Untask Team:", err);
            showAlert("Failed to Untask Team.", "danger", 5000);
            cb(null);
        });
    }

    self.fetchJobById = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.get(jobId, 1, apiHost, params.userId, t,
            function (res) {
                if (res) {
                    self.getOrCreateJob(res);
                    cb && cb(true);
                } else {
                    cb && cb(false);
                }
            },
            function (_err) {
                cb && cb(false);
            }
        )
    }

    self.fetchTeamById = async function (teamId, cb) {
        const t = await getToken();   // blocks here until token is ready
        console.log("Fetching team by ID:", teamId);
        BeaconClient.team.get(teamId, 1, apiHost, params.userId, t,
            function (res) {
                if (res) {
                    self.getOrCreateTeam(res);
                    cb(true);
                } else {
                    cb(false);
                }
            },
            function (_err) {
                cb(false);
            }
        )
    }

    self.fetchJobTasking = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.getTasking(jobId, apiHost, params.userId, t, (res) => {
            (res?.Results || []).forEach(t => myViewModel.upsertTaskingFromPayload((t)));
            cb(true);
        }, (err) => {
            console.error("Failed to fetch job tasking:", err);
            cb(false);
        });
    }

    self.setJobStatus = async function (jobId, statusName, text, cb) {
        console.log("Setting job status:", jobId, " to ", statusName, " with text:", text);
        const t = await getToken();
        return new Promise((resolve, reject) => {
            function handleResult(res) {
                if (cb) cb(res);
                if (res) resolve(res);
                else reject(res);
            }
            switch (statusName) {
                case 'Acknowledge':
                    BeaconClient.job.acknowledge(jobId, apiHost, params.userId, t, handleResult);
                    break;
                case 'Complete':
                    BeaconClient.job.setStatusClosed(jobId, text, apiHost, params.userId, t, handleResult);
                    break;
                case 'Reject':
                    BeaconClient.job.reject(jobId, text, apiHost, params.userId, t, handleResult);
                    break;
                case 'Cancel':
                    BeaconClient.job.cancel(jobId, text, apiHost, params.userId, t, handleResult);
                    break;
                case 'Reopen':
                    BeaconClient.job.reopen(jobId, apiHost, params.userId, t, handleResult);
                    break;
                default:
                    reject(new Error('Unknown statusName'));
            }
        });
    }

    self.fetchAllTrackableAssets = async function () {
        if (!assetDataRefreshInterlock) {
            const t = await getToken();   // blocks here until token is ready
            BeaconClient.asset.filter('', apiHost, params.userId, t, function (assets) {
                assets.forEach(function (a) {
                    myViewModel.getOrCreateAsset(a);
                })
                const fetchedAssetIds = new Set((assets || []).map(a => a.properties.id));
                const existingAssetIds = self.assetsById.keys();
                const assetsToRemove = [...existingAssetIds].filter(id => !fetchedAssetIds.has(id));
                assetsToRemove.forEach(id => {
                    const asset = self.assetsById.get(id);
                    if (!asset) return;
                    // Unlink from matching teams
                    if (Array.isArray(asset.matchingTeams)) {
                        asset.matchingTeams.slice().forEach(team => {
                            if (team.trackableAssets) team.trackableAssets.remove(asset);
                            asset.matchingTeams.remove(team);
                        });
                    }
                    // Remove from observable array and registry
                    self.trackableAssets.remove(asset);
                    self.assetsById.delete(id);
                });
                //Update Asset/Team mappings only once after all changes
                self._attachAssetsToMatchingTeams();
                myViewModel._markInitialFetchDone();
                assetDataRefreshInterlock = false;
            }, function (err) {
                console.error("Error fetching trackable assets:", err);
                showAlert('Failed to fetch trackable assets. Your session may have expired', 'danger', 5000);
                assetDataRefreshInterlock = false;
            }
            )
        }
    }

    self.fetchAllJobsData = async function () {
        const hqsFilter = myViewModel.config.incidentFilters().map(f => `Hq=${f.id}`).join('&');
        const statusFilterToView = myViewModel.config.jobStatusFilter().map(status => `JobStatusTypeIds=${Enum.JobStatusType[status]?.Id}`).filter(id => id !== undefined).join('&');
        const incidentTypeFilterToView = myViewModel.config.incidentTypeFilter().map(type => `JobTypeIds=${Enum.IncidentType[type]?.Id}`).filter(id => id !== undefined).join('&');
        const sectorToView = myViewModel.config.sectorFilters().map(s => `SectorIds=${s.id}`).join('&');
        var end = new Date();
        var start = new Date();

        start.setDate(end.getDate() - myViewModel.config.fetchPeriod());

        start.setMinutes(start.getMinutes() + 5); // slight overlap to catch late updates and drift
        end.setDate(end.getDate() + self.config.fetchForward());


        myViewModel.jobsLoading(true);

        const t = await getToken();   // blocks here until token is ready

        const paramsArray = [
            `StartDate=${start.toISOString()}`,
            `EndDate=${end.toISOString()}`,
            hqsFilter,
            statusFilterToView,
            incidentTypeFilterToView,
            sectorToView,
            `Unsectorised=${self.config.includeIncidentsWithoutSector()}`,
            `ViewModelType=6`,
        ].filter(param => param && param.trim() !== '');

        const url = paramsArray.join('&');

        BeaconClient.job.searchRaw(url, apiHost, params.userId, t, function (allJobs) {
            console.log("Total jobs fetched:", allJobs.Results.length);

            // Clean up jobs that no longer exist in the feed
            const fetchedJobIds = new Set((allJobs.Results || []).map(j => j.Id));
            const existingJobIds = new Set(self.jobs().map(j => j.id()));

            const jobsToQuery = [...existingJobIds].filter(id => !fetchedJobIds.has(id));

            jobsToQuery.forEach(id => {
                const job = self.jobsById.get(id);
                if (!job) return;
                if (!job.isFilteredIn()) return;
                console.log("Refreshing job no longer in feed:", id);
                job.refreshDataAndTasking(); // ensure latest data

            });


            myViewModel._markInitialFetchDone();
            myViewModel.jobsLoading(false);
        }, function (_val, _total) {
            //console.log("Progress: " + _val + " / " + _total)
        }, function (jobs) { //call back as they come in per page
            jobs.Results.forEach(function (t) {
                myViewModel.getOrCreateJob(t);
            })
        })
    }

    self.fetchAllTeamData = async function () {
        const hqsFilter = this.config.teamFilters().map(f => ({ Id: f.id }));

        const statusFilterToView = myViewModel.config.teamStatusFilter().map(desc => {
            // Find the Enum.TeamStatusType entry whose Description matches desc
            const entry = Object.values(Enum.TeamStatusType).find(e => e.Description === desc);
            return entry ? entry.Id : undefined;
        }).filter(id => id !== undefined);
        var end = new Date();
        var start = new Date();
        start.setDate(end.getDate() - myViewModel.config.fetchPeriod());
        start.setMinutes(start.getMinutes() + 5); // slight overlap to catch late updates and drift
        end.setDate(end.getDate() + self.config.fetchForward());
        myViewModel.teamsLoading(true);
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.team.teamSearch(hqsFilter, apiHost, start, end, params.userId, t, function (teams) {
            // teams.Results.forEach(function (t) {
            //     myViewModel.getOrCreateTeam(t);
            // })
            console.log("Total teams fetched:", teams.Results.length);
            myViewModel._markInitialFetchDone();
            myViewModel.teamsLoading(false);

            // Loop over all the teams in the results and compare them to self.teams
            const fetchedTeamIds = new Set(teams.Results.map(t => t.Id));
            const existingTeamIds = new Set(self.teams().map(t => t.id()));

            // Find teams that exist in self.teams but not in the fetched results
            const teamsToQuery = [...existingTeamIds].filter(id => !fetchedTeamIds.has(id));

            // Remove the unmatched teams
            teamsToQuery.forEach(id => {
                const team = self.teamsById.get(id);
                if (!team) return;
                if (!team.isFilteredIn()) return;
                console.log("Refreshing team no longer in feed:", id, team.callsign());
                team.refreshDataAndTasking(); // ensure latest data

            });


        }, function () {
            //console.log("Progress: " + val + " / " + total)
        },
            statusFilterToView, //status filter
            function (teams) { //per page
                teams.Results.forEach(function (t) {
                    myViewModel.getOrCreateTeam(t);
                })
            }
        )
    }

    var assetDataRefreshInterlock = false

    var assetDataRefreshTimer = null

    function startAssetDataRefreshTimer() {
        if (assetDataRefreshTimer) clearInterval(assetDataRefreshTimer);
        assetDataRefreshTimer = setInterval(() => {
            self.fetchAllTrackableAssets()
        }, 30000);
    };


    // ---------------- REFRESH TIMER FOR JOBS + TEAMS -----------------

    let jobsTeamsTimer = null;

    function startJobsTeamsTimer() {
        // clear old timer
        if (jobsTeamsTimer) clearInterval(jobsTeamsTimer);

        // interval in seconds → ms
        const interval = Number(self.config.refreshInterval() || 60) * 1000;

        jobsTeamsTimer = setInterval(() => {
            self.fetchAllJobsData();
            self.fetchAllTeamData();
        }, interval);

        console.log("Jobs/Teams refresh timer started:", interval, "ms");
    }



    // re-arm timer when refreshInterval changes
    self.config.refreshInterval.subscribe(() => {
        console.log("refreshInterval changed → restarting timer");
        startJobsTeamsTimer();
    });



    const tagFetchPromises = Object.keys(Enum.TagGroup).map((key) => {
        const groupId = Enum.TagGroup[key]?.Id;
        if (groupId) {
            return getToken()
                .then((t) => {
                    return new Promise((resolve, reject) => {
                        BeaconClient.tags.getGroup(groupId, apiHost, params.userId, t, (tags) => {
                            tags = (tags || []).map(tagData => new Tag(tagData));
                            self.allTags.push(...tags);
                            resolve();
                        }, (err) => {
                            console.error(`Failed to fetch tags for group ${key}:`, err);
                            reject(err);
                        });
                    });
                })
                .catch((err) => {
                    console.error(`Error fetching token for group ${key}:`, err);
                });
        }
        return Promise.resolve();
    });

    Promise.all(tagFetchPromises)
        .finally(() => {
            self.tagsLoading(false);
        });



    self.UserPressedSaveOnTheConfigModal = function () {
        //re-fetch data based on new config
        initialFetchesPending = 2; // teams, jobs
        self.fetchAllJobsData();
        self.fetchAllTeamData();
        self.fetchAllTrackableAssets();

        startJobsTeamsTimer();
        startAssetDataRefreshTimer()
    }

    // --- Polling layers ---
    registerTransportCamerasLayer(self, map, getToken, apiHost, params);
    registerUnitBoundaryLayer(self, map, getToken, apiHost, params);
    registerTransportIncidentsLayer(self, map, getToken, apiHost, params);
    registerSESZonesGridLayer(self);
    registerSESUnitsZonesHybridGridLayer(self, map);
    registerHazardWatchWarningsLayer(self, apiHost);
    registerSESUnitLocationsLayer(self);
    renderFRAOSLayer(self, map, getToken, apiHost, params);

    // --- Layers Drawer (under zoom)
    const LayersDrawer = L.Control.extend({
        options: { position: "topleft" },

        initialize(opts = {}) {
            L.Util.setOptions(this, opts);
            this._currentBase = null;
            this._baseKey = localStorage.getItem("map.base") || "Topographic";
            this._open = localStorage.getItem("layers.open") === "1";
        },

        onAdd(map) {
            const c = L.DomUtil.create("div", "layers-drawer leaflet-bar");

            // stop wheel -> no map zoom when scrolling the panel
            c.addEventListener(
                "wheel",
                (e) => {
                    e.stopPropagation();
                },
                { passive: false }
            );

            // Bootstrap-flavoured shell
            c.innerHTML = `
      <button class="btn btn-light btn-sm shadow-sm" style="border: 10px;"
              title="Layers"
              aria-expanded="${this._open ? "true" : "false"}">
        <i class="fas fa-layer-group"></i>
      </button>

      <div class="ld-panel ${this._open ? "" : "d-none"} shadow-sm rounded-3">
        <div class="ld-section mb-2">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="ld-title text-uppercase small text-muted">Basemap</span>
          </div>
          <div class="btn-group btn-group-sm d-flex flex-wrap ld-bases"
               role="group"
               aria-label="Basemap selection"></div>
        </div>

        <hr class="my-2">

        <div class="ld-section">
          <div class="ld-title text-uppercase small text-muted mb-1">Overlays</div>
          <div class="ld-list ld-overlays"></div>
        </div>
      </div>
    `;

            // --- Basemap buttons (single-select) ---
            const basemapNames = [
                { name: "Esri Topographic", key: "Topographic" },
                { name: "Esri Streets", key: "Streets" },
                { name: "Esri Imagery", key: "Imagery" },
                { name: "Esri Dark", key: "DarkGray" },
                { name: "SIX Maps Topographic", key: "nsw-vector" },
                { name: "SIX Maps Base Map", key: "nsw-base" },
                { name: "SIX Maps Imagery", key: "nsw-imagery" }
            ];

            const basesEl = c.querySelector(".ld-bases");

            basemapNames.forEach(({ name, key }) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className =
                    "btn btn-outline-secondary flex-grow-1 mb-1" +
                    (key === this._baseKey ? " active btn-primary" : "");
                btn.textContent = name;
                btn.dataset.baseKey = key;

                btn.addEventListener("click", () => {
                    if (key === this._baseKey) return;

                    this._setBasemap(key, map);
                    this._baseKey = key;
                    localStorage.setItem("map.base", key);

                    // update active styles
                    basesEl.querySelectorAll("button").forEach((b) => {
                        b.classList.remove("active", "btn-primary");
                        b.classList.add("btn-outline-secondary");
                    });
                    btn.classList.add("active", "btn-primary");
                    btn.classList.remove("btn-outline-secondary");
                });

                basesEl.appendChild(btn);
            });

            // apply initial basemap
            this._setBasemap(this._baseKey, map);

            // --- Overlays as toggle buttons (multi-select) ---
            const overlaysEl = c.querySelector(".ld-overlays");
            const overlayDefs = self.mapVM.getOverlayDefsForControl() || [];

            // Group by def.group (parent menu layer)
            const groups = new Map();
            overlayDefs.forEach((def) => {
                const g = def.group || ""; // '' = ungrouped
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g).push(def);
            });

            // Build Bootstrap accordion container
            const acc = document.createElement("div");
            acc.className = "accordion accordion-flush";
            acc.id = "ld-overlays-accordion";
            overlaysEl.appendChild(acc);

            // Helpers
            const safeId = (s) =>
                String(s || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "") || "other";

            const groupTitle = (k) => (k && String(k).trim() ? k : "Other");

            // Build one accordion item per group (sub section)
            let idx = 0;
            groups.forEach((defs, groupKey) => {
                idx += 1;

                const gid = safeId(groupKey);
                const storeKey = `layers.ovgrp.${gid}`;
                const open = localStorage.getItem(storeKey) !== "0"; // default open

                const item = document.createElement("div");
                item.className = "accordion-item";

                const headerId = `ld-ov-h-${gid}-${idx}`;
                const collapseId = `ld-ov-c-${gid}-${idx}`;

                item.innerHTML = `
      <h2 class="accordion-header" id="${headerId}">
        <button class="accordion-button layermenu-accordion ${open ? "" : "collapsed"} py-2 px-2"
                type="button"
                aria-expanded="${open ? "true" : "false"}"
                aria-controls="${collapseId}">
          <span class="text-muted text-uppercase fw-semibold small">${groupTitle(groupKey)}</span>
        </button>
      </h2>
      <div id="${collapseId}"
     class="accordion-collapse collapse ${open ? "show" : ""}"
     aria-labelledby="${headerId}"
     data-bs-parent="#ld-overlays-accordion">
        <div class="accordion-body p-2"></div>
      </div>
    `;

                acc.appendChild(item);

                const btn = item.querySelector(".accordion-button");
                const body = item.querySelector(".accordion-body");
                const collapseEl = item.querySelector(".accordion-collapse");

                // Bootstrap Collapse instance with accordion behaviour (only one open at a time)
                const collapse = new bootstrap.Collapse(collapseEl, { toggle: false, parent: acc });

                btn.addEventListener("click", () => collapse.toggle());

                collapseEl.addEventListener("shown.bs.collapse", () => {
                    localStorage.setItem(storeKey, "1");
                    btn.classList.remove("collapsed");
                    btn.setAttribute("aria-expanded", "true");
                });

                collapseEl.addEventListener("hidden.bs.collapse", () => {
                    localStorage.setItem(storeKey, "0");
                    btn.classList.add("collapsed");
                    btn.setAttribute("aria-expanded", "false");
                });

                // Render overlay buttons inside this group's accordion body
                defs.forEach(({ key, label, layer, visibleByDefault }) => {
                    const stored = localStorage.getItem(`ov.${key}`);
                    const saved = (stored === null)
                        ? (visibleByDefault === true)
                        : (stored === "1");

                    if (saved) map.addLayer(layer);

                    const obtn = document.createElement("button");
                    obtn.type = "button";
                    obtn.className =
                        "btn btn-sm w-100 text-start d-flex align-items-center justify-content-between mb-1 ld-overlay-btn " +
                        (saved ? "btn-outline-secondary active" : "btn-outline-secondary");
                    obtn.dataset.key = key;
                    obtn.innerHTML = `
          <span class="me-2">${label}</span>
          <span class="ms-auto">
            <i class="fas ${saved ? "fa-toggle-on" : "fa-toggle-off"}"></i>
          </span>
        `;

                    obtn.addEventListener("click", () => {
                        const icon = obtn.querySelector("i");
                        const isOn = obtn.classList.contains("active");

                        if (isOn) {
                            map.removeLayer(layer);
                            localStorage.setItem(`ov.${key}`, "0");
                            obtn.classList.remove("active");
                            if (icon) {
                                icon.classList.remove("fa-toggle-on");
                                icon.classList.add("fa-toggle-off");
                            }
                        } else {
                            map.addLayer(layer);
                            localStorage.setItem(`ov.${key}`, "1");
                            obtn.classList.add("active");
                            if (icon) {
                                icon.classList.remove("fa-toggle-off");
                                icon.classList.add("fa-toggle-on");
                            }
                        }
                    });


                    body.appendChild(obtn);
                });
            });


            const btn = c.querySelector(".btn");
            const panel = c.querySelector(".ld-panel");
            L.DomEvent.on(btn, "click", (ev) => {
                L.DomEvent.stop(ev);
                const hidden = panel.classList.toggle("d-none");
                btn.setAttribute("aria-expanded", (!hidden).toString());
                btn.parentElement.classList.toggle("no-border", !hidden);
                localStorage.setItem("layers.open", hidden ? "0" : "1");
            });

            // prevent clicks/scrolls from falling through to map
            L.DomEvent.disableClickPropagation(c);

            // tuck the drawer under the zoom control
            setTimeout(() => {
                const position = map._controlCorners.topleft.querySelector(
                    ".leaflet-control-geosearch"
                );
                if (position && c.parentElement === map._controlCorners.topleft) {
                    position.insertAdjacentElement("afterend", c);
                }
            }, 0);

            this._container = c;
            return c;
        },


        onRemove() { /* nothing to clean up */ },

        _setBasemap(key, map) {
            if (this._currentBase) {
                map.removeLayer(this._currentBase);
                this._currentBase = null;
            }

            // --- NSW VECTOR BASEMAP (Topographic style) ---
            if (key === "nsw-vector") {
                // Uses the NSW_BaseMap_VectorTile VectorTileServer
                this._currentBase = esriVector.vectorTileLayer(
                    "https://portal.spatial.nsw.gov.au/vectortileservices/rest/services/Hosted/NSW_BaseMap_VectorTile/VectorTileServer",
                    {
                        attribution: "© NSW Spatial Services"
                    }
                );
            }

            // --- NSW RASTER BASEMAPS (tile MapServer) ---
            else if (key === "nsw-base") {
                this._currentBase = L.tileLayer(
                    "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Base_Map/MapServer/tile/{z}/{y}/{x}",
                    {
                        maxZoom: 20,
                        attribution: "© NSW Spatial Services"
                    }
                );
            } else if (key === "nsw-imagery") {
                this._currentBase = L.tileLayer(
                    "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}",
                    {
                        maxZoom: 20,
                        attribution: "© NSW Spatial Services"
                    }
                );
            }

            // --- EXISTING ESRI BASEMAPS ---
            else {
                this._currentBase = esri.basemapLayer(key, { ignoreDeprecationWarning: true });
            }

            if (this._currentBase) {
                this._currentBase.addTo(map);
            }
        }


    });

    // --- Sidebar collapse button (under Layers drawer)
    const SidebarToggle = L.Control.extend({
        options: { position: "topleft" },

        initialize() {
            this._collapsed = localStorage.getItem("sidebar.collapsed") === "1";
        },

        onAdd(map) {
            const c = L.DomUtil.create("div", "leaflet-control sidebar-toggle leaflet-bar");
            c.innerHTML = `
                <button type="button" class="btn btn-light btn-sm shadow-sm" title="Collapse/expand left panel">
                    <i class="fas ${this._collapsed ? "fa-angle-double-right" : "fa-angle-double-left"}"></i>
                </button>
            `;

            const btn = c.querySelector(".btn");
            L.DomEvent.on(btn, "click", (ev) => {
                L.DomEvent.stop(ev);

                this._collapsed = !this._collapsed;
                document.body.classList.toggle("sidebar-collapsed", this._collapsed);
                localStorage.setItem("sidebar.collapsed", this._collapsed ? "1" : "0");

                const icon = btn.querySelector("i");
                if (icon) {
                    icon.classList.toggle("fa-angle-double-left", !this._collapsed);
                    icon.classList.toggle("fa-angle-double-right", this._collapsed);
                }

                // Leaflet needs a resize after layout change
                setTimeout(() => map.invalidateSize(true), 0);
            });

            // apply initial state
            if (this._collapsed) document.body.classList.add("sidebar-collapsed");

            L.DomEvent.disableClickPropagation(c);


            this._container = c;
            return c;
        }
    });

    const sidebarToggle = new SidebarToggle();
    sidebarToggle.addTo(map);

    const layersDrawer = new LayersDrawer();
    layersDrawer.addTo(map);

    setTimeout(() => {
        // force ordering: place directly under zoom buttons
        const zoom = document.querySelector('.leaflet-control-zoom');
        const toggle = document.querySelector('.sidebar-toggle');
        if (zoom && toggle) {
            zoom.parentNode.insertBefore(toggle, zoom.nextSibling);
        }
    }, 0);



    self.fetchHQDetails = async function (hqName) {
        console.log("Fetching HQ details for:", hqName);
        const t = await getToken(); // Wait for the token to be ready

        return new Promise((resolve, reject) => {
            fetchHqDetailsSummary(hqName, apiHost, t, (hqDetails) => {
                if (hqDetails) {
                    resolve(hqDetails); // Resolve the promise with the result
                } else {
                    console.warn("No HQ details found for name:", hqName);
                    reject(new Error("No HQ details found"));
                }
            });
        });
    };

    (function installPopupHideHotkey() {
        let active = false;

        function isTypingTarget(e) {
            const t = e.target;
            return t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable);
        }

        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Space') return;
            if (e.repeat) return;
            if (isTypingTarget(e)) return;

            e.preventDefault(); // stop page scroll
            if (active) return;
            active = true;

            document.body.classList.add('map-popups-hidden');
        }, { passive: false });

        document.addEventListener('keyup', (e) => {
            if (e.code !== 'Space') return;
            active = false;

            document.body.classList.remove('map-popups-hidden');
        });
    })();



}

window.addEventListener('resize', () => map.invalidateSize());







document.addEventListener('DOMContentLoaded', function () {


    // Ensure only one job status dropdown is open at a time
    document.addEventListener('show.bs.dropdown', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('jobstatus-dropdown-btn')) return;

        document.querySelectorAll('.jobstatus-dropdown-btn[aria-expanded="true"]').forEach((other) => {
            if (other === btn) return;
            const inst = bootstrap.Dropdown.getInstance(other) || bootstrap.Dropdown.getOrCreateInstance(other);
            inst.hide();
        });
    });

    //get tokens
    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(
        apiHost,
        params.source,
        function ({ token: rToken, tokenexp: rExp }) {
            console.log("Fetched Beacon token," + rToken);
            setToken(rToken, rExp);
            myViewModel.tokenLoading(false);
        }
    );


    require(["knockout", "knockout-secure-binding"], function (komod, ksb) {
        ko = komod;

        // Show all options, more restricted setup than the Knockout regular binding.
        var options = {
            attribute: "data-bind",      // ignore legacy data-bind values
            globals: window,
            bindings: ko.bindingHandlers, // still use default binding handlers
            noVirtualElements: false
        };

        // Install all custom bindings
        installSlideVisibleBinding();
        installStatusFilterBindings();
        installRowVisibilityBindings();
        installDragDropRowBindings();
        noBubbleFromDisabledButtonsBindings();
        installSortableArrayBindings();

        ko.bindingProvider.instance = new ksb(options);
        window.ko = ko;
        ko.options.deferUpdates = true;
        myViewModel = new VM();

        ko.applyBindings(myViewModel);

        // Alerts overlay
        installAlerts(map, myViewModel);


        //show config modal on load
        const configModalEl = document.getElementById('configModal');
        bootstrap.Modal.getOrCreateInstance(configModalEl).show();

        installModalHotkeys({
            modalEl: configModalEl,
            onSave: () => myViewModel.config.saveAndCloseAndLoad(),
            onClose: () => myViewModel.config.saveAndCloseAndLoad(),
            allowInInputs: true // text-heavy modal
        });

        document.addEventListener("keydown", (e) => {
            // Cmd+K / Ctrl+K to open Spotlight Search
            const isK = (e.key || "").toLowerCase() === "k";
            if (!isK) return;

            const isCmd = e.metaKey === true;
            const isCtrl = e.ctrlKey === true;

            if (!(isCmd || isCtrl)) return;

            // don't stack if already open
            const open = document.getElementById("SpotlightSearchModal")?.classList.contains("show");
            if (open) return;

            e.preventDefault();
            myViewModel._openSpotlight();
        }, { capture: true });


        //large amount of bs to fix this chrome aria hidden warning that wont go away
        const configTrigger = () => document.querySelector('[data-bs-target="#configModal"]');

        // a guaranteed focusable sink outside the modal
        let focusSink = document.getElementById('focusSink');
        if (!focusSink) {
            focusSink = document.createElement('div');
            focusSink.id = 'focusSink';
            focusSink.tabIndex = -1;
            focusSink.style.position = 'fixed';
            focusSink.style.left = '-9999px';
            focusSink.style.top = '0';
            document.body.appendChild(focusSink);
        }

        // BEFORE Bootstrap applies aria-hidden
        configModalEl.addEventListener('hide.bs.modal', () => {
            const inst = bootstrap.Modal.getInstance(configModalEl) || bootstrap.Modal.getOrCreateInstance(configModalEl);

            // stop Bootstrap from forcing focus back into the modal (private API but works)
            inst?._focustrap?.deactivate?.();

            // get focus out of modal immediately
            document.activeElement?.blur?.();
            (configTrigger() || focusSink).focus();
        });

        // AFTER hidden, restore focus to the real trigger (optional)
        configModalEl.addEventListener('hidden.bs.modal', () => {
            configTrigger()?.focus();
        });

    })

    // Toggle submenu on click
    document.querySelectorAll('.dropdown-submenu > a').forEach(function (element) {
        element.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const submenu = this.nextElementSibling;
            if (!submenu) return;

            // Close any open sibling submenus
            const parentMenu = this.closest('.dropdown-menu');
            parentMenu.querySelectorAll('.dropdown-menu.show').forEach(function (openMenu) {
                if (openMenu !== submenu) {
                    openMenu.classList.remove('show');
                }
            });

            submenu.classList.toggle('show');
        });
    });

    // When the main dropdown closes, close all submenus
    document.querySelectorAll('.dropdown').forEach(function (dd) {
        dd.addEventListener('hidden.bs.dropdown', function () {
            this.querySelectorAll('.dropdown-menu.show').forEach(function (submenu) {
                submenu.classList.remove('show');
            });
        });
    });

})

// wait for full CSS + DOM
window.addEventListener('load', function () {
    document.body.style.opacity = '1';
});



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
