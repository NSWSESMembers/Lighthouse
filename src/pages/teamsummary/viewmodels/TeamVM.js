/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { hoursSince, hoursLevel, taskedLevel, taskedText, messageUrl, stampText } from "../data/teams.js";
import { historyEntries, agoText } from "../data/history.js";
import { shortAddress } from "../data/incident.js";

const levelClass = (level) => (level ? "level-" + level : "");

/**
 * One team's card. `data` is replaced on each refresh (teamFromBeacon), so
 * whether the team is shown, and its history, carry over.
 *
 * Bound fields are observables or never-empty strings: knockout-secure-binding
 * falls back to `window` for a falsy value.
 *
 * @param {ReturnType<import('../data/teams.js').teamFromBeacon>} team
 * @param {object} page  the TeamSummaryVM: clock, source, settings, loadHistory
 */
export function TeamVM(team, page) {
    const self = this;
    self.id = team.id;
    self.data = ko.observable(team);
    self.shown = ko.observable(false);

    self.historyRows = ko.observable(null); // null until loaded
    self.historyLoading = ko.observable(false);
    self.historyError = ko.observable("");
    // { statusName, incidentNumber, at, address } from the history, or null
    self.position = ko.observable(null);
    self.historyBusy = null; // the history load in progress (TeamSummaryVM.loadHistory)

    const now = () => new Date(page.clock());

    self.callsign = ko.pureComputed(() => self.data().callsign || "—");
    self.typeName = ko.pureComputed(() => self.data().typeName || "—");
    self.statusLabel = ko.pureComputed(() => self.data().statusLabel);
    self.cardClass = ko.pureComputed(() => "team-card status-" + self.data().statusKey);
    self.statusTime = ko.pureComputed(() => stampText(self.data().statusSince));
    self.editUrl = ko.pureComputed(() => `${page.source}/Teams/${self.id}/Edit`);
    self.historyUrl = ko.pureComputed(() => `${page.source}/Teams/History/${self.id}`);
    self.hasMembers = ko.pureComputed(() => self.data().members.length > 0);
    self.messageUrl = ko.pureComputed(() => messageUrl(page.source, self.data().members.map((m) => m.personId)));
    self.messageTitle = ko.pureComputed(() => (self.hasMembers() ? `Send an SMS to ${self.callsign()}'s members in Beacon` : "No members to message"));

    self.taskedText = ko.pureComputed(() => taskedText(self.data().tasked));
    self.taskedClass = ko.pureComputed(() => levelClass(taskedLevel(self.data().tasked)));
    self.statusHours = ko.pureComputed(() => hoursSince(self.data().statusSince, now()));
    self.statusForText = ko.pureComputed(() => `${self.statusLabel()} For ${self.statusHours()} hrs`);
    self.statusForClass = ko.pureComputed(() => levelClass(hoursLevel(self.statusHours())));

    self.hasSector = ko.pureComputed(() => Boolean(self.data().sector));
    self.sectorText = ko.pureComputed(() => `${self.data().sector} Sector`);
    self.hasResources = ko.pureComputed(() => self.data().resources.length > 0);
    self.resourcesText = ko.pureComputed(() => self.data().resources.join(", "));

    self.members = ko.pureComputed(() => self.data().members.map((m) => {
        const hours = hoursSince(m.timeOn, now());
        const level = levelClass(hoursLevel(hours));
        return {
            memberKey: m.id,
            memberName: m.name || "—",
            memberClass: [m.leader ? "is-leader" : "", level].filter(Boolean).join(" ") || "member",
            memberTitle: `${m.name} has been ${self.statusLabel()} for ${hours}hrs`,
        };
    }));

    self.hasPosition = ko.pureComputed(() => self.position() !== null);
    self.positionText = ko.pureComputed(() => {
        const p = self.position();
        return p ? `${p.statusName} ${p.incidentNumber} (${agoText(p.at, now())})` : " ";
    });
    self.positionAddress = ko.pureComputed(() => {
        const p = self.position();
        return (p && shortAddress(p.address)) || " ";
    });

    self.entries = ko.pureComputed(() => {
        const rows = self.historyRows();
        if (!rows) return [];
        return historyEntries(rows, { callsign: self.data().callsign, memberChanges: page.showMemberChanges() })
            .map((e) => ({
                ...e,
                entryTitle: e.title || "—",
                entryDetail: e.detail || " ",
                entryTime: stampText(e.at),
                isIncident: Boolean(e.incidentNumber),
            }));
    });
    self.historyFirstLoad = ko.pureComputed(() => self.historyRows() === null && self.historyLoading());
    self.noHistory = ko.pureComputed(() => self.historyRows() !== null && self.entries().length === 0);

    // The Team Filter list's line under the callsign.
    self.chooserText = ko.pureComputed(() => `${self.statusLabel()} - ${self.statusTime()}`);
    self.chooserId = "team-pick-" + self.id;

    self.toggle = function () {
        self.shown(!self.shown());
    };

    self.shown.subscribe((on) => {
        if (on) page.loadHistory(self);
    });
}
