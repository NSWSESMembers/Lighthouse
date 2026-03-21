/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';

import * as bootstrap from 'bootstrap5'; // Modal, Tooltip, etc.
import { Enum } from '../utils/enum.js';



const FUNCTION_URL = "https://lambda.lighthouse-extension.com/lad/share";



export function ConfigVM(root, deps) {
    const self = this;

    // UI state
    self.query = ko.observable('');
    self.results = ko.observableArray([]);
    self.searching = ko.observable(false);
    self.dropdownOpen = ko.observable(false);
    self.inputHasFocus = ko.observable(false);

    // Share / load shared config state
    self.shareId = ko.observable('');          // last successful share key
    self.shareError = ko.observable('');       // error message (if any)
    self.sharing = ko.observable(false);       // POST in progress
    self.loadingShared = ko.observable(false); // GET in progress
    self.shareKeyInput = ko.observable('');    // bound to header input
    self.loadExpanded = ko.observable(false);

    // Selected location filters
    self.teamFilters = ko.observableArray([]);     // [{id, name, entityType}]
    self.incidentFilters = ko.observableArray([]); // [{id, name, entityType}]
    self.allowedIncidentTypeIds = ko.pureComputed(() =>
        new Set(self.incidentTypeFilter()
            .map(t => Enum.IncidentType[t]?.Id)
            .filter(Boolean))
    );

    //Sectors
    self.sectorFilters = ko.observableArray([]);   // [{id, name}]
    self.includeIncidentsWithoutSector = ko.observable(true);
    self.applySectorsToIncidents = ko.observable(false);
    self.applySectorsToTeams = ko.observable(false);

    //Map layer order

    self.paneDefs = [
        { id: 'pane-tippy-top', name: 'Incident markers' },
        { id: 'pane-top', name: 'Asset markers' },
        { id: 'pane-middle', name: 'Map overlays icons & labels' },
        { id: 'pane-lowest', name: 'Map overlay polygons & drawings' }
    ];

    // UI list (objects so bindings are property-only)
    self.paneOrder = ko.observableArray(self.paneDefs.map(p => ({ id: p.id, name: p.name })));

    self.rebuildPaneOrderFromIds = function (ids) {
        const byId = new Map(self.paneDefs.map(p => [p.id, p]));
        const list = (ids || [])
            .map(id => byId.get(id))
            .filter(Boolean)
            .map(p => ({ id: p.id, name: p.name }));

        // ensure all panes exist (append any missing)
        self.paneDefs.forEach(p => {
            if (!list.some(x => x.id === p.id)) list.push({ id: p.id, name: p.name });
        });

        self.paneOrder(list);
    }

    // Other settings
    self.refreshInterval = ko.observable(60);
    // Guard for reckless refresh interval changes
    let lastRefreshInterval = self.refreshInterval();
    let suppressRecklessModal = false;
    self.refreshInterval.subscribe(function(newVal) {
        if (suppressRecklessModal) {
            lastRefreshInterval = newVal;
            return;
        }
        // Only trigger if the value is being changed to something different
        if (Number(newVal) !== Number(lastRefreshInterval)) {
            showRecklessModal({
                onConfirm: () => {
                    lastRefreshInterval = newVal;
                },
                onCancel: () => {
                    // Revert to previous value
                    suppressRecklessModal = true;
                    self.refreshInterval(lastRefreshInterval);
                    suppressRecklessModal = false;
                }
            });
        }
    });

    // Modal logic for reckless confirmation
    function showRecklessModal({ onConfirm, onCancel }) {
        // Create modal HTML if not present
        let modal = document.getElementById('recklessModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'recklessModal';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                  <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                      <h5 class="modal-title">Are you sure?</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                      <p>Changing the refresh interval can have unintended consequences. To proceed, type <b>reckless</b> below and press Confirm.</p>
                      <input id="recklessInput" type="text" class="form-control" placeholder="Type 'reckless' to confirm">
                      <div id="recklessError" class="text-danger mt-2" style="display:none;">You must type 'reckless' to confirm.</div>
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="recklessCancel">Cancel</button>
                      <button type="button" class="btn btn-danger" id="recklessConfirm">Confirm</button>
                    </div>
                  </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
        bsModal.show();

        // Reset input and error
        const input = modal.querySelector('#recklessInput');
        const error = modal.querySelector('#recklessError');
        input.value = '';
        error.style.display = 'none';
        input.focus();

        // Remove previous listeners
        const confirmBtn = modal.querySelector('#recklessConfirm');
        const cancelBtn = modal.querySelector('#recklessCancel');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        confirmBtn.onclick = function() {
            if (input.value.trim().toLowerCase() === 'reckless') {
                bsModal.hide();
                onConfirm && onConfirm();
            } else {
                error.style.display = '';
                input.focus();
            }
        };
        cancelBtn.onclick = function() {
            bsModal.hide();
            onCancel && onCancel();
        };
        // Also handle modal close (X button)
        modal.querySelector('.btn-close').onclick = function() {
            bsModal.hide();
            onCancel && onCancel();
        };
    }
    self.fetchPeriod = ko.observable(7).extend({ min: 0, max: 31, digit: true });
    self.fetchForward = ko.observable(0).extend({ min: 0, max: 31, digit: true });
    self.showAdvanced = ko.observable(false);
    self.darkMode = ko.observable(false);

    //blown away on load
    self.teamStatusFilter = ko.observableArray([]);

    //blown away on load
    self.jobStatusFilter = ko.observableArray([]);

    self.incidentTypeFilter = ko.observableArray([]);


    self.teamTaskStatusFilter = ko.observableArray([]);

    // Map clustering
    self.clusterEnabled = ko.observable(true);
    self.clusterRadius = ko.observable(60);   // maxClusterRadius in px (10–80)
    self.clusterRescueJobs = ko.observable(true);
    self.alertsCollapsibleRules = ko.observable(true);

    // pinned rows
    self.pinnedTeamIds = ko.observableArray([]);
    self.pinnedIncidentIds = ko.observableArray([]);

    // ── Instant Task Suggestion Engine ──
    self.suggestionEnabled = ko.observable(true);
    self.rescueDistanceWeight = ko.observable(90);
    self.rescueTaskingWeight = ko.observable(10);
    self.normalDistanceWeight = ko.observable(50);
    self.normalTaskingWeight = ko.observable(50);

    /**
     * When true, the suggestion engine fetches road travel times from
     * Amazon Location Service to rank teams by actual driving time
     * instead of crow-flies distance.
     * @type {ko.Observable<boolean>}
     */
    self.suggestionUseRouting = ko.observable(false);

    // Keep rescue sliders summing to ~100 (optional visual aid)
    self.rescueDistanceWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.rescueDistanceWeight()) || 0;
        const t = Number(self.rescueTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(d / total * 100);
    });
    self.rescueTaskingWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.rescueDistanceWeight()) || 0;
        const t = Number(self.rescueTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(t / total * 100);
    });
    self.normalDistanceWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.normalDistanceWeight()) || 0;
        const t = Number(self.normalTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(d / total * 100);
    });
    self.normalTaskingWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.normalDistanceWeight()) || 0;
        const t = Number(self.normalTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(t / total * 100);
    });

    // Dark mode helper (defined early so it can be called in afterConfigLoad)
    self._applyDarkMode = () => {
        if (self.darkMode()) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };


    self.openLoadBox = function () {
        self.loadExpanded(true);
    };

    self.closeLoadBox = function () {
        self.loadExpanded(false);
        self.shareKeyInput("");
    };

    self.teamTaskStatusFilterDefaults = [
        "Tasked",
        "Onsite",
        "Offsite",
        "Enroute",
    ];

    self.jobStatusFilterDefaults = [
        "Active", "New", "Tasked"
    ];

    self.teamStatusFilterDefaults = [
        "Activated"
    ];

    self.incidentTypeFilterDefaults = [
        "Tsunami",
        "Other",
        "Transport",
        "WelfareCheck",
        "EvacuationSecondary",
        "EvacuationPriority",
        "FloodMisc",
        "VetAssistance",
        "FodderDrop",
        "MedicalResupply",
        "Resupply",
        "LAR",
        "VR",
        "CFR",
        "GLR",
        "RCR",
        "FR",
        "Support",
        "Storm"
    ]



    // Build the current config payload (used by save + share)
    const buildConfig = () => ({
        refreshInterval: Number(self.refreshInterval()),
        fetchPeriod: Number(self.fetchPeriod()),
        fetchForward: Number(self.fetchForward()),
        showAdvanced: !!self.showAdvanced(),
        darkMode: !!self.darkMode(),
        locationFilters: {
            teams: ko.toJS(self.teamFilters),
            incidents: ko.toJS(self.incidentFilters)
        },
        // these are your “ignored” statuses used by filters
        teamStatusFilter: ko.toJS(self.teamStatusFilter),
        jobStatusFilter: ko.toJS(self.jobStatusFilter),
        incidentTypeFilter: ko.toJS(self.incidentTypeFilter),
        teamTaskStatusFilter: ko.toJS(self.teamTaskStatusFilter),
        sectorFilters: ko.toJS(self.sectorFilters),
        includeIncidentsWithoutSector: !!self.includeIncidentsWithoutSector(),
        applySectorsToIncidents: !!self.applySectorsToIncidents(),
        applySectorsToTeams: !!self.applySectorsToTeams(),
        pinnedTeamIds: ko.toJS(self.pinnedTeamIds),
        pinnedIncidentIds: ko.toJS(self.pinnedIncidentIds),
        paneOrder: self.paneOrder().map(p => p.id),
        clusterEnabled: !!self.clusterEnabled(),
        clusterRadius: Number(self.clusterRadius()) || 60,
        clusterRescueJobs: !!self.clusterRescueJobs(),
        alertsCollapsibleRules: !!self.alertsCollapsibleRules(),
        suggestionEnabled: !!self.suggestionEnabled(),
        rescueDistanceWeight: Number(self.rescueDistanceWeight()) || 0,
        rescueTaskingWeight: Number(self.rescueTaskingWeight()) || 0,
        normalDistanceWeight: Number(self.normalDistanceWeight()) || 0,
        normalTaskingWeight: Number(self.normalTaskingWeight()) || 0,
        suggestionUseRouting: !!self.suggestionUseRouting(),
    });

    // Helpers
    const norm = (item) => ({
        id: item?.id ?? item?.Id ?? item?.code ?? String(item),
        name: item?.name ?? item?.Name ?? item?.label ?? item?.fullName ?? String(item),
        entityType: item?.entityType ?? item?.EntityTypeId ?? 0
    });


    function makeResultVM(raw) {
        const r = norm(raw);
        r.teamSelected = ko.pureComputed(function () {
            return self.teamFilters().some(function (t) { return t.id === r.id; });
        });
        r.incidentSelected = ko.pureComputed(function () {
            return self.incidentFilters().some(function (i) { return i.id === r.id; });
        });
        return r;
    }

    const upsert = (arr, item) => {
        const exists = arr().some(x => x.id === item.id);
        if (!exists) arr.push(item);
        if (exists) arr.remove(x => x.id === item.id);
    };
    const removeById = (arr, id) => arr.remove(x => x.id === id);

    self.clearTeams = () => self.teamFilters.removeAll();
    self.clearIncidents = () => self.incidentFilters.removeAll();
    self.clearSectors = () => self.sectorFilters.removeAll();

    // Search (debounced)
    let searchSeq = 0;

    self.query
        .extend({ rateLimit: { timeout: 300, method: 'notifyWhenChangesStop' } })
        .subscribe(q => {
            const t = (q || '').trim();
            if (!t) {
                searchSeq++;
                self.searching(false);
                self.results([]);
                self.dropdownOpen(false);
                return;
            }

            const mySeq = ++searchSeq;

            // show dropdown immediately with loading state + clear old results
            self.results([]);
            self.dropdownOpen(true);
            self.searching(true);

            deps.entitiesSearch(t)
                .then(list => {
                    if (mySeq !== searchSeq) return; // ignore stale responses
                    self.results(list.map(e => makeResultVM({ id: e.Id, name: e.Name, entityType: e.EntityTypeId })));
                    self.dropdownOpen(true);
                })
                .catch(() => {
                    if (mySeq !== searchSeq) return;
                    self.results([]);      // triggers "No results found."
                    self.dropdownOpen(true);
                })
                .finally(() => {
                    if (mySeq === searchSeq) self.searching(false);
                });
        });


    // Actions from results
    self.addTeam = (item, ev) => {
        upsert(self.teamFilters, norm(item));
        // keep dropdown open and focus back to the input so typing can continue
        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();
    };
    self.addIncident = (item, ev) => {
        upsert(self.incidentFilters, norm(item));
        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();
    };

    self.addTeamAndIncident = (item, ev) => {

        //force add to both if doesnt exist, dont remove if it does
        const n = norm(item);

        const teamExists = self.teamFilters().some(x => x.id === n.id);
        if (!teamExists) self.teamFilters.push(n);

        const incidentExists = self.incidentFilters().some(x => x.id === n.id);
        if (!incidentExists) self.incidentFilters.push(n);

        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();

    }

    // Pills
    self.removeTeam = (item) => removeById(self.teamFilters, item.id);
    self.removeIncident = (item) => removeById(self.incidentFilters, item.id);

    self.loadChildrenForTeam = (item) => deps.entitiesChildren(item.id).then(children => {
        children.forEach(c => upsert(self.teamFilters, norm({ id: c.Id, name: c.Name, entityType: c.EntityTypeId })));
    });
    self.loadChildrenForIncident = (item) => deps.entitiesChildren(item.id).then(children => {
        children.forEach(c => upsert(self.incidentFilters, norm({ id: c.Id, name: c.Name, entityType: c.EntityTypeId })));
    });

    // Clear/search UI
    self.clearSearch = () => { self.query(''); self.results([]); self.dropdownOpen(false); };


    self.clearPinnedTeams = () => {
        self.pinnedTeamIds.removeAll();
        self.save();
    };

    self.clearPinnedIncidents = () => {
        self.pinnedIncidentIds.removeAll();
        self.save();
    };

    self.clearAllPinned = () => {
        self.pinnedTeamIds.removeAll();
        self.pinnedIncidentIds.removeAll();
        self.save();
    };


    // Only close if focus moved *outside* the dropdown
    self.closeDropdown = (_data, ev) => {
        const dd = document.getElementById('searchDropdown');
        const next = ev?.relatedTarget || document.activeElement;
        if (dd && next && dd.contains(next)) {
            // Focus is moving into the dropdown (e.g., clicking a button) – keep it open
            return true;
        }
        window.setTimeout(function () {
            self.dropdownOpen(false);
        }, 150);
        return true;
    };


    // Persistence
    const STORAGE_KEY = 'lh-taskingConfig';

    self.save = () => {
        const cfg = buildConfig();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));

    };

    self.saveAndCloseAndLoad = () => {
        
        self.save();

        root.UserPressedSaveOnTheConfigModal()

        // Close the Bootstrap modal
        const el = document.getElementById('configModal');
        const m = bootstrap.Modal.getOrCreateInstance(el);
        m.hide();
    }

    self.saveAndLoadJobData = () => {
        self.save();
        root.fetchAllJobsData();
        return true;
    }

    self.saveAndLoadTeamData = () => {
        self.save();
        root.fetchAllTeamData();
        return true;
    }




    self.loadFromStorage = () => {
        suppressRecklessModal = true;
        const saved = localStorage.getItem(STORAGE_KEY);
        let cfg;
        try {
            cfg = JSON.parse(saved);
        } catch (e) {
            console.warn('Failed to parse lh-taskingConfig:', e);
            return;
        }
        if (!cfg) {
            cfg = {}
            console.log('Using defaults.');
            cfg.refreshInterval = self.refreshInterval();
            cfg.fetchPeriod = self.fetchPeriod();
            cfg.fetchForward = self.fetchForward();
            cfg.showAdvanced = self.showAdvanced();
            cfg.teamStatusFilter = self.teamStatusFilterDefaults;
            cfg.jobStatusFilter = self.jobStatusFilterDefaults;
            cfg.incidentTypeFilter = self.incidentTypeFilterDefaults;
            cfg.teamTaskStatusFilter = self.teamTaskStatusFilterDefaults;
            cfg.sectorFilters = [];
            cfg.includeIncidentsWithoutSector = true;
            cfg.applySectorsToIncidents = false;
            cfg.applySectorsToTeams = false;
            cfg.pinnedTeamIds = [];
            cfg.pinnedIncidentIds = [];

            // Extract HQ ID from URL if present
            const search = window.location?.search || '';
            const hqMatch = search.match(/hq=(\d+)/);
            if (hqMatch) {
                const hqId = hqMatch[1];
                deps.entity(hqId).then(result => {
                    if (result) {
                        const normEntity = norm({ id: result.Id, name: result.Name, entityType: result.EntityTypeId });
                        self.incidentFilters([normEntity]);
                        self.teamFilters([normEntity]);
                    }
                });
            }
        }
        // scalar settings
        if (typeof cfg.refreshInterval === 'number') {
            self.refreshInterval(cfg.refreshInterval);
            lastRefreshInterval = cfg.refreshInterval;
        }
        if (typeof cfg.fetchPeriod === 'number') {
            self.fetchPeriod(cfg.fetchPeriod);
        }
        if (typeof cfg.fetchForward === 'number') {
            self.fetchForward(cfg.fetchForward);
        }
        if (typeof cfg.showAdvanced === 'boolean') {
            self.showAdvanced(cfg.showAdvanced);
        }
        if (typeof cfg.darkMode === 'boolean') {
            self.darkMode(cfg.darkMode);
        }
        if (typeof cfg.includeIncidentsWithoutSector === 'boolean') {
            self.includeIncidentsWithoutSector(cfg.includeIncidentsWithoutSector);
        }
        if (typeof cfg.applySectorsToIncidents === 'boolean') {
            self.applySectorsToIncidents(cfg.applySectorsToIncidents);
        }
        if (typeof cfg.applySectorsToTeams === 'boolean') {
            self.applySectorsToTeams(cfg.applySectorsToTeams);
        }

        // filters
        if (cfg.locationFilters) {
            self.teamFilters(cfg.locationFilters.teams || []);
            self.incidentFilters(cfg.locationFilters.incidents || []);
        }


        // status filters (arrays of status names to show)
        if (Array.isArray(cfg.teamStatusFilter)) {
            self.teamStatusFilter(cfg.teamStatusFilter);
        }
        if (Array.isArray(cfg.jobStatusFilter)) {
            self.jobStatusFilter(cfg.jobStatusFilter);
        }
        if (Array.isArray(cfg.incidentTypeFilter)) {
            self.incidentTypeFilter(cfg.incidentTypeFilter);
        }
        if (Array.isArray(cfg.teamTaskStatusFilter)) {
            self.teamTaskStatusFilter(cfg.teamTaskStatusFilter);
        }
        if (Array.isArray(cfg.sectorFilters)) {
            self.sectorFilters(cfg.sectorFilters);
        }

        if (Array.isArray(cfg.pinnedTeamIds)) {
            self.pinnedTeamIds(cfg.pinnedTeamIds.map(x => String(x)));
        }
        if (Array.isArray(cfg.pinnedIncidentIds)) {
            self.pinnedIncidentIds(cfg.pinnedIncidentIds.map(x => String(x)));
        }

        if (Array.isArray(cfg.paneOrder)) {
            self.rebuildPaneOrderFromIds(cfg.paneOrder);
        } else {
            self.rebuildPaneOrderFromIds(); // defaults
        }

        if (typeof cfg.clusterEnabled === 'boolean') {
            self.clusterEnabled(cfg.clusterEnabled);
        }
        if (typeof cfg.clusterRadius === 'number' && cfg.clusterRadius >= 10 && cfg.clusterRadius <= 80) {
            self.clusterRadius(cfg.clusterRadius);
        }
        if (typeof cfg.clusterRescueJobs === 'boolean') {
            self.clusterRescueJobs(cfg.clusterRescueJobs);
        }
        if (typeof cfg.alertsCollapsibleRules === 'boolean') {
            self.alertsCollapsibleRules(cfg.alertsCollapsibleRules);
        }

        // Instant Task Suggestion Engine weights
        if (typeof cfg.suggestionEnabled === 'boolean') {
            self.suggestionEnabled(cfg.suggestionEnabled);
        }
        if (typeof cfg.rescueDistanceWeight === 'number') {
            self.rescueDistanceWeight(cfg.rescueDistanceWeight);
        }
        if (typeof cfg.rescueTaskingWeight === 'number') {
            self.rescueTaskingWeight(cfg.rescueTaskingWeight);
        }
        if (typeof cfg.normalDistanceWeight === 'number') {
            self.normalDistanceWeight(cfg.normalDistanceWeight);
        }
        if (typeof cfg.normalTaskingWeight === 'number') {
            self.normalTaskingWeight(cfg.normalTaskingWeight);
        }
        if (typeof cfg.suggestionUseRouting === 'boolean') {
            self.suggestionUseRouting(cfg.suggestionUseRouting);
        }


        self.afterConfigLoad()
        suppressRecklessModal = false;
    };

    self.share = async () => {
        self.shareError('');
        self.sharing(true);

        try {
            const savedConfig = buildConfig();

            const res = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: savedConfig })
            });

            if (!res.ok) {
                throw new Error(`Share failed with status ${res.status}`);
            }

            const { id } = await res.json();

            if (!id) {
                throw new Error("No id returned from share service");
            }

            self.shareId(id);
        } catch (err) {
            console.error('Error sharing config:', err);
            self.shareError('Failed to share config. Try again later.');
            self.shareId('');
        } finally {
            self.sharing(false);
        }
    };

    // GET shared config from Lambda -> apply + refresh
    self.loadShared = async (id) => {
        if (!id) return;

        self.shareError('');
        self.loadingShared(true);

        try {
            // Adjust to match your handler: expects ?id=...
            const url = `${FUNCTION_URL}?id=${encodeURIComponent(id)}`;

            const res = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            if (!res.ok) {
                throw new Error(`Load failed with status ${res.status}`);
            }

            const data = await res.json();
            const cfg = data.config || data; // support {config: ...} or raw

            if (!cfg || typeof cfg !== 'object') {
                throw new Error('Invalid config returned from share service');
            }

            // Persist + apply
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            self.loadFromStorage();

            // Refresh data based on new filters
            root.fetchAllTeamData();
            root.fetchAllJobsData();
            root.fetchAllTrackableAssets();

            self.shareId(id);
            self.shareKeyInput(id);
        } catch (err) {
            console.error('Error loading shared config:', err);
            self.shareError('Failed to load shared config. Check the key and try again.');
        } finally {
            self.loadingShared(false);
        }
    };

    // Used by the header form (enter key + press Enter / click Load)
    self.loadSharedFromField = () => {
        const id = (self.shareKeyInput() || '').trim();
        if (!id) return;
        self.loadShared(id);
    };

    /**
     * Collect the HQ IDs relevant for sector lookup based on which
     * scope toggles are active (incidents, teams, or both).
     * @returns {Array<string>}
     */
    self._sectorHqIds = () => {
        const ids = new Set();
        (self.incidentFilters() || []).forEach(f => ids.add(f.id));
        (self.teamFilters() || []).forEach(f => ids.add(f.id));
        return [...ids];
    };

    /** Trigger a sector refresh using the current scope-aware HQ list. */
    self._refreshSectors = () => {
        if (self._suppressSectorRefresh) return;
        const ids = self._sectorHqIds();
        if (ids.length === 0) return;          // no HQs selected — nothing to search
        deps.fetchAllSectors(ids);
    };

    self.afterConfigLoad = () => {
        self._refreshSectors();
        root.mapVM?.applyPaneOrder?.(self.paneOrder().map(p => p.id));
        root.mapVM?.applyClusterRadius?.(Number(self.clusterRadius()) || 60);
        root.mapVM?.applyClusterEnabled?.(!!self.clusterEnabled());
        // Apply dark mode
        self._applyDarkMode();
        // Apply dark mode basemap if enabled
        if (self.darkMode() && root.mapVM?.changeBasemap) {
            root.mapVM.changeBasemap("DarkGray");
        }
    }


    // run once on construction — suppress sector refresh until afterConfigLoad
    self._suppressSectorRefresh = true;
    self.loadFromStorage()
    self._suppressSectorRefresh = false;
    self._refreshSectors();

    self.incidentFilters.subscribe(() => {
        self._refreshSectors();
    }, null, "arrayChange");

    self.teamFilters.subscribe(() => {
        self._refreshSectors();
    }, null, "arrayChange");

    self.applySectorsToIncidents.subscribe(() => self._refreshSectors());
    self.applySectorsToTeams.subscribe(() => self._refreshSectors());

    self.includeIncidentsWithoutSector.subscribe(() => {
        root.fetchAllJobsData();
    })

    self.paneOrder.subscribe(() => {
        root.mapVM?.applyPaneOrder?.(self.paneOrder().map(p => p.id));
    })

    self.clusterRadius.subscribe((v) => {
        const r = Math.max(10, Math.min(80, Number(v) || 60));
        root.mapVM?.applyClusterRadius?.(r);
        self.save();
    })

    self.clusterEnabled.subscribe((v) => {
        root.mapVM?.applyClusterEnabled?.(!!v);
        self.save();
    })

    self.clusterRescueJobs.subscribe((v) => {
        root.mapVM?.applyRescueClusterSetting?.(!!v);
        self.save();
    })

    self.alertsCollapsibleRules.subscribe(() => {
        self.save();
    })

    // Auto-save suggestion engine settings
    self.suggestionEnabled.subscribe(() => { self.save(); });
    self.rescueDistanceWeight.subscribe(() => { self.save(); });
    self.rescueTaskingWeight.subscribe(() => { self.save(); });
    self.normalDistanceWeight.subscribe(() => { self.save(); });
    self.normalTaskingWeight.subscribe(() => { self.save(); });
    self.suggestionUseRouting.subscribe(() => { self.save(); });

    self.darkMode.subscribe((isDark) => {
        self._applyDarkMode();
        
        // Switch basemap when dark mode changes
        if (root.mapVM?.changeBasemap) {
            const targetBasemap = isDark ? "DarkGray" : "Topographic";
            root.mapVM.changeBasemap(targetBasemap);
        }
        
        self.save();
    });

    /** Wipe all Lighthouse localStorage keys and reload the page. */
    self.restoreDefaults = () => {
        if (!confirm(
            'This will reset ALL settings (filters, layout, map layers, starred items, etc.) to their defaults and reload the page.\n\nContinue?'
        )) return;

        // Remove every key in localStorage (covers all lh-*, ov.*, layers.*, map.*, etc.)
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        keys.forEach(k => localStorage.removeItem(k));

        location.reload();
    };

}
