/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { fmtRelative, safeStr } from "../utils/common.js";

export function Asset(data = {}) {
    const self = this;
    self.id = ko.observable(data.properties.id ?? null);
    self.name = ko.observable(data.properties.name ?? "");
    self.markerLabel = ko.observable(data.markerLabel ?? "");

    self.latLng = ko.observable({ lat: data.geometry?.coordinates?.[1], lng: data.geometry?.coordinates?.[0] });
    self.latitude = ko.pureComputed(() => self.latLng()?.lat ?? null);
    self.longitude = ko.pureComputed(() => self.latLng()?.lng ?? null);

    self.capability = ko.observable(data.properties.capability ?? "");
    self.entity = ko.observable(data.properties.entity ?? "");
    self.resourceType = ko.observable(data.properties.resourceType ?? "");
    self.lastSeen = ko.observable(data.lastSeen ?? "");
    self.licensePlate = ko.observable(data.properties.licensePlate ?? "-");
    self.direction = ko.observable(data.properties.direction ?? null);
    self.talkgroup = ko.observable(data.properties.talkgroup ?? "");
    self.talkgroupLastUpdated = ko.observable(data.properties.talkgroupLastUpdated ?? "");
    self.radioId = ko.observable(data.properties.radioId ?? "");
    self.marker = null;
    self.matchingTeams = ko.observableArray();

    self.matchingTeamsInView = ko.pureComputed(() => {
        return self.matchingTeams().filter(t => t.isFilteredIn());
    });

    // Force updates for computed observables using fmtRelative every 30 seconds
    self._relativeUpdateTick = ko.observable(0);

    setInterval(() => {
        self._relativeUpdateTick(self._relativeUpdateTick() + 1);
    }, 1000 * 30);

    // Patch computeds to depend on _relativeUpdateTick
    self.lastSeenJustAgoText = ko.pureComputed(() => {
        self._relativeUpdateTick(); // dependency
        const v = safeStr(self.lastSeen?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d);
    });

    self.lastSeenText = ko.pureComputed(() => {
        self._relativeUpdateTick(); // dependency
        const v = safeStr(self.lastSeen?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d) + " — " + d.toLocaleString();
    });

    self.talkgroupLastUpdatedText = ko.pureComputed(() => {
        self._relativeUpdateTick(); // dependency
        const v = safeStr(self.talkgroupLastUpdated?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d);
    });


    self.latLngText = ko.pureComputed(() => {
        const p = self.latLng?.();
        const lat = p?.lat;
        const lng = p?.lng;
        if (lat == null || lng == null) return "";
        return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    });

    Asset.prototype.updateFromJson = function (d = {}) {
        if (!d) return;

        if (d.properties !== undefined) {
            if (d.properties.direction !== undefined) this.direction(d.properties.direction);
            if (d.properties.talkgroup !== undefined) this.talkgroup(d.properties.talkgroup);
            if (d.properties.talkgroupLastUpdated !== undefined) this.talkgroupLastUpdated(d.properties.talkgroupLastUpdated);
        }

        if (d.markerLabel !== undefined) this.markerLabel(d.markerLabel);


        // SET ONCE: update both lat/lng in a single observable write
        if (d.geometry !== undefined && Array.isArray(d.geometry.coordinates)) {
            const lat = d.geometry.coordinates[1];
            const lng = d.geometry.coordinates[0];

            // only write if at least one is present
            if (lat !== undefined || lng !== undefined) {
                const cur = this.latLng?.() || { lat: null, lng: null };
                this.latLng({
                    lat: (lat !== undefined ? lat : cur.lat),
                    lng: (lng !== undefined ? lng : cur.lng),
                });
            }
        }

        if (d.lastSeen !== undefined) this.lastSeen(d.lastSeen);
    }
}