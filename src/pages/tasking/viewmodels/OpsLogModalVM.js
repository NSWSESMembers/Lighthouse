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
