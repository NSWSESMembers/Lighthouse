/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { addMinutesToInputTime, statusColorClass } from "../models/Tasking.js";

// Turns a failed status change (BeaconApiError or network error) into
// something readable for the modal's error banner.
function describeStatusError(err) {
  if (err && err.name === "BeaconApiError") {
    if (err.status === 401 || err.status === 403) {
      return "Beacon refused the request (your session may have expired)";
    }
    let msg = "";
    try {
      const body = JSON.parse(err.body);
      const modelState = body && body.ModelState ? Object.values(body.ModelState).flat()[0] : "";
      msg = (body && (body.Message || body.message || body.ExceptionMessage)) || modelState || "";
    } catch (_) { /* not JSON -- fall back to the status code */ }
    return msg
      ? `Beacon said "${msg}"`
      : `Beacon returned an error (${err.status}${err.statusText ? " " + err.statusText : ""})`;
  }
  return "couldn't reach Beacon";
}

export function CreateOpsLogModalVM(parentVM) {
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

  // Open for a new radio log — auto-selects the "Radio" contact method tag.
  // Optionally prefills the incident (job) and the team field/subject (teamCallsign).
  // Passing the tasking as well enables the team status change in the footer.
  self.openForRadioLog = async ({ job = null, teamCallsign = "", tasking = null } = {}) => {
    self.resetFields();
    const hasJob = job && typeof job.id === 'function';
    const jobIdentifier = hasJob && job.identifier ? job.identifier() || "" : "";
    self.jobId(hasJob ? job.id() || "" : "");
    self.jobIdInput(jobIdentifier);
    if (teamCallsign) {
      self.teamInput(teamCallsign);
      self.subject(teamCallsign);
    }
    const target = [teamCallsign, jobIdentifier].filter(Boolean).join(" on ");
    self.headerLabel(target ? `New Radio Log for ${target}` : "New Radio Log");
    // after the incident/team fields are set, so showStatusChange sees a match
    self.tasking(tasking);
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

  function showSubmitError(message) {
    self.errorMessage(`Error: ${message}`);
    self.showError(true);
  }

  // ── Team status change (radio log opened from a tasking row) ──
  // A draft only: nothing is sent until Submit, which changes the status first
  // and only creates the log if that worked (see submit). The options and their
  // enabled rules are read live from the Tasking, so they follow SignalR
  // updates while the modal is open.
  self.tasking = ko.observable(null);
  self.pendingStatusKey = ko.observable(null); // null = no change
  self.statusTimeOverride = ko.observable(false);
  self.statusTime = ko.observable(null);
  self.statusEta = ko.observable(null);
  self.statusEtc = ko.observable(null);
  self.statusReason = ko.observable("");

  // Only while the incident + team fields still point at the tasking we opened
  // from -- pointing the log somewhere else hides (and clears) the status change.
  self.showStatusChange = ko.pureComputed(() => {
    const ts = self.tasking();
    if (!ts || !ts.job) return false;
    return self.jobIdInput() === (ts.job.identifier() || "")
      && String(self.jobId()) === String(ts.job.id())
      && self.teamInput() === ts.teamCallsign();
  });

  self.currentStatusLabel = ko.pureComputed(() => self.tasking()?.currentStatus() || "");
  self.currentStatusCss = ko.pureComputed(() => statusColorClass(self.currentStatusLabel()));
  self.statusOptions = ko.pureComputed(() => self.tasking()?.statusOptions() || []);
  self.pendingStatusOption = ko.pureComputed(() =>
    self.statusOptions().find(o => o.key === self.pendingStatusKey()) || null
  );
  self.pendingStatusLabel = ko.pureComputed(() => self.pendingStatusOption()?.label || "No change");
  self.pendingStatusCss = ko.pureComputed(() =>
    self.pendingStatusKey() ? statusColorClass(self.pendingStatusKey()) : "bg-secondary text-white"
  );
  // the team's status moved on (e.g. SignalR) and the picked option no longer applies
  self.pendingStatusUnavailable = ko.pureComputed(() => {
    const option = self.pendingStatusOption();
    return !!option && !option.enabled;
  });

  self.pendingNeedsTime = ko.pureComputed(() => !!self.pendingStatusOption()?.needsTimeSet);
  self.pendingNeedsETA = ko.pureComputed(() => !!self.pendingStatusOption()?.needsETA);
  self.pendingNeedsETC = ko.pureComputed(() => !!self.pendingStatusOption()?.needsETC);
  self.pendingNeedsReason = ko.pureComputed(() => !!self.pendingStatusOption()?.needsReason);
  self.showStatusDetails = ko.pureComputed(() => self.showStatusChange()
    && (self.pendingNeedsTime() || self.pendingNeedsETA() || self.pendingNeedsETC() || self.pendingNeedsReason())
  );

  self.submitLabel = ko.pureComputed(() =>
    self.showStatusChange() && self.pendingStatusOption() ? `Submit & ${self.pendingStatusLabel()}` : "Submit"
  );

  self.clearPendingStatus = function () {
    self.pendingStatusKey(null);
    self.statusTimeOverride(false);
    self.statusTime(null);
    self.statusEta(null);
    self.statusEtc(null);
    self.statusReason("");
  };

  self.pickPendingStatus = function (option) {
    if (!option || !option.enabled) return;
    self.clearPendingStatus();
    self.pendingStatusKey(option.key);
    self.statusTime(addMinutesToInputTime(null, 0)); // prefill the override with now
    self._scrollStatusDetailsIntoView();
  };

  // The details box renders at the bottom of the (scrollable) modal body, often
  // below the fold -- bring it into view. Waits a frame so the deferred KO
  // update has rendered it (tasking page sets ko.options.deferUpdates).
  self._scrollStatusDetailsIntoView = function () {
    requestAnimationFrame(() => {
      if (!self.showStatusDetails()) return;
      document.querySelector('#CreateOpsLogModal .ops-log-status-details')
        ?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  self.showStatusChange.subscribe(visible => {
    if (!visible) self.clearPendingStatus();
  });

  self.statusQuickButtons = [1, 5, 10, 30, 60].map(minutes => ({ label: `+${minutes}`, minutes }));
  self.onStatusEtaQuickButtonClick = (btn) => self.statusEta(addMinutesToInputTime(self.statusEta(), btn.minutes));
  self.onStatusEtcQuickButtonClick = (btn) => self.statusEtc(addMinutesToInputTime(self.statusEtc(), btn.minutes));

  self.submitting = ko.observable(false);

  // Order matters: the status change goes first and the log is only created
  // if it worked, so the log never records a change that didn't happen.
  // Complete is the exception -- it isn't an API call but a hand-off to
  // Beacon's completion screen, which opens once the log has saved.
  self.submit = async function () {
    if (self.submitting() || !validate()) {
        return;
    }

    const tasking = self.showStatusChange() ? self.tasking() : null;
    const option = tasking ? self.pendingStatusOption() : null;
    const callsign = tasking ? tasking.teamCallsign() : "";

    if (option && !option.enabled) {
        showSubmitError(`${callsign} is now ${tasking.currentStatus()}, so "${option.label}" isn't available any more. Pick another status or "No change". Nothing was submitted.`);
        return;
    }
    if (option && option.key === "Complete" && !tasking.taskCompletionLink()) {
        showSubmitError("Can't open the completion screen in Beacon from this page (no Beacon source). Nothing was submitted.");
        return;
    }

    self.submitting(true);
    try {
        let statusChanged = false;
        if (option && option.key !== "Complete") {
            const { action, payload } = tasking.buildStatusChange({
                newStatus: option.key,
                time: self.statusTimeOverride() ? self.statusTime() : null, // null = now
                eta: self.statusEta(),
                etc: self.statusEtc(),
                reason: self.statusReason(),
            });
            try {
                await parentVM.applyTaskingStatusChange(tasking, action, payload);
            } catch (err) {
                console.error("Team status change failed:", err);
                showSubmitError(`Couldn't change ${callsign} to "${option.label}": ${describeStatusError(err)}. The log entry was not saved.`);
                return;
            }
            statusChanged = true;
            // It landed -- drop the draft so retrying a failed log doesn't send it again.
            self.clearPendingStatus();
        }

        const result = await new Promise(resolve => parentVM.createOpsLogEntry(self.toPayload(), resolve));
        if (!result) {
            console.error("Ops Log submit failed");
            showSubmitError(statusChanged
                ? `${callsign} was changed to "${option.label}", but the log entry didn't save. Submit again to retry the log (the status won't be sent twice).`
                : "The log entry didn't save. Please try again.");
            return;
        }

        if (option && option.key === "Complete") {
            tasking.openCompletionInBeacon();
        }
        if (self.modalInstance) {
            self.modalInstance.hide();
        }
    } finally {
        self.submitting(false);
    }
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
    self.jobActiveIndex(-1);
    self.teamInput("");
    self.teamInputHasFocus(false);
    self.teamActiveIndex(-1);

    self.tasking(null);
    self.clearPendingStatus();
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
  self.jobActiveIndex = ko.observable(-1);
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
    if (event) {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
    if (suggestion && suggestion.job) {
      self.jobIdInput(suggestion.label);
      self.jobId(suggestion.job.id());
    }
    self.jobIdInputHasFocus(false);
    self.jobActiveIndex(-1);
  };
  self.onJobItemMouseEnter = function(item) {
    const index = self.jobIdSuggestions().indexOf(item);
    if (index >= 0) {
      self.jobActiveIndex(index);
    }
  };
  self.onJobInputKeydown = function(_, event) {
    const suggestions = self.jobIdSuggestions();
    if (!suggestions.length || !self.showJobDropdown()) return true;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = self.jobActiveIndex() < 0
        ? 0
        : Math.min(self.jobActiveIndex() + 1, suggestions.length - 1);
      self.jobActiveIndex(nextIndex);
      return false;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = self.jobActiveIndex() < 0
        ? suggestions.length - 1
        : Math.max(self.jobActiveIndex() - 1, 0);
      self.jobActiveIndex(prevIndex);
      return false;
    }

    if (event.key === "Enter") {
      if (self.jobActiveIndex() >= 0 && self.jobActiveIndex() < suggestions.length) {
        event.preventDefault();
        self.pickJobSuggestion(suggestions[self.jobActiveIndex()], event);
        return false;
      }
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      self.jobIdInputHasFocus(false);
      self.jobActiveIndex(-1);
      return false;
    }

    return true;
  };

  self.teamInput = ko.observable("");
  self.teamInputHasFocus = ko.observable(false);
  self.teamActiveIndex = ko.observable(-1);
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
    if (event) {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
    if (suggestion && suggestion.asset) {
      self.teamInput(suggestion.label);
      self.subject(`${suggestion.label} - ${self.subject()}`);
    }
    self.teamInputHasFocus(false);
    self.teamActiveIndex(-1);
  };
  self.onTeamItemMouseEnter = function(item) {
    const index = self.teamSuggestions().indexOf(item);
    if (index >= 0) {
      self.teamActiveIndex(index);
    }
  };
  self.onTeamInputKeydown = function(_, event) {
    const suggestions = self.teamSuggestions();
    if (!suggestions.length || !self.showTeamDropdown()) return true;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = self.teamActiveIndex() < 0
        ? 0
        : Math.min(self.teamActiveIndex() + 1, suggestions.length - 1);
      self.teamActiveIndex(nextIndex);
      return false;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = self.teamActiveIndex() < 0
        ? suggestions.length - 1
        : Math.max(self.teamActiveIndex() - 1, 0);
      self.teamActiveIndex(prevIndex);
      return false;
    }

    if (event.key === "Enter") {
      if (self.teamActiveIndex() >= 0 && self.teamActiveIndex() < suggestions.length) {
        event.preventDefault();
        self.pickTeamSuggestion(suggestions[self.teamActiveIndex()], event);
        return false;
      }
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      self.teamInputHasFocus(false);
      self.teamActiveIndex(-1);
      return false;
    }

    return true;
  };

  // Helper to scroll dropdown item into view
  self._scrollDropdownItemIntoView = function(dropdownType, itemIndex) {
    if (itemIndex < 0) return;
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      const dropdown = document.querySelector(`ul[data-ops-log-dropdown="${dropdownType}"]`);
      if (!dropdown) return;
      const buttons = dropdown.querySelectorAll('button.dropdown-item');
      if (buttons[itemIndex]) {
        buttons[itemIndex].scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    });
  };

  // Subscribe to job index changes to scroll into view
  self.jobActiveIndex.subscribe((newIndex) => {
    if (self.showJobDropdown()) {
      self._scrollDropdownItemIntoView('job', newIndex);
    }
  });

  // Subscribe to team index changes to scroll into view
  self.teamActiveIndex.subscribe((newIndex) => {
    if (self.showTeamDropdown()) {
      self._scrollDropdownItemIntoView('team', newIndex);
    }
  });
}
