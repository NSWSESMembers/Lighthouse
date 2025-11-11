/* eslint-disable @typescript-eslint/no-this-alias */
global.jQuery = $;

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

require('../lib/shared_chrome_code.js'); // side-effect

import '../../../styles/pages/tasking.css';

import { ResizeDividers } from './resize.js';
import { addOrUpdateJobMarker, removeJobMarker } from './popups/jobMarker.js';
import { attachAssetMarker, detachAssetMarker } from './popups/assetMarker.js';
import { MapVM } from './viewmodels/Map.js';
import { OpsLogModalVM } from "./viewmodels/OpsLogModalVM.js";

import { installAlerts } from './components/alerts.js';



import { Asset } from './models/Asset.js';
import { Tasking } from './models/Tasking.js';
import { Team } from './models/Team.js';
import { Job } from './models/Job.js';

import { canon } from './utils/common.js';

import { ConfigVM } from './viewmodels/Config.js';

var $ = require('jquery');

var L = require('leaflet');
var esri = require('esri-leaflet');

var token = '';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var tokenExp = '';



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

var assetDataRefreshInterlock = false

var assetDataRefreshTimer = null

function startAssetDataRefreshTimer() {
    if (assetDataRefreshTimer) clearInterval(assetDataRefreshTimer);
    assetDataRefreshTimer = setInterval(() => {
        fetchAllTrackableAssets
    }, 10000);
};

startAssetDataRefreshTimer()




// --- Leaflet map with Esri basemap
const map = L.map('map', {
    zoomControl: true, // 1 / 10th of the original zoom step
    zoomSnap: .5,
    // Faster debounce time while zooming
    wheelDebounceTime: 50
}).setView([-33.8688, 151.2093], 11);


// Legend control (collapsible)
const LegendControl = L.Control.extend({
  options: { position: "bottomright", collapsed: false, persist: true },

  onAdd(map) {
    const div = L.DomUtil.create("div", "legend-container leaflet-bar");
    div.innerHTML = `
      <div class="legend-header d-flex justify-content-between align-items-center">
        <span class="fw-semibold">Legend</span>
        <button class="btn btn-sm btn-outline-secondary toggle-legend" type="button" aria-expanded="true">−</button>
      </div>
      <div class="legend-body mt-1">

    <div class="mb-2">
      <div class="fw-semibold small mb-1">Incident Type → Shape</div>
      <div class="d-flex flex-wrap gap-2 small align-items-center">
        <div><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#000" stroke-width="2"/></svg> Storm</div>
        <div><svg width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="2" ry="2" fill="none" stroke="#000" stroke-width="2"/></svg>Support</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" fill="none" stroke="#000" stroke-width="2"/></svg> Flood Rescue</div>
        <div><svg width="16" height="16"><polygon points="8,2 2,14 14,14" fill="none" stroke="#000" stroke-width="2"/></svg> Flood Support</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,8 8,14 2,8" fill="none" stroke="#000" stroke-width="2"/></svg> Rescue</div>
        <div><svg width="16" height="16"><polygon points="8,0 10,6 16,6 11,10 13,16 8,12 3,16 5,10 0,6 6,6" fill="none" stroke="#000" stroke-width="2"/></svg> Tsunami</div>
      </div>
    </div>

    <div class="mb-2">
      <div class="fw-semibold small mb-1">Priority → Fill</div>
      <div class="d-flex flex-wrap gap-2 small">
        <div><span class="legend-box" style="background:#FFA500"></span> Priority</div>
        <div><span class="legend-box" style="background:#4F92FF"></span> Immediate</div>
        <div><span class="legend-box" style="background:#FF0000"></span> Rescue</div>
        <div><span class="legend-box" style="background:#0fcb35ff"></span> General</div>
      </div>
    </div>

    <div>
      <div class="fw-semibold small mb-1">FR: Category → Fill</div>
      <div class="d-flex flex-wrap gap-2 small">
        <div><span class="legend-box" style="background:#7F1D1D"></span> Cat 1</div>
        <div><span class="legend-box" style="background:#DC2626"></span> Cat 2</div>
        <div><span class="legend-box" style="background:#EA580C"></span> Cat 3</div>
        <div><span class="legend-box" style="background:#EAB308"></span> Cat 4</div>
        <div><span class="legend-box" style="background:#16A34A"></span> Cat 5</div>
      </div>
    </div>


    <div>
      <div class="fw-semibold small mb-1">Overlays</div>
      <div class="d-flex flex-wrap gap-2 small legend-ring ">
        <div><div class="pulse-ring-icon"></div><svg  class="pulse-ring" width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#000" stroke-width="2"/></svg> Unacknowledged incident</div>
      </div>
    </div>
    </div>
    `;

    this._container = div;
    this._body = div.querySelector(".legend-body");
    this._btn = div.querySelector(".toggle-legend");

    // initial state
    const collapsed =
      this.options.persist &&
      localStorage.getItem("legendCollapsed") === "1"
        ? true
        : !!this.options.collapsed;
    this._setCollapsed(collapsed);

    // prevent map drag/zoom on click
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(this._btn, "click", this._toggle, this);

    return div;
  },

  onRemove() {
    if (this._btn) L.DomEvent.off(this._btn, "click", this._toggle, this);
  },

  _toggle(e) {
    L.DomEvent.stop(e);
    const hidden = this._body.classList.toggle("d-none");
    this._btn.textContent = hidden ? "+" : "−";
    this._btn.setAttribute("aria-expanded", String(!hidden));
    if (this.options.persist)
      localStorage.setItem("legendCollapsed", hidden ? "1" : "0");
  },

  _setCollapsed(collapsed) {
    if (!this._body || !this._btn) return;
    this._body.classList.toggle("d-none", collapsed);
    this._btn.textContent = collapsed ? "+" : "−";
    this._btn.setAttribute("aria-expanded", String(!collapsed));
  },
});

