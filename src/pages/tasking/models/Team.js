/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

import { Entity } from "./Entity.js";

export function Team(data = {}, deps = {}) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const {
        upsertTasking,              // (taskingJson, {teamContext}) => Tasking
        getTeamTasking,            // (teamId) => Promise<{Results:[]}>
        makeTeamLink = (_id) => '#',
        flyToAsset = () => {
            // No operation (noop) function.
        }
    } = deps;


    self.id = ko.observable(data.Id ?? null);
    self.callsign = ko.observable(data.Callsign ?? "");
    self.assignedTo = new Entity(data.EntityAssignedTo || data.CreatedAt);
    self.status = ko.observable(data.TeamStatusType || null); // {Id,Name,Description}
    self.members = ko.observableArray(data.Members);
    self.teamLeader = ko.computed(function () {
        const leader = ko.unwrap(self.members).find(m => m.TeamLeader === true);
        return leader ? `${leader.Person.FirstName} ${leader.Person.LastName}` : '-';
    });

    self.trackableAssets = ko.observableArray([]);

    self.expanded = ko.observable(false);


    self.taskingLoading = ko.observable(true);
    self.taskings = ko.observableArray([]);

    self.statusName = ko.pureComputed(() => {
        return (self.status() && self.status().Name) || "Unknown";
    })

    self.activeTaskingsCount = ko.pureComputed(() => {
        return self.filteredTaskings() && self.filteredTaskings().length || 0;
    })

    self.filteredTaskings = ko.pureComputed(() => {
        const ignoreList = [
            "Complete",
            "Untasked",
            "CalledOff"
        ];
        return ko.utils.arrayFilter(this.taskings(), ts => {
            if (ignoreList.includes(ts.currentStatus())) {
                return false;
            }
            return true;
        }).sort((a, b) => new Date(b.currentStatusTime()) - new Date(a.currentStatusTime()));
    });

    self.taskingRowColour = ko.pureComputed(() => {
        if (self.activeTaskingsCount() === 0) {
            return '#d4edda'; // light green
        }
    })

    self.teamLink = ko.pureComputed(() => makeTeamLink(self.id()));

    self.openBeaconEditTeam = (ev) => {
        window.open(self.teamLink(), '_blank');
        ev?.preventDefault?.();
    };


    self.toggle = () => self.expanded(!self.expanded());
    self.expand = () => self.expanded(true);
    self.collapse = () => self.expanded(false);
    self.expanded.subscribe(function (isExpanded) {
        if (isExpanded && self.taskingLoading()) {
            self.fetchTasking();
        }
    });

    self.updateStatusById = function (statusId) {
        const status = teamStatusById[statusId];
        if (status) {
            self.status(status);
        }
    }

    self.fetchTasking = function () {
        if (!getTeamTasking || !upsertTasking) return;
        self.taskingLoading(true);
        getTeamTasking(self.id.peek())
            .then(tasking => {
                (tasking?.Results || []).forEach(t =>
                    upsertTasking(t, { teamContext: self })
                );
            })
            .finally(() => self.taskingLoading(false));
    };

    self.addTaskingFromPayload = function (taskingJson) {
        return upsertTasking && upsertTasking(taskingJson, { teamContext: self });
    };

    self.findTaskingById = function (taskingId) {
        const arr = this.taskings && ko.unwrap(this.taskings);
        if (!arr) return undefined;
        return arr.find(t => t.id && t.id() === taskingId);
    }

    self.addTaskingIfNotExists = function (job) {
        const existsLocally = self.taskings().some(x => x.id() === job.id());
        if (!existsLocally) self.taskings.push(job);
    };


    self.upsertTaskingFromPayload = function (vm, taskingJson) {
        const t = vm.upsertTaskingFromPayload(taskingJson, { teamContext: self });
        // ensure it's listed under this team locally
        const existsLocally = self.taskings().some(x => x.id() === t.id());
        if (!existsLocally) self.taskings.push(t);
    };

    //only handle single asset for now
    self.markerFocus = function () {
        const a = self.trackableAssets()[0];
        if (!a) return;
        flyToAsset(a); // map logic stays out of the model
    };

    const teamStatusById = {
        1: {
            Key: "Standby",
            Id: 1,
            Name: "Standby",
            Description: "Standby",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        2: {
            Key: "OnAlert",
            Id: 2,
            Name: "OnAlert",
            Description: "On Alert",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        3: {
            Key: "Activated",
            Id: 3,
            Name: "Activated",
            Description: "Activated",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        4: {
            Key: "Rest",
            Id: 4,
            Name: "Rest",
            Description: "Rest",
            ParentId: null,
            GroupId: null,
            Colour: null
        },
        5: {
            Key: "StoodDown",
            Id: 5,
            Name: "StoodDown",
            Description: "Stood down",
            ParentId: null,
            GroupId: null,
            Colour: null
        }
    };
}