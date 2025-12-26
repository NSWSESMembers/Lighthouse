/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

export function CreateOpsLogModalVM(parentVM) {
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

  self.openForNewJobLog = async (job) => {
    self.resetFields();
    self.jobId(job.id() || "");
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

      self.showError(false);
      self.errorMessage("");
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
