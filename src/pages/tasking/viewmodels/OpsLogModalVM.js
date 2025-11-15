/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { OpsLogEntry } from "../models/OpsLogEntry.js";

function TagFilterItem(label, owner) {
  const self = this;
  self.label = label;
  self.owner = owner;
  self.isIcems = (label === "ICEMS");

  self.isActive = ko.pureComputed(function () {
    return owner.selectedTags().indexOf(self.label) !== -1;
  });

  self.select = function () {
    var tags = owner.selectedTags().slice(0);
    var idx = tags.indexOf(self.label);
    if (idx === -1) {
      tags.push(self.label);       // add
    } else {
      tags.splice(idx, 1);         // remove
    }
    owner.selectedTags(tags);
  };

  self.btnClass = ko.pureComputed(function () {
    var base = "btn btn-xs me-1 mb-1 ";
    if (self.isIcems) {
      // ICEMS uses secondary colour
      return base + (self.isActive() ? "btn-info" : "btn-outline-info");
    }
    // Other tags use primary when active
    return base + (self.isActive() ? "btn-primary" : "btn-outline-secondary");
  });
}

export function OpsLogModalVM(parentVm) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;

  self.job = ko.observable(null);
  self.entries = ko.observableArray([]);
  self.loading = ko.observable(false);
  self.jobIdentifier = ko.observable();

  // --- TAG FILTER STATE (multi-select) ---
  self.selectedTags = ko.observableArray([]);
  self.tagItems = ko.observableArray([]);

  self.isTagFilterClear = ko.pureComputed(function () {
    return self.selectedTags().length === 0;
  });

  self.clearTagFilter = function () {
    self.selectedTags([]);
  };

  self.allTagButtonClass = ko.pureComputed(function () {
    return "btn btn-xs " + (self.isTagFilterClear() ? "btn-primary" : "btn-outline-secondary");
  });
  self.filteredEntries = ko.pureComputed(function () {
    var selected = self.selectedTags();
    if (!selected.length) {
      return self.entries();    // no filter → all entries
    }

    return self.entries().filter(function (entry) {
      var raw = entry.tagsCsv ? entry.tagsCsv() : "";
      if (!raw) {
        return false;
      }

      var tags = raw
        .split(",")
        .map(function (t) { return t.trim(); })
        .filter(function (t) { return t.length > 0; });

      // AND semantics: every selected tag must appear in entry.tags
      for (var i = 0; i < selected.length; i++) {
        if (tags.indexOf(selected[i]) === -1) {
          return false;
        }
      }
      return true;
    });
  });

  function rebuildTagItemsFromEntries() {
    var tagsSet = new Set();

    self.entries().forEach(function (entry) {
      var raw = entry.tagsCsv ? entry.tagsCsv() : "";
      if (!raw) {
        return;
      }
      raw
        .split(",")
        .map(function (t) { return t.trim(); })
        .filter(function (t) { return t.length > 0; })
        .forEach(function (t) { tagsSet.add(t); });
    });

    var items = Array.from(tagsSet)
      .sort(function (a, b) {
        // ICEMS always first
        if (a === "ICEMS" && b !== "ICEMS") return -1;
        if (b === "ICEMS" && a !== "ICEMS") return 1;

        return a.localeCompare(b);  // normal alphabetical for the rest
      })
      .map(function (label) { return new TagFilterItem(label, self); });

    self.tagItems(items);
  }

  self.openForJob = async (job) => {
    self.jobIdentifier(job.identifier() || "");
    self.job(job);
    self.entries([]);
    self.selectedTags([]);
    self.tagItems([]);
    self.loading(true);

    try {
      const results = await new Promise((resolve, reject) => {
        parentVm.fetchOpsLogForJob(job.id(), function (res) { resolve(res); }, reject);
      });
      self.entries((results || []).map(function (e) { return new OpsLogEntry(e); }));
      rebuildTagItemsFromEntries();
    } catch (err) {
      console.error("Failed to fetch ops log entries:", err);
    } finally {
      self.loading(false);
    }
  };
}

export function NewOpsLogModalVM(parentVM) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;

  self.entityId          = ko.observable(null);
  self.jobId             = ko.observable(null);
  self.eventId           = ko.observable(null);
  self.talkgroupId       = ko.observable(null);
  self.talkgroupRequestId= ko.observable(null);

  self.subject           = ko.observable("");
  self.text              = ko.observable("");
  self.position          = ko.observable(null);
  self.personFromId      = ko.observable(null);
  self.personTold        = ko.observable(null);

  self.important         = ko.observable(false);
  self.restricted        = ko.observable(false);
  self.actionRequired    = ko.observable(false);
  self.actionReminder    = ko.observable(null);

  self.tagIds            = ko.observableArray([]);
  self.timeLogged        = ko.observable(null);

  // UI header
  self.headerLabel       = ko.observable("");

  self.openForTasking = async (tasking) => {
    self.resetFields();
    self.jobId(tasking.job.id() || "");
    self.subject(tasking.teamCallsign() || "");
    self.tagIds([6]);

    self.headerLabel(`New Radio Log for ${tasking.teamCallsign?.() || ""} ON ${tasking.job.identifier() || ""}`);
  }

  self.toPayload = function () {
    return {
        EntityId: self.entityId(),
        JobId: self.jobId(),
        EventId: self.eventId(),
        TalkgroupId: self.talkgroupId(),
        TalkgroupRequestId: self.talkgroupRequestId(),

        Subject: self.subject(),
        Text: self.text(),
        Position: self.position(),
        PersonFromId: self.personFromId(),
        PersonTold: self.personTold(),

        Important: self.important(),
        Restricted: self.restricted(),
        ActionRequired: self.actionRequired(),
        ActionReminder: self.actionReminder(),

        TagIds: self.tagIds(),
        TimeLogged: self.timeLogged()
    };
  };

  self.submit = function () {
    const payload = self.toPayload();

    parentVM.createOpsLogEntry(payload, function (result) {

        if (!result) {
            console.error("Ops Log submit failed");
            return;
        }

        console.log("Ops Log successfully created:", result);

        // use the modal instance passed from main.js
        if (self.modalInstance) {
            self.modalInstance.hide();
        }
    });
  };

  self.resetFields = function () {
      // Core fields
      self.entityId(null);
      self.jobId(null);
      self.eventId(null);
      self.talkgroupId(null);
      self.talkgroupRequestId(null);

      // Content
      self.subject("");
      self.text("");
      self.position(null);
      self.personFromId(null);
      self.personTold(null);

      // Flags
      self.important(false);
      self.restricted(false);
      self.actionRequired(false);
      self.actionReminder(null);

      // Arrays
      self.tagIds([]);

      // Metadata
      self.timeLogged(null);

      // UI header
      self.headerLabel("");
  };

}
