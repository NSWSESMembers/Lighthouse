/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { assetCapabilityName, assetCapabilityCode } from "../components/asset_icon.js";

// ViewModel for the Trackable Assets modal
export function TrackableAssetsModalVM(mainVM) {
    const self = this;
    self.searchQuery = ko.observable('');
    self.clearSearchQuery = () => self.searchQuery('');
    self.talkgroups = ko.observableArray([]);
    self.selectedTalkgroup = ko.observable();
    self.types = ko.observableArray([]);
    self.selectedType = ko.observable();
    // Capability as the map shows it (see assetCapabilityName), with its
    // marker code: e.g. { value: 'Heavy Rescue', label: 'Heavy Rescue (HRV)' }.
    self.capabilities = ko.observableArray([]);
    self.selectedCapability = ko.observable();
    self.satelliteOptions = [
        { value: 'satellite', label: 'Satellite tracker' },
        { value: 'none', label: 'PSN radio only' },
    ];
    self.selectedSatellite = ko.observable();
    self.isOpen = ko.observable(false);
    self.focusAsset = (asset) => mainVM.focusTrackableAsset(asset);
    // Compute unique talkgroups from all assets
    ko.computed(() => {
        const allAssets = mainVM.trackableAssets();
        const groups = Array.from(new Set(allAssets.map(a => a.talkgroup && a.talkgroup())));
        self.talkgroups(groups.filter(Boolean));
        const types = Array.from(new Set(allAssets.map(a => a.resourceType && a.resourceType())));
        self.types(types.filter(Boolean).sort((a, b) => a.localeCompare(b)));
        const caps = new Map();
        allAssets.forEach((a) => {
            const name = assetCapabilityName(a);
            if (!caps.has(name)) caps.set(name, assetCapabilityCode(a));
        });
        self.capabilities([...caps]
            .sort(([a], [b]) => (a === 'Other') - (b === 'Other') || a.localeCompare(b))
            .map(([name, code]) => ({ value: name, label: code ? `${name} (${code})` : name })));
    });

    self.filteredAssets = ko.pureComputed(() => {
        if (!self.isOpen) return [];
        const query = self.searchQuery().toLowerCase();
        const tg = self.selectedTalkgroup();
        const type = self.selectedType();
        const sat = self.selectedSatellite();
        const cap = self.selectedCapability();
        return mainVM.trackableAssets()
            .filter(a => {
            const name = a.name && a.name().toLowerCase();
            const radioId = a.radioId && String(a.radioId()).toLowerCase();
            const talkgroup = a.talkgroup && a.talkgroup();
            const entity = a.entity && a.entity().toLowerCase();
            const satIds = [a.satelliteId?.(), a.satelliteEquipmentId?.()].filter(Boolean).map(v => String(v).toLowerCase());
            const matchesQuery = !query || (name && name.includes(query)) || (radioId && radioId.includes(query)) || (entity && entity.includes(query)) || satIds.some(v => v.includes(query));
            const matchesTG = !tg || talkgroup === tg;
            const matchesType = !type || (a.resourceType && a.resourceType()) === type;
            const isSat = !!(a.isSatellite && a.isSatellite());
            const matchesSat = !sat || (sat === 'satellite' ? isSat : !isSat);
            const matchesCap = !cap || assetCapabilityName(a) === cap;
            return matchesQuery && matchesTG && matchesType && matchesSat && matchesCap;
            })
            .sort((a, b) => {
            const nameA = a.name && a.name().toLowerCase();
            const nameB = b.name && b.name().toLowerCase();
            if (!nameA && !nameB) return 0;
            if (!nameA) return 1;
            if (!nameB) return -1;
            return nameA.localeCompare(nameB);
            });
    });
}