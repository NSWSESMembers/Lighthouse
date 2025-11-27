/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';

import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.
// 


const FUNCTION_URL = "https://lambda.lighthouse-extension.com/";



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


    // Other settings
    self.refreshInterval = ko.observable(60);
    self.theme = ko.observable('light');
    self.showAdvanced = ko.observable(false);

    //blown away on load
    self.teamStatusFilter = ko.observableArray([]);

    //blown away on load
    self.jobStatusFilter = ko.observableArray([]);

    self.incidentTypeFilter = ko.observableArray([]);


    self.teamTaskStatusFilter = ko.observableArray([]); 

    self.openLoadBox = function () {
        self.loadExpanded(true);
    };

    self.closeLoadBox = function () {
        self.loadExpanded(false);
        self.shareKeyInput("");
    };

    // self.incidentTypeFilter.subscribe(() => {
    //     self.save();
    // });

    // self.jobStatusFilter.subscribe(() => {
    //     self.save();
    // });

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
        theme: self.theme(),
        showAdvanced: !!self.showAdvanced(),
        locationFilters: {
            teams: ko.toJS(self.teamFilters),
            incidents: ko.toJS(self.incidentFilters)
        },
        // these are your “ignored” statuses used by filters
        teamStatusFilter: ko.toJS(self.teamStatusFilter),
        jobStatusFilter: ko.toJS(self.jobStatusFilter),
        incidentTypeFilter: ko.toJS(self.incidentTypeFilter),
        teamTaskStatusFilter: ko.toJS(self.teamTaskStatusFilter)
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

    // Search (debounced)
    self.query
        .extend({ rateLimit: { timeout: 300, method: 'notifyWhenChangesStop' } })
        .subscribe(q => {
            const t = (q || '').trim();
            if (!t) {
                self.results([]);
                self.dropdownOpen(false);
                return;
            }
            self.searching(true);
            deps.entitiesSearch(t).then(list => {
                self.results(list.map(e => makeResultVM({ id: e.Id, name: e.Name, entityType: e.EntityTypeId })));
                self.dropdownOpen(true);
            }).finally(() => self.searching(false));
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

        const teamExists = self.teamFilters().some(x => x.id === norm(item).id);
        if (!teamExists) self.teamFilters.push(item);

        const incidentExists = self.incidentFilters().some(x => x.id === norm(item).id);
        if (!incidentExists) self.incidentFilters.push(item);

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
        console.log('Saving config:', cfg);
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
            cfg.theme = self.theme();
            cfg.showAdvanced = self.showAdvanced();
            cfg.teamStatusFilter = self.teamStatusFilterDefaults;
            cfg.jobStatusFilter = self.jobStatusFilterDefaults;
            cfg.incidentTypeFilter = self.incidentTypeFilterDefaults;
            cfg.teamTaskStatusFilter = self.teamTaskStatusFilterDefaults;

        }
        console.log('Loaded config:', cfg);
        // scalar settings
        if (typeof cfg.refreshInterval === 'number') {
            self.refreshInterval(cfg.refreshInterval);
        }
        if (typeof cfg.theme === 'string') {
            self.theme(cfg.theme);
        }
        if (typeof cfg.showAdvanced === 'boolean') {
            self.showAdvanced(cfg.showAdvanced);
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


    // run once on construction
    self.loadFromStorage();
}
