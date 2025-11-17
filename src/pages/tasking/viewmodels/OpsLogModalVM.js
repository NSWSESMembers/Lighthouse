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

  self.entityId = ko.observable(null);
  self.jobId = ko.observable(null);
  self.eventId = ko.observable(null);
  self.talkgroupId = ko.observable(null);
  self.talkgroupRequestId = ko.observable(null);

  self.subject = ko.observable("");
  self.text = ko.observable("");
  self.position = ko.observable(null);
  self.personFromId = ko.observable(null);
  self.personTold = ko.observable(null);

  self.important = ko.observable(false);
  self.restricted = ko.observable(false);
  self.actionRequired = ko.observable(false);
  self.actionReminder = ko.observable(null);

  self.tagIds = ko.observableArray([]);
  self.timeLogged = ko.observable(null);

  // UI
  self.headerLabel = ko.observable("");
  self.tagsByGroup = {};
  self.errorMessage = ko.observable("");
  self.showError = ko.observable(false);

  self.uiTags = ko.observableArray([]);

  self.initTags = () => {
    const tags = parentVM.allTags ? parentVM.allTags() : [];
    self.uiTags(tags.map(tag => createUiTag(tag)));
  };

  self.tagIds = ko.computed(() =>
    self.uiTags()
      .filter(t => t.selected())
      .map(t => t.id())
  );

  [2, 3, 4, 27].forEach(gid => {
    self.tagsByGroup[gid] = ko.pureComputed(() =>
        self.uiTags().filter(t => t.groupId() === gid)
    );
  });

  function preselectTag(idToSelect) {
    self.uiTags().forEach(t => {
      t.selected(t.id() === idToSelect);
    });
  }

  self.tagIds = ko.computed(() =>
    self.uiTags()
      .filter(t => t.selected())
      .map(t => t.id())
  );

  self.ActionRequiredCheck = ko.computed(() => {
    const anyActionTagSelected = self.uiTags().some(
        t => t.selected() && t.groupId() === 27
    );

    self.actionRequired(anyActionTagSelected);
  });

  self.openForTasking = async (tasking) => {
    self.resetFields();
    self.jobId(tasking.job.id() || "");
    self.subject(tasking.teamCallsign() || "");
    self.initTags();
    preselectTag(6);

    self.headerLabel(`New Radio Log for ${tasking.teamCallsign?.() || ""} on ${tasking.job.identifier() || ""}`);
  }

  self.openForTeam = async (team) => {
    // NEED TO COME BACK AND ADD HQ ONCE TIM HAS SETUP THE CONFIG PAGE TO USE IT.
    self.resetFields();
    self.subject(team.callsign() || "");
    self.initTags();
    preselectTag(6);

    self.headerLabel(`New Radio Log for ${team.callsign?.() || ""}`);
  }

  self.openForNewJobLog = async (job) => {
    self.resetFields();
    self.jobId(job.id() || "");
    console.log(job);
    self.initTags();
    self.headerLabel(`New Ops Log for ${job.identifier() || ""}`);
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

  function validate() {
      self.showError(false);
      self.errorMessage("");

      // No text
      if (!self.text() || self.text().trim().length === 0) {
          self.errorMessage("Text is required.");
          self.showError(true);
          return false;
      }

      // No tags
      if (self.tagIds().length === 0) {
          self.errorMessage("You must select at least one tag.");
          self.showError(true);
          return false;
      }

      return true;
  }

  self.submit = function () {
    if (!validate()) {
        return;
    }
    const payload = self.toPayload();

    parentVM.createOpsLogEntry(payload, function (result) {

        if (!result) {
            console.error("Ops Log submit failed");
            return;
        }

        if (self.modalInstance) {
            self.modalInstance.hide();
        }
    });
  };

  self.resetFields = function () {
      self.entityId(null);
      self.jobId(null);
      self.eventId(null);
      self.talkgroupId(null);
      self.talkgroupRequestId(null);

      self.subject("");
      self.text("");
      self.position(null);
      self.personFromId(null);
      self.personTold(null);

      self.important(false);
      self.restricted(false);
      self.actionRequired(false);
      self.actionReminder(null);

      self.timeLogged(null);

      self.uiTags([]);
      self.headerLabel("");
  };

  function createUiTag(tag) {
    return {
        model: tag,

        id: tag.id,
        name: tag.name,
        groupId: tag.tagGroupId,

        selected: ko.observable(false),

        toggle() {
        this.selected(!this.selected());
        }
    };
  }
}
