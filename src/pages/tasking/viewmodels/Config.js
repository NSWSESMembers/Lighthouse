/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';

import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.
// 
export function ConfigVM(root, deps) {
    const self = this;

    // UI state
    self.query = ko.observable('');
    self.results = ko.observableArray([]);
    self.searching = ko.observable(false);
    self.dropdownOpen = ko.observable(false);
    self.inputHasFocus = ko.observable(false);

    // Selected filters (KO arrays, not Maps)
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

    self.jobStatusFilterDefaults = [
        "Active", "New", "Tasked"
    ];

    self.teamStatusFilterDefaults = [
        "Activated"
    ];

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
        self.dropdownOpen(false);
        return true;
    };


    // Persistence
    const STORAGE_KEY = 'lh-taskingConfig';

    self.save = () => {
        const cfg = {
            refreshInterval: Number(self.refreshInterval()),
            theme: self.theme(),
            showAdvanced: !!self.showAdvanced(),
            filters: {
                teams: ko.toJS(self.teamFilters),
                incidents: ko.toJS(self.incidentFilters)
            },
            // these are your “ignored” statuses used by main.js filters
            teamStatusFilter: ko.toJS(self.teamStatusFilter),
            jobStatusFilter: ko.toJS(self.jobStatusFilter)
        };

        console.log('Saving config:', cfg);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));

        // Kick initial loads using the KO arrays (not Maps)
        root.fetchAllTeamData();
        root.fetchAllJobsData();
        root.fetchAllTrackableAssets();

        // Close the Bootstrap modal
        const el = document.getElementById('configModal');
        const m = bootstrap.Modal.getOrCreateInstance(el);
        m.hide();
    };

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
        if (cfg.filters) {
            self.teamFilters(cfg.filters.teams || []);
            self.incidentFilters(cfg.filters.incidents || []);
        }
        console.log(self.teamFilters());
        console.log(self.incidentFilters());

        // status filters (arrays of status names to show)
        if (Array.isArray(cfg.teamStatusFilter)) {
            self.teamStatusFilter(cfg.teamStatusFilter);
        }
        if (Array.isArray(cfg.jobStatusFilter)) {
            self.jobStatusFilter(cfg.jobStatusFilter);
        }
    };

    // run once on construction
    self.loadFromStorage();
}