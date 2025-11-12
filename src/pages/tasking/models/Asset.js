/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { fmtRelative, safeStr } from "../utils/common.js";

export function Asset(data = {}) {
    const self = this;
    self.id = ko.observable(data.properties.id ?? null);
    self.name = ko.observable(data.properties.name ?? "");
    self.markerLabel = ko.observable(data.markerLabel ?? "");
    self.latitude = ko.observable(data.geometry.coordinates[1] ?? null);
    self.longitude = ko.observable(data.geometry.coordinates[0] ?? null);
    self.capability = ko.observable(data.properties.capability ?? "");
    self.entity = ko.observable(data.properties.entity ?? "");
    self.resourceType = ko.observable(data.properties.resourceType ?? "");
    self.lastSeen = ko.observable(data.lastSeen ?? "");
    self.licensePlate = ko.observable(data.properties.licensePlate ?? "");
    self.direction = ko.observable(data.properties.direction ?? null);
    self.talkgroup = ko.observable(data.properties.talkgroup ?? "");
    self.talkgroupLastUpdated = ko.observable(data.properties.talkgroupLastUpdated ?? "");
    self.marker = null;
    self.matchingTeams = ko.observableArray();
    

    self.lastSeenText = ko.pureComputed(() => {
        const v = safeStr(self.lastSeen?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d) + " — " + d.toLocaleString();
    });

    self.talkgroupLastUpdatedText = ko.pureComputed(() => {
        const v = safeStr(self.talkgroupLastUpdated?.());
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d)) return v;
        return fmtRelative(d);
    });

    self.latLngText = ko.pureComputed(() => {
        const lat = self.latitude?.();
        const lng = self.longitude?.();
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
        if (d.geometry !== undefined && Array.isArray(d.geometry.coordinates)) {
            if (d.geometry.coordinates[1] !== undefined) this.latitude(d.geometry.coordinates[1]);
            if (d.geometry.coordinates[0] !== undefined) this.longitude(d.geometry.coordinates[0]);
        }

        if (d.lastSeen !== undefined) this.lastSeen(d.lastSeen);
    }
}