const legend = new LegendControl({ collapsed: false, persist: true });
legend.addTo(map);

ResizeDividers(map)

// Esri default basemap (others: 'Streets','Imagery','Topographic','Gray','DarkGray', etc.)
esri.basemapLayer('Topographic', { ignoreDeprecationWarning: true }).addTo(map);


function VM() {
    const self = this;

    self.mapVM = new MapVM(map, self);

    const configDeps = {
        entitiesSearch: (q) => new Promise((resolve) => {
            BeaconClient.entities.search(q, apiHost, params.userId, token, (data) => resolve(data.Results || []));
        }),
        entitiesChildren: (parentId) => new Promise((resolve) => {
            BeaconClient.entities.children(parentId, apiHost, params.userId, token, (data) => resolve(data || []));
        })
    };

    self.config = new ConfigVM(self, configDeps);

    self.tokenLoading = ko.observable(true);
    self.teamsLoading = ko.observable(true);
    self.jobsLoading = ko.observable(true);

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


    ///opslog short cuts
    self.opsLogModalVM = new OpsLogModalVM(self);
    self.selectedJob = ko.observable(null);


    // filters for what teams to ignore
    self.teamStatusFilterList = ko.observableArray([
        "Standby",
        "Stood down"
    ]);

    //filters for what jobs to ignore
    self.jobsStatusFilterList = ko.observableArray([
        "Finalised",
        "Cancelled",
        "Complete"
    ])

    //Job filtering/searching
    self.jobSearch = ko.observable('');

    self.filteredJobs = ko.pureComputed(() => {

        const hqsFilter = myViewModel.config.incidentFilters().map(f => ({ Id: f.id }));
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

        const ignoreList = self.jobsStatusFilterList();
        const hqsFilter = self.config.incidentFilters().map(f => ({ Id: f.id }));

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

    // Team filtering/searching
    self.teamSearch = ko.observable('');

    self.filteredTeams = ko.pureComputed(() => {
        return ko.utils.arrayFilter(this.teams(), tm => {
            if (tm.status() == null) {
                return false
            }
            if (self.teamStatusFilterList().includes(tm.status())) {
                return false
            }
            const term = self.teamSearch().toLowerCase();
            if (tm.callsign().toLowerCase().includes(term)) {
                return true
            }
            return false
        })
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
                return status && !self.teamStatusFilterList().includes(status);
            });
        });
    }).extend({ trackArrayChanges: true, rateLimit: 50 });

    function makeJobDeps() {
        return {
            makeJobLink: (id) => `${params.source}/Jobs/${id}`,

            fetchJobTasking: (jobId, cb) => {
                BeaconClient.job.getTasking(jobId, apiHost, params.userId, token, (res) => {
                    (res?.Results || []).forEach(t => myViewModel.upsertTaskingFromPayload((t)));
                    cb(true);
                }, (err) => {
                    console.error("Failed to fetch job tasking:", err);
                    cb(false);
                });
            },

            fetchJobById: (jobId) =>
                new Promise((resolve, reject) => {
                    BeaconClient.job.get(jobId, 1, apiHost, params.userId, token,
                        r => resolve(r),
                        e => reject(e)
                    );
                }),

            flyToJob: (job) => {
                const lat = job.address.latitude?.();
                const lng = job.address.longitude?.();
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    map.flyTo([lat, lng], 16, { animate: true, duration: 0.10 });
                    job.marker?.openPopup?.();
                }
            },

            attachAndFillOpsLogModal: (job) => {
                attachOpsLogModal(job);
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
            }
        };

        let team = self.teamsById.get(teamJson.Id);
        if (team) {
            team.callsign(teamJson.Callsign ?? team.callsign());
            if (teamJson.CurrentStatusId != null) team.updateStatusById(teamJson.CurrentStatusId);
            else team.status(teamJson.TeamStatusType || team.status());
            team.members = ko.observableArray(teamJson.Members);
            self._refreshTeamTrackableAssets(team);
            return team;
        }

        team = new Team(teamJson, deps);
        self.teams.push(team);
        self.teamsById.set(team.id(), team);
        self._refreshTeamTrackableAssets(team);
        return team;
    };

    // Job registry/upsert
    self.getOrCreateJob = function (jobJson) {
        const deps = makeJobDeps();
        let job = this.jobsById.get(jobJson.Id);
        if (job) {
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
            console.log("Updating existing tasking:", t.id());
            t.updateFrom(taskingJson); //update the tasking inplace
        } else {
            console.log("Creating new tasking:", taskingJson.Id);
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
        console.log("Initial fetch done, remaining:", initialFetchesPending - 1);
        if (initialFetchesPending > 0) {
            initialFetchesPending -= 1;
            // Give subscriptions time to attach markers, then attempt fit
            tryInitialFit();
        }
    };

    self._linkTaskingAndJob = function (tasking, job) {
        console.log("Linking tasking:", tasking.id(), "with job:", job.id());
        if (!tasking) return;
        const prev = tasking.job && tasking.job.id && tasking.job || null; // current job ref
        if (prev && prev.id() !== job.id()) {
            console.log("Previous job does not match the new job");
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

    self.assignJobToTeam = function (teamVm, jobVm) {
        BeaconClient.tasking.task(teamVm.id(), jobVm.id(), apiHost, params.userId, token, function () {
            jobVm.fetchTasking();
            teamVm.fetchTasking();
        })
    }

    //fetch tasking if a team is added
    self.filteredTeams.subscribe((data) => {
        data.forEach(change => {
            if (change.status === 'added') {
                change.value.fetchTasking()
            }
        });
    }, null, "arrayChange");


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

    self.showConfirmTaskingModal = function (jobVm, teamVm) {
        console.log(jobVm, teamVm);
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

    self.attachAndFillOpsLogModal = function (jobId, cb) {
        BeaconClient.operationslog.search(jobId, apiHost, params.userId, token, function (data) {
            cb(data?.Results || []);
        }, function (err) {
            console.error("Failed to fetch ops log for job:", err);
            cb([]);
        });
    }

    self.fetchOpsLogForJob = function (jobId, cb) {
        BeaconClient.operationslog.search(jobId, apiHost, params.userId, token, function (data) {
            cb(data?.Results || []);
        }, function (err) {
            console.error("Failed to fetch ops log for job:", err);
            cb([]);
        });
    }


    self.fetchAllTeamData = fetchAllTeamData;
    self.fetchAllJobsData = fetchAllJobsData;
    self.fetchAllTrackableAssets = fetchAllTrackableAssets;

    chrome.runtime.sendMessage({ type: "tasking" });
}

window.addEventListener('resize', () => map.invalidateSize());

function fetchAllTeamData() {
    const hqsFilter = this.config.teamFilters().map(f => ({ Id: f.id }));
    console.log("Fetching teams for HQS:", hqsFilter);

    var end = new Date();
    var start = new Date();
    start.setDate(end.getDate() - 30); // last 7 days
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
}

function fetchAllJobsData() {
    const hqsFilter = myViewModel.config.incidentFilters().map(f => ({ Id: f.id }));
    console.log("Fetching jobs for HQS:", hqsFilter);

    var end = new Date();
    var start = new Date();
    start.setDate(end.getDate() - 30); // last 30 days
    myViewModel.jobsLoading(true);
    BeaconClient.job.searchwithStatusFilter(hqsFilter, apiHost, start, end, params.userId, token, function (allJobs) {
        console.log("Total jobs fetched:", allJobs.Results.length);
        myViewModel._markInitialFetchDone();
        myViewModel.jobsLoading(false);
    }, function (val, total) {
        console.log("Progress: " + val + " / " + total)
    },
        1, //view model
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
                    ctx.$root.showConfirmTaskingModal(jobVm, teamVm);

                });
            }
        };

        ko.bindingProvider.instance = new ksb(options);
        window.ko = ko;
        ko.options.deferUpdates = true;
        myViewModel = new VM();

        ko.applyBindings(myViewModel);

        // Alerts overlay
        installAlerts(map, myViewModel);

        //get tokens
        BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(apiHost, params.source, function ({ token: rToken, tokenexp: rExp }) {
            console.log("Fetched Beacon token," + rToken);
            token = rToken;
            tokenExp = rExp;
            myViewModel.tokenLoading(false);
        })


        //show config modal on load
        const el = document.getElementById('configModal');
        bootstrap.Modal.getOrCreateInstance(el).show();

    })






})

function attachOpsLogModal(job) {
    const modalEl = document.getElementById('opsLogModal');
    const modal = new bootstrap.Modal(modalEl);

    myViewModel.selectedJob(job);
    myViewModel.opsLogModalVM.openForJob(job);
    modal.show();
}

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