import ko from "knockout";

export function SMSRecipient(data = {}) {
this.id = data.id || null;
this.name = data.name || "";
this.isTeamLeader = data.isTeamLeader || false;
this.selected = ko.observable(data.selected !== undefined ? data.selected : true);
this.loading = ko.observable(true);
this.displayLabel = ko.observable(this.name);
this.beaconContact = [];
}