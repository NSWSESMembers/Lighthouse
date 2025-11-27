/* eslint-disable @typescript-eslint/no-this-alias */
global.jQuery = $;

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

require('../lib/shared_chrome_code.js'); // side-effect

import '../../../styles/pages/tasking.css';

import { ResizeDividers } from './resize.js';
import { addOrUpdateJobMarker, removeJobMarker } from './markers/jobMarker.js';
import { attachAssetMarker, detachAssetMarker } from './markers/assetMarker.js';
import { MapVM } from './viewmodels/Map.js';
import { OpsLogModalVM } from "./viewmodels/OpsLogModalVM.js";

import { JobTimeline } from "./viewmodels/JobTimeline.js";

import { CreateOpsLogModalVM } from "./viewmodels/OpsLogModalVM.js";
import { CreateRadioLogModalVM } from "./viewmodels/RadioLogModalVM.js";
import { Tag } from "./models/Tag.js";
import { UpdateTeamStatusDropdownVM } from './viewmodels/UpdateTeamStatusDropdownVM.js';

import { installAlerts } from './components/alerts.js';
import { LegendControl } from './components/legend.js';

import { Asset } from './models/Asset.js';
import { Tasking } from './models/Tasking.js';
import { Team } from './models/Team.js';
import { Job } from './models/Job.js';

import { canon } from './utils/common.js';
import { Enum } from './utils/enum.js';

import { ConfigVM } from './viewmodels/Config.js';

import { installSlideVisibleBinding } from "./bindings/slideVisible.js";
import { installStatusFilterBindings } from "./bindings/statusFilters.js";
import { installRowVisibilityBindings } from "./bindings/rowVisibility.js";
import { installDragDropRowBindings } from "./bindings/dragDropRows.js";

import { registerTransportCamerasLayer } from "./mapLayers/transport.js";
import { registerUnitBoundaryLayer } from "./mapLayers/geoservices.js";
import { registerTransportIncidentsLayer } from "./mapLayers/transport.js";

var $ = require('jquery');

var L = require('leaflet');

var esri = require('esri-leaflet');

var MiniMap = require('leaflet-minimap');


let token = '';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let tokenExp = '';

let resolveTokenReady;
const tokenReady = new Promise((resolve) => {
    resolveTokenReady = resolve;
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


require('leaflet-easybutton');
require('leaflet-routing-machine');
require('leaflet-svg-shape-markers');
require('lrm-graphhopper'); // Adds L.Routing.GraphHopper onto L.Routing
require('leaflet/dist/leaflet.css');



import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.



const params = getSearchParameters();
const apiHost = params.host

var ko;
var myViewModel;


/////////DATA REFRESH CODE   

// --- Leaflet map with Esri basemap
const map = L.map('map', {
    zoomControl: true, // 1 / 10th of the original zoom step
    zoomSnap: .5,
    // Faster debounce time while zooming
    wheelDebounceTime: 50
}).setView([-33.8688, 151.2093], 11);

var osm2 = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 0, maxZoom: 13 });
new MiniMap(osm2, { toggleDisplay: true }).addTo(map);

const legend = new LegendControl({ collapsed: false, persist: true });
legend.addTo(map);

ResizeDividers(map)

// Esri default basemap (others: 'Streets','Imagery','Topographic','Gray','DarkGray', etc.)
esri.basemapLayer('Topographic', { ignoreDeprecationWarning: true }).addTo(map);


