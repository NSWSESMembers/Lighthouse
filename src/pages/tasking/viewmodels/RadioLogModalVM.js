/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

export function CreateRadioLogModalVM(parentVM) {
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