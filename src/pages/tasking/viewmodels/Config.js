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
    self.defaultHQ = ko.observable('');

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
    self.save = () => {
        const cfg = {
            refreshInterval: Number(self.refreshInterval()),
            theme: self.theme(),
            showAdvanced: !!self.showAdvanced(),
            defaultHQ: self.defaultHQ().trim(),
            filters: {
                teams: ko.toJS(self.teamFilters),
                incidents: ko.toJS(self.incidentFilters)
            }
        };
        localStorage.setItem('taskingFilters', JSON.stringify(cfg.filters));

        // Kick initial loads using the KO arrays (not Maps)
        root.fetchAllTeamData();
        root.fetchAllJobsData();
        root.fetchAllTrackableAssets();

        // Close the Bootstrap modal
        const el = document.getElementById('configModal');

        // eslint-disable-next-line no-undef
        const m = bootstrap.Modal.getOrCreateInstance(el);
        m.hide();
    };

    self.loadFromStorage = () => {
        const saved = localStorage.getItem('taskingFilters');
        if (!saved) return;
        const filters = JSON.parse(saved);
        self.teamFilters(filters.teams || []);
        self.incidentFilters(filters.incidents || []);
    };

    // Init
    self.loadFromStorage();
}
