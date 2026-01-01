import ko from "knockout";

export function SMSRecipient(data = {}) {
this.id = data.id || null;
this.name = data.name || "";
this.isTeamLeader = data.isTeamLeader || false;
this.selected = ko.observable(data.selected !== undefined ? data.selected : true);
this.loading = ko.observable(data.loading || false);
this.displayLabel = data.displayLabel && ko.observable(data.displayLabel);
this.beaconContact = [];
}