function VM() {
    const self = this;

    const configDeps = {
        entitiesSearch: (q) => new Promise((resolve) => {
            BeaconClient.entities.search(q, apiHost, params.userId, token, (data) => resolve(data.Results || []));
        }),
        entitiesChildren: (parentId) => new Promise((resolve) => {
            BeaconClient.entities.children(parentId, apiHost, params.userId, token, (data) => resolve(data || []));
        })
    };

    self.mapVM = new MapVM(map, self);

    self.config = new ConfigVM(self, configDeps);

    // --- Polling layers ---
    registerTransportCamerasLayer(self, map, getToken, apiHost, params);
    registerUnitBoundaryLayer(self, map, getToken, apiHost, params);
    registerTransportIncidentsLayer(self, map, getToken, apiHost, params);


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
            c.innerHTML = `
      <button class="ld-toggle" title="Layers" aria-expanded="${this._open ? "true" : "false"}">
        <i class="fas fa-layer-group"></i>
      </button>
      <div class="ld-panel ${this._open ? "" : "d-none"}">
        <div class="ld-section">
          <div class="ld-title">Basemap</div>
          <div class="ld-list ld-bases"></div>
        </div>
        <div class="ld-section">
          <div class="ld-title">Overlays</div>
          <div class="ld-list ld-overlays"></div>
        </div>
      </div>
    `;

            // build basemap list
            const basemapNames = [
                { name: "Esri Topographic", esri: "Topographic" }, { name: "Esri Streets", esri: "Streets" }, { name: "Esri Imagery", esri: "Imagery" }, { name: "Esri Dark", esri: "DarkGray" },
            ];
            const basesEl = c.querySelector(".ld-bases");
            basemapNames.forEach(({ name, esri }) => {
                const id = `base-${esri}`;
                const row = document.createElement("label");
                row.className = "ld-row";
                row.innerHTML = `
        <input type="radio" name="esri-base" id="${id}" value="${esri}" ${esri === this._baseKey ? "checked" : ""}/>
        <span>${name}</span>
      `;
                basesEl.appendChild(row);
            });

            // apply initial basemap
            this._setBasemap(this._baseKey, map);

            basesEl.addEventListener("change", (e) => {
                const val = e.target?.value;
                if (!val) return;
                this._setBasemap(val, map);
                localStorage.setItem("map.base", val);
            });

            // build overlays from MapVM (vehicles, jobs, online services, etc.)
            const overlaysEl = c.querySelector(".ld-overlays");
            const overlayDefs = self.mapVM.getOverlayDefsForControl() || [];

            // Group by def.group (parent menu layer)
            const groups = new Map();
            overlayDefs.forEach(def => {
                const g = def.group || ''; // '' = ungrouped
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g).push(def);
            });

            groups.forEach((defs, groupKey) => {
                // Bootstrap-style sub heading for parent group
                if (groupKey) {
                    const heading = document.createElement("div");
                    heading.className = "text-muted text-uppercase fw-semibold small mt-2 mb-1";
                    heading.textContent = groupKey;
                    overlaysEl.appendChild(heading);
                }

                defs.forEach(({ key, label, layer }) => {
                    const id = `ov-${key}`;
                    const saved = localStorage.getItem(`ov.${key}`) !== "0"; // default on
                    if (saved) map.addLayer(layer);

                    const row = document.createElement("label");
                    row.className = "ld-row d-flex align-items-center gap-1";
                    row.innerHTML = `
            <input class="form-check-input m-0" type="checkbox" id="${id}" ${saved ? "checked" : ""}/>
            <span class="">${label}</span>
          `;
                    overlaysEl.appendChild(row);

                    row.querySelector("input").addEventListener("change", (e) => {
                        if (e.target.checked) {
                            map.addLayer(layer);
                            localStorage.setItem(`ov.${key}`, "1");
                        } else {
                            map.removeLayer(layer);
                            localStorage.setItem(`ov.${key}`, "0");
                        }
                    });
                });
            });


            // open/close toggle
            const btn = c.querySelector(".ld-toggle");
            const panel = c.querySelector(".ld-panel");
            L.DomEvent.on(btn, "click", (ev) => {
                L.DomEvent.stop(ev);
                const show = panel.classList.toggle("d-none");
                btn.setAttribute("aria-expanded", (!show).toString());
                localStorage.setItem("layers.open", show ? "0" : "1");
            });

            // don’t propagate scroll/drag
            L.DomEvent.disableClickPropagation(c);

            // nudge under the zoom buttons
            setTimeout(() => {
                const zoom = map._controlCorners.topleft.querySelector(".leaflet-control-zoom");
                if (zoom && c.parentElement === map._controlCorners.topleft) {
                    zoom.insertAdjacentElement("afterend", c);
                }
            }, 0);

            this._container = c;
            return c;
        },

        onRemove() { /* nothing to clean up */ },

        _setBasemap(name, map) {
            if (this._currentBase) map.removeLayer(this._currentBase);
            this._currentBase = esri.basemapLayer(name, { ignoreDeprecationWarning: true });
            this._currentBase.addTo(map);
        }
    });

    // create & add (after VM so we can pass it in)
    const layersDrawer = new LayersDrawer({ vm: myViewModel });
    layersDrawer.addTo(map);


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

    // Global collections
    self.teams = ko.observableArray();
    self.jobs = ko.observableArray();
    self.taskings = ko.observableArray();
    self.trackableAssets = ko.observableArray([]);

    self.allTags = ko.observableArray([]);

    ///opslog short cuts
    self.opsLogModalVM = new OpsLogModalVM(self);
    self.CreateOpsLogModalVM = new CreateOpsLogModalVM(self);
    self.CreateRadioLogModalVM = new CreateRadioLogModalVM(self);
    self.selectedJob = ko.observable(null);

    self.jobTimelineVM = new JobTimeline(self);

    // --- Team Status Update short cuts
    self.updateTeamStatusDropdownPopup = new UpdateTeamStatusDropdownVM(self);

    // --- TABLE SORTING MAGIC ---
    self.teamSortKey = ko.observable('callsign');
    self.teamSortAsc = ko.observable(true);
    self.jobSortKey = ko.observable('identifier');
    self.jobSortAsc = ko.observable(false);


    // --- sorted arrays ---
    self.sortedTeams = ko.pureComputed(function () {
        var key = self.teamSortKey(), asc = self.teamSortAsc();
        var arr = self.filteredTeams(); // existing
        return arr.slice().sort(function (a, b) {
            var av = ko.unwrap(a[key]), bv = ko.unwrap(b[key]);
            var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
            var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
            var cmp = (an && bn) ? (Number(av) - Number(bv))
                : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
            return asc ? cmp : -cmp;
        });
    });

    self.sortedJobs = ko.pureComputed(function () {
        var key = self.jobSortKey(), asc = self.jobSortAsc();
        var arr = self.filteredJobs();
        return arr.slice().sort(function (a, b) {
            var av = ko.unwrap(a[key]), bv = ko.unwrap(b[key]);
            var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
            var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
            var cmp = (an && bn) ? (Number(av) - Number(bv))
                : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
            return asc ? cmp : -cmp;
        });
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

    // --- (optional) initialize default icons on first render ---
    ko.tasks.schedule(function () {
        var thTeams = document.querySelector('.teams thead th.sortable[data-sort-key="' + self.teamSortKey() + '"]');
        if (thTeams) updateSortHeaderUI(thTeams, self.teamSortAsc());
        var thJobs = document.querySelector('.jobs thead th.sortable[data-sort-key="' + self.jobSortKey() + '"]');
        if (thJobs) updateSortHeaderUI(thJobs, self.jobSortAsc());
    });

    // --- END TABLE SORTING MAGIC ---

    //Job filtering/searching
    self.jobSearch = ko.observable('');

    self.filteredJobs = ko.pureComputed(() => {

        const hqsFilter = self.config.incidentFilters().map(f => ({ Id: f.id }));
        const term = self.jobSearch().toLowerCase();

        const allowedStatus = self.config.jobStatusFilter(); // allow-list
        const incidentTypeAllowed = self.config.incidentTypeFilter();

        return ko.utils.arrayFilter(this.jobs(), jb => {
            const statusName = jb.statusName();
            const hqMatch = hqsFilter.length === 0 || hqsFilter.some(f => f.Id === jb.entityAssignedTo.id());

            // If allow-list non-empty, only show jobs whose status is in it
            if (allowedStatus.length > 0 && !allowedStatus.includes(statusName)) {
                return false;
            }

            // If incident type filter non-empty, only show jobs whose type is in it
            if (incidentTypeAllowed.length > 0 && !incidentTypeAllowed.includes(jb.typeName())) {
                return false;
            }

            //must match HQ filter
            if (!hqMatch) return false;

            // Apply text search
            return (!term ||
                jb.identifier().toLowerCase().includes(term) ||
                jb.address.prettyAddress().toLowerCase().includes(term));
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });


    self.filteredJobsIgnoreSearch = ko.pureComputed(() => {

        const hqsFilter = self.config.incidentFilters().map(f => ({ Id: f.id }));
        const allowedStatus = self.config.jobStatusFilter(); // allow-list

        const incidentTypeAllowed = self.config.incidentTypeFilter();


        return ko.utils.arrayFilter(this.jobs(), jb => {

            const statusName = jb.statusName();

            // If allow-list non-empty, only show jobs whose status is in it
            if (allowedStatus.length > 0 && !allowedStatus.includes(statusName)) {
                return false;
            }

            // If incident type filter non-empty, only show jobs whose type is in it
            if (incidentTypeAllowed.length > 0 && !incidentTypeAllowed.includes(jb.typeName())) {
                return false;
            }

            // If no HQ filters are active, skip HQ filtering
            const hqMatch = hqsFilter.length === 0 || hqsFilter.some(f => f.Id === jb.entityAssignedTo.id());
            if (!hqMatch) return false;

            return true
        });
    }).extend({ trackArrayChanges: true });

    // Team filtering/searching
    self.teamSearch = ko.observable('');

    self.filteredTeams = ko.pureComputed(() => {

        const allowed = self.config.teamStatusFilter(); // allow-list

        return ko.utils.arrayFilter(self.teams(), tm => {
            const status = tm.status()?.Name;
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

            const term = self.teamSearch().toLowerCase();
            if (tm.callsign().toLowerCase().includes(term)) {
                return true;
            }

            return false;
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });



    self.filteredTrackableAssets = ko.pureComputed(() => {

        // No teams? Return nothing
        if (!self.trackableAssets) return [];



        return ko.utils.arrayFilter(self.trackableAssets() || [], a => {
            const teams = ko.unwrap(a.matchingTeams);
            if (!Array.isArray(teams) || teams.length === 0) return false;

            // Return true if at least one team's status() is not in ignoreList
            return teams.some(t => {
                const status = ko.unwrap(t.status);
                return status && !self.config.teamStatusFilter().includes(status) && t.isFilteredIn();
            });
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

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

            attachAndFillOpsLogModal: (job) => {
                self.attachOpsLogModal(job);
            },

            openRadioLogModal: (tasking) => {
                self.attachJobRadioLogModal(tasking);
            },

            openNewOpsLogModal: (job) => {
                self.attachNewOpsLogModal(job);
            },

            UpdateTeamStatusDropdown: (tasking, anchorE1) => {
                self.attachUpdateTeamStatusDropdown(tasking, anchorE1);
            },

            attachAndFillTimelineModal: (job) => {
                self.attachJobTimelineModal(job);
            },

            fetchUnacknowledgedJobNotifications: (job) => {
                self.fetchUnacknowledgedJobNotifications(job);
            },
            drawJobTargetRing: (job) => {
                self.drawJobTargetRing(job);
            },
        }
    }
    // Team registry/upsert - called from tasking OR team fetch so values might be missing
    self.getOrCreateTeam = function (teamJson) {
        if (!teamJson || teamJson.Id == null) return null;

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

            openRadioLogModal: (team) => {
                self.attachTeamRadioLogModal(team);
            },
            
            teamTaskStatusFilter: () => self.config.teamTaskStatusFilter(),

        };

        let team = self.teamsById.get(teamJson.Id);
        if (team) {
            team.updateFromJson(teamJson);
            self._refreshTeamTrackableAssets(team);
            return team;
        }

        team = new Team(teamJson, deps);
        self.teams.push(team);
        self.teamsById.set(team.id(), team);
        self._refreshTeamTrackableAssets(team);
        return team;
    };

    self.attachOpsLogModal = function (job) {
        const modalEl = document.getElementById('opsLogModal');
        const modal = new bootstrap.Modal(modalEl);

        self.selectedJob(job);
        self.opsLogModalVM.openForJob(job);
        modal.show();
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

        const vm = self.CreateRadioLogModalVM;

        vm.modalInstance = modal;

        vm.openForTasking(tasking);
        modal.show();
    };

    self.attachTeamRadioLogModal = function (team) {
        const modalEl = document.getElementById('RadioLogModal');
        const modal = new bootstrap.Modal(modalEl);

        const vm = self.CreateRadioLogModalVM;

        vm.modalInstance = modal;

        vm.openForTeam(team);
        modal.show();
    };

    self.attachNewOpsLogModal = function (job) {
        const modalEl = document.getElementById('CreateOpsLogModal');
        const modal = new bootstrap.Modal(modalEl);

        const vm = self.CreateOpsLogModalVM;

        vm.modalInstance = modal;

        vm.openForNewJobLog(job);
        modal.show();
    };

    self.attachUpdateTeamStatusDropdown = function (tasking, anchorE1) {
        self.updateTeamStatusDropdownPopup.openTeamStatusDropdown(tasking, anchorE1)
    };


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
        const list = team.trackableAssets();

        (self.trackableAssets() || []).forEach(a => {
            const has = list.find(x => x.id() === a.id())
            const match = self._assetMatchesTeam(a, team);
            if (match && !has) {
                team.trackableAssets.push(a);
                a.matchingTeams.push(team)
            }
            if (!match && has) {
                a.matchingTeams.remove(team)
                team.trackableAssets.remove(a);
            }
        });
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
        if (!taskingJson || taskingJson.Id == null) return null;

        // Resolve shared refs
        const jobRef = self.getOrCreateJob(taskingJson.Job);
        const teamRef = teamContext || self.getOrCreateTeam(taskingJson.Team);

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
        return t;
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
        self.mapVM.vehicleLayer.eachLayer(l => fg.addLayer(l));

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

    self.drawJobTargetRing = function (job) {
        if (!job || !job.address) return;
        self.mapVM.drawJobAssetDistanceRings(job);
    }

    self.fetchUnacknowledgedJobNotifications = async function (job) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.notifications.unaccepted(job.id(), apiHost, params.userId, t, function (data) {
            job.unacceptedNotifications(data);
        }, function (err) {
            console.error("Failed to fetch unacknowledged job notifications:", err);
        });
    }

    self.assignJobToTeam = async function (teamVm, jobVm) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.tasking.task(teamVm.id(), jobVm.id(), apiHost, params.userId, t, function () {
            jobVm.fetchTasking();
            teamVm.fetchTasking();
        })
    }

    //fetch tasking if a team is added
    self.filteredTeams.subscribe((changes) => {
        changes.forEach(ch => {
            if (ch.status === 'added') {
                ch.value.isFilteredIn(true);
                ch.value.fetchTasking();
            } else if (ch.status === 'deleted') {
                ch.value.isFilteredIn(false);
            }
        });
    }, null, "arrayChange");


    // automatically refresh markers when jobs change
    self.filteredJobsIgnoreSearch.subscribe((changes) => {
        changes.forEach(ch => {
            if (ch.status === 'added') {
                addOrUpdateJobMarker(ko, map, self, ch.value);
                ch.value.isFilteredIn(true);
            } else if (ch.status === 'deleted') {
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
    };

    self.attachAndFillOpsLogModal = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.operationslog.search(jobId, apiHost, params.userId, t, function (data) {
            cb(data?.Results || []);
        }, function (err) {
            console.error("Failed to fetch ops log for job:", err);
            cb([]);
        });
    }

    self.fetchOpsLogForJob = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.operationslog.search(jobId, apiHost, params.userId, t, function (data) {
            cb(data?.Results || []);
        }, function (err) {
            console.error("Failed to fetch ops log for job:", err);
            cb([]);
        });
    }

    self.fetchHistoryForJob = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.getHistory(jobId, apiHost, params.userId, t, function (data) {
            cb(data || []);
        }, function (err) {
            console.error("Failed to fetch history for job:", err);
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
            cb(null);
        });
    }

    self.updateTeamStatus = function (taskingId, status, payload, cb) {
        BeaconClient.tasking.updateTeamStatus(apiHost, taskingId, status, payload, token, function (data) {
            cb(data || []);
        }, function (err) {
            console.error("Failed to update team status:", err);
            cb([]);
        });
    }

    self.callOffTeam = function (taskingId, payload, cb) {
        BeaconClient.tasking.callOffTeam(apiHost, taskingId, payload, token, function (data) {
            cb(data || []);
        }, function (err) {
            console.error("Failed to call off team:", err);
            cb([]);
        });
    }

    self.untaskTeam = function (taskingId, payload, cb) {
        const form = BeaconClient.toFormUrlEncoded(payload);
        BeaconClient.tasking.untaskTeam(apiHost, taskingId, form, token, function (data) {
            cb(data);
        }, function (err) {
            console.error("Failed to create ops log entry:", err);
            cb(null);
        });
    }

    self.fetchJobById = async function (jobId, cb) {
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.get(jobId, 1, apiHost, params.userId, t,
            function (res) {
                if (res) {
                    self.getOrCreateJob(res);
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


    self.fetchAllTrackableAssets = async function () {
        if (!assetDataRefreshInterlock) {
            const t = await getToken();   // blocks here until token is ready
            BeaconClient.asset.filter('', apiHost, params.userId, t, function (assets) {
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
    }

    self.fetchAllJobsData = async function () {
        const hqsFilter = myViewModel.config.incidentFilters().map(f => ({ Id: f.id }));

        const statusFilterToView = myViewModel.config.jobStatusFilter().map(status => Enum.JobStatusType[status]?.Id).filter(id => id !== undefined);

        const incidentTypeFilterToView = myViewModel.config.incidentTypeFilter().map(type => Enum.IncidentType[type]?.Id).filter(id => id !== undefined);

        var end = new Date();
        var start = new Date();
        start.setDate(end.getDate() - 30); // last 30 days
        myViewModel.jobsLoading(true);
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.job.searchwithFilter(hqsFilter, apiHost, start, end, params.userId, t, function (allJobs) {
            console.log("Total jobs fetched:", allJobs.Results.length);
            myViewModel._markInitialFetchDone();
            myViewModel.jobsLoading(false);
        }, function (_val, _total) {
            //console.log("Progress: " + _val + " / " + _total)
        },
            1, //view model
            statusFilterToView, //status filter
            incidentTypeFilterToView, //incident type filter
            function (jobs) {
                jobs.Results.forEach(function (t) {
                    myViewModel.getOrCreateJob(t);
                })
            }
        )
    }

    self.fetchAllTeamData = async function () {
        const hqsFilter = this.config.teamFilters().map(f => ({ Id: f.id }));

        const statusFilterToView = myViewModel.config.teamStatusFilter().map(status => Enum.TeamStatusType[status]?.Id).filter(id => id !== undefined);
        var end = new Date();
        var start = new Date();
        start.setDate(end.getDate() - 30); // last 30 days
        myViewModel.teamsLoading(true);
        const t = await getToken();   // blocks here until token is ready
        BeaconClient.team.teamSearch(hqsFilter, apiHost, start, end, params.userId, t, function (teams) {
            // teams.Results.forEach(function (t) {
            //     myViewModel.getOrCreateTeam(t);
            // })
            console.log("Total teams fetched:", teams.Results.length);
            myViewModel._markInitialFetchDone();
            myViewModel.teamsLoading(false);

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

}

window.addEventListener('resize', () => map.invalidateSize());







document.addEventListener('DOMContentLoaded', function () {


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

        ko.bindingProvider.instance = new ksb(options);
        window.ko = ko;
        ko.options.deferUpdates = true;
        myViewModel = new VM();

        ko.applyBindings(myViewModel);

        // Alerts overlay
        installAlerts(map, myViewModel);


        //show config modal on load
        const el = document.getElementById('configModal');
        bootstrap.Modal.getOrCreateInstance(el).show();

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



    // wait for full CSS + DOM
    window.addEventListener('load', function () {
        document.body.style.opacity = '1';
    });

})

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