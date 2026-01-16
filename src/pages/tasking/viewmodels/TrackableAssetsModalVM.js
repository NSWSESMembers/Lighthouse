/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

// ViewModel for the Trackable Assets modal
export function TrackableAssetsModalVM(mainVM) {
    const self = this;
    self.searchQuery = ko.observable('');
    self.talkgroups = ko.observableArray([]);
    self.selectedTalkgroup = ko.observable();
    self.isOpen = ko.observable(false);
    // Compute unique talkgroups from all assets
    ko.computed(() => {
        const allAssets = mainVM.trackableAssets();
        const groups = Array.from(new Set(allAssets.map(a => a.talkgroup && a.talkgroup())));
        self.talkgroups(groups.filter(Boolean));
    });

    self.filteredAssets = ko.pureComputed(() => {
        if (!self.isOpen) return [];
        const query = self.searchQuery().toLowerCase();
        const tg = self.selectedTalkgroup();
        return mainVM.trackableAssets().filter(a => {
            const name = a.name && a.name().toLowerCase();
            const radioId = a.radioId && String(a.radioId()).toLowerCase();
            const talkgroup = a.talkgroup && a.talkgroup();
            const entity = a.entity && a.entity().toLowerCase();
            const matchesQuery = !query || (name && name.includes(query)) || (radioId && radioId.includes(query)) || (entity && entity.includes(query));
            const matchesTG = !tg || talkgroup === tg;
            return matchesQuery && matchesTG;
        });
    });
}