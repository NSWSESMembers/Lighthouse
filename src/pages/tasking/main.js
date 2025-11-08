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

import { Asset } from './models/Asset.js';
import { Tasking } from './models/Tasking.js';
import { Team } from './models/Team.js';
import { Job } from './models/Job.js';

import { canon } from './utils/common.js';

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

require('bootstrap5'); // for jq plugin: modal



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

const teamLocationFilter = new Map();
const incidentLocationFilter = new Map();



// --- Leaflet map with Esri basemap
const map = L.map('map', {
    zoomControl: true, // 1 / 10th of the original zoom step
    zoomSnap: .5,
    // Faster debounce time while zooming
    wheelDebounceTime: 50
}).setView([-33.8688, 151.2093], 11);

ResizeDividers(map)

// Esri default basemap (others: 'Streets','Imagery','Topographic','Gray','DarkGray', etc.)
esri.basemapLayer('Topographic', { ignoreDeprecationWarning: true }).addTo(map);


function VM() {
    const self = this;

    self.mapVM = new MapVM(map, self);

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

        const ignoreList = self.jobsStatusFilterList();

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
            }
        };
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
        console.log("Upserting tasking from payload:", taskingJson);
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

}

window.addEventListener('resize', () => map.invalidateSize());


function fetchAllTeamData() {
    const hqsFilter = Array.from(teamLocationFilter.values()).map(f => ({ Id: f.id }));
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
    const hqsFilter = Array.from(incidentLocationFilter.values()).map(f => ({ Id: f.id }));
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
        6, //view model
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
    })


    //get tokens
    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(apiHost, params.source, function ({ token: rToken, tokenexp: rExp }) {
        console.log("Fetched Beacon token," + rToken);
        token = rToken;
        tokenExp = rExp;
        myViewModel.tokenLoading(false);
    })



    // Config Modal Stuff

    const modal = new bootstrap.Modal($('#configModal')[0]);
    modal.show();

    $(document).on('click', (e) => {
        if (!$(e.target).closest('.dropdown').length) {
            $('#searchDropdown').removeClass('show');
        }
    });

    const $search = $('#locationSearch');

    const $save = $('#saveConfig');

    const $teamFilterList = $('#teamFilterList');
    const $incidentFilterList = $('#incidentFilterList');
    const $clearTeams = $('#clearTeams');
    const $clearIncidents = $('#clearIncidents');

    let searchTimer = null;
    let abortCtrl = null;

    function norm(item) {
        return {
            id: item?.id ?? item?.code ?? item?.value ?? String(item),
            name: item?.name ?? item?.label ?? item?.fullName ?? String(item),
            entityType: item?.entityType ?? String(item)
        };
    }

    function renderResults(items) {
        const $menu = $('#searchDropdown');
        $menu.empty();

        if (!items.length) {
            $menu.append('<li><button class="dropdown-item disabled">No results</button></li>');
            $menu.addClass('show');
            return;
        }

        items.forEach(raw => {
            const item = norm(raw);
            const html = `
      <li>
        <div class="d-flex justify-content-between align-items-center px-2">
          <span class="dropdown-item-text text-truncate" title="${item.name}">${item.name}</span>
          <div class="btn-group btn-group-sm ms-2">
            <button class="btn btn-outline-primary" data-action="add-team">Filter Teams</button>
            <button class="btn btn-outline-success" data-action="add-incident">Filter Incidents</button>
          </div>
        </div>
      </li>`;
            const $row = $(html).data('payload', item);
            $menu.append($row);
        });

        $menu.addClass('show');
    }

    function pillHtml(item, type) {
        const sitemapButton = item.entityType == 2
            ? `<button type="button" class="btn btn-sm btn-outline-light me-1 btn-load-children" title="Load Children">
         <i class="fa fa-sitemap" aria-hidden="true"></i>
       </button>`
            : '';

        return $(`
    <span class="badge text-bg-${type === 'team' ? 'primary' : 'success'} pill d-inline-flex align-items-center" data-id="${item.id}">
      <span class="me-1">${item.name}</span>
      ${sitemapButton}
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
              $('#searchDropdown').removeClass('show');

            renderResults([]);
            return;
        }

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();
        BeaconClient.entities.search(query, apiHost, params.userId, token, function (data) {
            renderResults(data.Results.map(e => ({ id: e.Id, name: e.Name, entityType: e.EntityTypeId })));
            abortCtrl = null;
        })
    }

    function ReturnChildren(parentId, type) {
        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();
        BeaconClient.entities.children(parentId, apiHost, params.userId, token, function (data) {
            data.forEach(item => {
                const normItem = norm({ id: item.Id, name: item.Name, entityType: item.EntityTypeId });
                if (type === 'team') {
                    addTeam(normItem);
                } else if (type === 'incident') {
                    addIncident(normItem);
                }
            });
            abortCtrl = null;
        })
    }


    // Search input with debounce
    $search.on('input', function () {
        
        clearTimeout(searchTimer);
        const q = this.value;
        searchTimer = setTimeout(() => searchAPI(q), 300);
    });

$('#clearSearch').on('click', function () {
  $('#searchDropdown').removeClass('show');
});

    // Clicks on results (event delegation)
    $('#searchDropdown').on('click', 'button[data-action]', function () {
        const $row = $(this).closest('li');
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

    //Load Children buttons on pills
    $teamFilterList.on('click', '.pill .btn-load-children', function () {
        const id = $(this).closest('.pill').data('id');
        console.log("Load children for HQ id:", id);
        ReturnChildren(id, 'team');

    });
    $incidentFilterList.on('click', '.pill .btn-load-children', function () {
        const id = $(this).closest('.pill').data('id');
        console.log("Load children for HQ id:", id);
        ReturnChildren(id, 'incident');
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
        fetchAllTrackableAssets();
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

