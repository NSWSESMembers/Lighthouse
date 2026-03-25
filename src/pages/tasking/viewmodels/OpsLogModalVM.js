/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

export function CreateOpsLogModalVM(parentVM) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;

  // Store parentVM reference for use in computeds
  self.parentVM = parentVM;

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
  self.errorMessage = ko.observable("");
  self.showError = ko.observable(false);

  self.uiTags = ko.observableArray([]);
  self.tagsByGroup = {};

  self.initTags = () => {
    const tags = ko.unwrap(parentVM.allTags) || {};

    self.uiTags(tags.map(t => new uiTag(t)));
  };

  self.tagIds = ko.pureComputed(() =>
    self.uiTags()
      .filter(t => t.selected())
      .map(t => t.id())
      .filter(id => id != null)
  );  

  [2, 3, 4, 27].forEach(gid => {
    self.tagsByGroup[gid] = ko.pureComputed(() =>
      self.uiTags().filter(t => t.tagGroupId() === gid)
    );
  });

  self.ActionRequiredCheck = ko.computed(() => {
    const anyActionTagSelected = self.uiTags().some(
        t => t.selected() && t.tagGroupId() === 27
    );

    self.actionRequired(anyActionTagSelected);
  });

  // When opening, prefill job/team fields if present
  // (removed unused origOpenForNewJobLog)
  self.openForNewJobLog = async (job) => {
    self.resetFields();
    if (job && typeof job.id === 'function') {
      self.jobId(job.id() || "");
      self.jobIdInput(job.identifier ? job.identifier() : '');
      self.headerLabel(`New Ops Log for ${job.identifier() || ""}`);
    } else {
      self.jobId("");
      self.jobIdInput("");
      self.headerLabel("New Ops Log");
    }
    self.initTags();
  }

  // Open for a new radio log — auto-selects the "Radio" contact method tag
  self.openForRadioLog = async (job) => {
    self.resetFields();
    if (job && typeof job.id === 'function') {
      self.jobId(job.id() || "");
      self.jobIdInput(job.identifier ? job.identifier() : '');
      self.headerLabel(`New Radio Log for ${job.identifier() || ""}`);
    } else {
      self.jobId("");
      self.jobIdInput("");
      self.headerLabel("New Radio Log");
    }
    self.initTags();

    // Auto-select the "Radio" tag in Contact Methods (group 3)
    self.uiTags().forEach(t => {
      if (t.tagGroupId() === 3 && t.name && t.name().toLowerCase().includes('radio')) {
        t.selected(true);
      }
    });
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
          self.errorMessage("Error: You must enter text.");
          self.showError(true);
          return false;
      }

      // No tags
      if (self.tagIds().length === 0) {
          self.errorMessage("Error: You must select at least one tag.");
          self.showError(true);
          return false;
      }

      return true;
  }

  self.submitting = ko.observable(false);

  self.submit = function () {
    if (!validate()) {
        return;
    }
    self.submitting(true);
    const payload = self.toPayload();

    parentVM.createOpsLogEntry(payload, function (result) {
        if (!result) {
            console.error("Ops Log submit failed");
            return;
        }
        if (self.modalInstance) {
            self.modalInstance.hide();
        }
        self.submitting(false);
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

    self.showError(false);
    self.errorMessage("");

    self.jobIdInput("");
    self.jobIdInputHasFocus(false);
    self.teamInput("");
    self.teamInputHasFocus(false);
  };

  function uiTag(tag) {
    this.tag = tag;

    this.id = tag.id;
    this.name = tag.name;
    this.tagGroupId = tag.tagGroupId;

    this.returnTagText = tag.returnTagText;
    this.returnTagClass = tag.returnTagClass;
    this.returnTagClassSelected = tag.returnTagClassSelected;
    this.returnTagIcon = tag.returnTagIcon;

    this.selected = ko.observable(false);

    this.toggle = () => this.selected(!this.selected());

    this.pillClass = ko.pureComputed(() => {
      return this.selected()
        ? this.returnTagClassSelected()
        : this.returnTagClass();
    });
  }

  // Job and Team Autocomplete
  self.jobIdInput = ko.observable("");
  self.jobIdInputHasFocus = ko.observable(false);
  self.jobIdSuggestions = ko.pureComputed(() => {
    const input = self.jobIdInput().toLowerCase();
    if (!input) return [];
    return ko.unwrap(self.parentVM.jobs)
      .filter(j => (j.identifier && j.identifier().toLowerCase().includes(input)) || (j.id && String(j.id()).includes(input)))
      .slice(0, 10)
      .map(j => {
        const id = j.identifier ? j.identifier() : '';
        const type = j.typeName ? j.typeName() : '';
        const addr = j.address && j.address.prettyAddress ? j.address.prettyAddress() : '';
        const detail = [type, addr].filter(Boolean).join(' — ');
        return { id: id, detail: detail, label: id, job: j };
      });
  });
  self.showJobDropdown = ko.pureComputed(() => self.jobIdInputHasFocus() && self.jobIdSuggestions().length > 0);
  self.pickJobSuggestion = function(suggestion, event) {
    if (event && event.preventDefault) event.preventDefault();
    if (suggestion && suggestion.job) {
      self.jobIdInput(suggestion.label);
      self.jobId(suggestion.job.id());
    }
    self.jobIdInputHasFocus(false);
  };

  self.teamInput = ko.observable("");
  self.teamInputHasFocus = ko.observable(false);
  self.teamSuggestions = ko.pureComputed(() => {
    const input = self.teamInput().toLowerCase();
    if (!input) return [];
    return ko.unwrap(self.parentVM.trackableAssets)
      .filter(a => (a.name && a.name().toLowerCase().includes(input)))
      .slice(0, 10)
      .map(a => ({ label: a.name ? a.name() : '', asset: a }));
  });
  self.showTeamDropdown = ko.pureComputed(() => self.teamInputHasFocus() && self.teamSuggestions().length > 0);
  self.pickTeamSuggestion = function(suggestion, event) {
    if (event && event.preventDefault) event.preventDefault();
    if (suggestion && suggestion.asset) {
      self.teamInput(suggestion.label);
      self.subject(`${suggestion.label} - ${self.subject()}`);
    }
    self.teamInputHasFocus(false);
  };
}
