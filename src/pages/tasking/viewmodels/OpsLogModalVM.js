/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { addMinutesToInputTime, statusColorClass } from "../models/Tasking.js";
import { beaconErrorMessage } from "../utils/beaconError.js";

// The banner text for a failed status change or tasking (BeaconApiError,
// network error, or an error carrying a userMessage): Beacon's own message
// where it gave one. The full error goes to the console (logSubmitFailure).
function describeStatusError(err) {
  if (err && err.userMessage) return err.userMessage;
  if (err && err.name === "BeaconApiError") {
    const msg = beaconErrorMessage(err);
    if (msg) return msg;
    if (err.status === 401 || err.status === 403) return "Beacon refused the request (your session may have expired)";
    return `Beacon returned ${err.status}${err.statusText ? " " + err.statusText : ""}`;
  }
  return "Couldn't reach Beacon";
}

function submitFailureMessage(err) {
  return `${describeStatusError(err).replace(/[.\s]+$/, "")}. Try again.`;
}

function logSubmitFailure(what, err) {
  if (err && err.name === "BeaconApiError") {
    console.error(`${what}: ${err.message}`, { status: err.status, statusText: err.statusText, url: err.url, body: err.body }, err);
  } else {
    console.error(`${what}:`, err);
  }
}

// A 5xx or a network error doesn't mean the change didn't happen -- Beacon's
// tasking endpoints have been known to 500 after applying it -- so the caller
// re-checks before reporting a failure. A 4xx, or our own error with a
// userMessage, is a real "no".
function isUncertainFailure(err) {
  if (!err || err.userMessage || err.name === "AbortError") return false;
  if (err.name === "BeaconApiError") return err.status >= 500;
  return true;
}

// Tasking.currentStatus once each status action has gone through.
const STATUS_AFTER_ACTION = {
  Enroute: "enroute",
  Onsite: "onsite",
  Offsite: "offsite",
  CallOff: "calledoff",
  Untask: "untasked",
};

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

  // The alert sits at the top of the (scrollable) modal body, but Submit is in
  // the footer and the body is often scrolled down by then (e.g. with the
  // status-change panel open) -- scroll back up so the error is seen. Waits a
  // frame so the deferred KO update has shown it.
  self.showError.subscribe((shown) => {
    if (!shown) return;
    requestAnimationFrame(() => {
      document.querySelector('#CreateOpsLogModal .modal-body')
        ?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

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

  // Run a status change or tasking. If Beacon's answer leaves it unclear
  // whether it went through (see isUncertainFailure), reload the incident's
  // taskings and resolve anyway if landed() now says it did -- so the log
  // still saves and a retry doesn't send it twice. Otherwise rethrow; the
  // reload means a retry is checked against fresh data.
  async function applyAndConfirm(job, apply, landed) {
    try {
      await apply();
    } catch (err) {
      if (!isUncertainFailure(err) || !job || !parentVM.reloadJobTaskings) throw err;
      const reloaded = await parentVM.reloadJobTaskings(job);
      ko.tasks.runEarly(); // let computeds (activeTasking) see the reload
      if (reloaded && landed()) {
        console.warn("Beacon returned an error, but the change went through:", err);
        return;
      }
      throw err;
    }
  }

  // ── Team status change ──
  // Shown whenever the Incident + Team fields point at a tasking -- whether the
  // dialog was opened from a tasking row, or the user filled them in after
  // opening it from a team row or blank. A draft only: nothing is sent until
  // Submit, which changes the status first and only creates the log if that
  // worked (see submit). The options and their enabled rules are read live from
  // the Tasking, so they follow SignalR updates while the dialog is open.
  self.tasking = ko.observable(null); // the tasking row it was opened from, if any
  self.teamPickedAsset = ko.observable(null); // asset picked in the Team field
  self.pendingStatusKey = ko.observable(null); // null = no change
  self.statusTimeOverride = ko.observable(false);
  self.statusTime = ko.observable(null);
  self.statusEta = ko.observable(null);
  self.statusEtc = ko.observable(null);
  self.statusReason = ko.observable("");

  const norm = (s) => String(s || "").trim().toLowerCase();

  // The incident the log will be attached to: jobId is only set by picking a
  // suggestion, and editing the text afterwards detaches it (jobIdInput no
  // longer matches), so the status change follows what the log will record.
  self.resolvedJob = ko.pureComputed(() => {
    const id = self.jobId();
    if (id == null || id === "") return null;
    const opened = self.tasking()?.job;
    const job = opened && String(opened.id()) === String(id)
      ? opened
      : ko.unwrap(self.parentVM.jobs).find(j => String(j.id()) === String(id));
    if (!job || self.jobIdInput() !== (job.identifier() || "")) return null;
    return job;
  });

  // Callsigns the Team field could mean: the typed text, plus -- if a trackable
  // asset was picked and the text is still its name -- the callsigns of the
  // teams that asset is matched to (an asset's name isn't always the callsign).
  self.teamCallsignCandidates = ko.pureComputed(() => {
    const text = norm(self.teamInput());
    if (!text) return [];
    const names = [text];
    const asset = self.teamPickedAsset();
    if (asset && norm(asset.name()) === text) {
      (ko.unwrap(asset.matchingTeams) || []).forEach(t => names.push(norm(t.callsign())));
    }
    return names;
  });

  // That team's active tasking on that incident -- one whose status can still
  // change. A finished one (complete, called off, untasked) doesn't count: the
  // team can be tasked again instead (see canTaskTeam).
  self.activeTasking = ko.pureComputed(() => {
    const job = self.resolvedJob();
    const names = self.teamCallsignCandidates();
    if (!job || !names.length) return null;
    return job.taskings().find(ts => names.includes(norm(ts.teamCallsign())) && !ts.cannotUpdateStatus()) || null;
  });

  self.showStatusChange = ko.pureComputed(() => !!self.activeTasking());

  // ── Task Team (the team isn't tasked to the incident) ──
  // Same idea as the status change: a choice only, sent on Submit before the
  // log is saved. "Task Team & SMS" also opens Send SMS once the dialog closes.

  // The Team model the Team field means: the picked asset's matched team, the
  // team of the tasking row it was opened from, or a team with that callsign.
  self.resolvedTeam = ko.pureComputed(() => {
    const text = norm(self.teamInput());
    if (!text) return null;
    const asset = self.teamPickedAsset();
    if (asset && norm(asset.name()) === text) {
      const matched = (ko.unwrap(asset.matchingTeams) || [])[0];
      if (matched) return matched;
    }
    const opened = self.tasking()?.team;
    if (opened && norm(opened.callsign()) === text) return opened;
    return (ko.unwrap(self.parentVM.teams) || []).find(t => norm(t.callsign()) === text) || null;
  });
  self.resolvedTeamCallsign = ko.pureComputed(() => self.resolvedTeam()?.callsign() || "");

  self.pendingTask = ko.observable(null); // null | "task" | "taskSms"

  // Offered once the incident's taskings have loaded (so an existing tasking
  // isn't missed) and the incident can still be tasked.
  self.canTaskTeam = ko.pureComputed(() => {
    const job = self.resolvedJob();
    if (!job || !self.resolvedTeam() || self.activeTasking()) return false;
    if (job.taskingLoading?.()) return false;
    return job.canTaskJob ? !!job.canTaskJob() : true;
  });

  self.toggleTaskTeam = () => self.pendingTask(self.pendingTask() === "task" ? null : "task");
  self.toggleTaskTeamSms = () => self.pendingTask(self.pendingTask() === "taskSms" ? null : "taskSms");
  self.taskTeamSelected = ko.pureComputed(() => self.pendingTask() === "task");
  self.taskTeamSmsSelected = ko.pureComputed(() => self.pendingTask() === "taskSms");
  self.taskTeamBtnCss = ko.pureComputed(() => self.taskTeamSelected() ? "btn-primary" : "btn-outline-primary");
  self.taskTeamSmsBtnCss = ko.pureComputed(() => self.taskTeamSmsSelected() ? "btn-primary" : "btn-outline-primary");

  // Send SMS waiting for the dialog to close: set once "Task Team & SMS" has
  // tasked the team, so it still opens if the log needed a retry.
  self._smsAfterSubmit = null;

  self.currentStatusLabel = ko.pureComputed(() => self.activeTasking()?.currentStatus() || "");
  self.currentStatusCss = ko.pureComputed(() => statusColorClass(self.currentStatusLabel()));
  self.statusOptions = ko.pureComputed(() => self.activeTasking()?.statusOptions() || []);
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

  self.submitLabel = ko.pureComputed(() => {
    if (self.showStatusChange() && self.pendingStatusOption()) return `Submit & ${self.pendingStatusLabel()}`;
    if (self.canTaskTeam() && self.pendingTask() === "task") return "Submit & Task Team";
    if (self.canTaskTeam() && self.pendingTask() === "taskSms") return "Submit, Task Team & SMS";
    return "Submit";
  });

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


  self.statusQuickButtons = [1, 5, 10, 30, 60].map(minutes => ({ label: `+${minutes}`, minutes }));
  self.onStatusEtaQuickButtonClick = (btn) => self.statusEta(addMinutesToInputTime(self.statusEta(), btn.minutes));
  self.onStatusEtcQuickButtonClick = (btn) => self.statusEtc(addMinutesToInputTime(self.statusEtc(), btn.minutes));

  self.submitting = ko.observable(false);

  // Hide the dialog, then run fn once it has fully closed -- opening another
  // Bootstrap modal mid-hide leaves body.modal-open in a bad state.
  function hideThen(fn) {
    const modalEl = document.getElementById('CreateOpsLogModal');
    if (fn && modalEl && self.modalInstance) {
      modalEl.addEventListener('hidden.bs.modal', () => fn(), { once: true });
      self.modalInstance.hide();
      return;
    }
    if (self.modalInstance) self.modalInstance.hide();
    if (fn) fn();
  }

  // Order matters: the status change or tasking goes first and the log is only
  // created if it worked, so the log never records a change that didn't
  // happen. Complete is the exception -- it isn't an API call but a hand-off
  // to Beacon's completion screen, which opens once the log has saved -- and so
  // is the SMS from "Task Team & SMS", which opens after the dialog closes.
  self.submit = async function () {
    if (self.submitting() || !validate()) {
        return;
    }

    const tasking = self.activeTasking();
    const option = tasking ? self.pendingStatusOption() : null;
    const callsign = tasking ? tasking.teamCallsign() : "";
    const taskMode = self.pendingTask();
    const job = self.resolvedJob();
    const team = self.resolvedTeam();

    // A status was picked but the tasking stopped being active (e.g. called
    // off elsewhere) -- don't silently log without it.
    if (self.pendingStatusKey() && !tasking) {
        showSubmitError(`${self.resolvedTeamCallsign() || "The team"}'s tasking on this incident is no longer active, so the status can't be changed. Pick "No change" or update the Incident/Team. Nothing was submitted.`);
        return;
    }
    if (option && !option.enabled) {
        showSubmitError(`${callsign} is now ${tasking.currentStatus()}, so "${option.label}" isn't available any more. Pick another status or "No change". Nothing was submitted.`);
        return;
    }
    if (option && option.key === "Complete" && !tasking.taskCompletionLink()) {
        showSubmitError("Can't open the completion screen in Beacon from this page (no Beacon source). Nothing was submitted.");
        return;
    }
    if (taskMode && !self.canTaskTeam()) {
        showSubmitError(tasking
            ? `${callsign} has just been tasked to this incident, so it won't be tasked again. Use the status menu instead. Nothing was submitted.`
            : "The team can't be tasked to this incident any more. Nothing was submitted.");
        self.pendingTask(null);
        return;
    }

    self.submitting(true);
    try {
        let tasked = false;
        if (taskMode) {
            try {
                // Before this, the team had no active tasking here (canTaskTeam).
                // Checks the team/job captured at Submit, not the live fields.
                await applyAndConfirm(job, () => parentVM.applyTaskTeam(team, job), () =>
                  job.taskings().some(ts => ts.team && ts.team.id() === team.id() && !ts.cannotUpdateStatus()));
            } catch (err) {
                logSubmitFailure(`Task ${team.callsign()} to ${job.identifier()} failed`, err);
                showSubmitError(submitFailureMessage(err));
                return;
            }
            tasked = true;
            // It landed -- a retry after a failed log mustn't task again, but the
            // SMS still opens once the dialog closes.
            self.pendingTask(null);
            if (taskMode === "taskSms") self._smsAfterSubmit = { team, job };
        }

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
                await applyAndConfirm(
                  tasking.job,
                  () => parentVM.applyTaskingStatusChange(tasking, action, payload),
                  () => (tasking.currentStatus() || "").toLowerCase() === STATUS_AFTER_ACTION[action],
                );
            } catch (err) {
                logSubmitFailure(`Change ${callsign} to "${option.label}" failed`, err);
                showSubmitError(submitFailureMessage(err));
                return;
            }
            statusChanged = true;
            // It landed -- drop the draft so retrying a failed log doesn't send it again.
            self.clearPendingStatus();
        }

        const result = await new Promise(resolve => parentVM.createOpsLogEntry(self.toPayload(), resolve));
        if (!result) {
            console.error("Ops Log submit failed");
            let message = "The log entry didn't save. Please try again.";
            if (statusChanged) {
                message = `${callsign} was changed to "${option.label}", but the log entry didn't save. Submit again to retry the log (the status won't be sent twice).`;
            } else if (tasked) {
                message = `${team.callsign()} was tasked to ${job.identifier()}, but the log entry didn't save. Submit again to retry the log (the team won't be tasked twice).`;
            }
            showSubmitError(message);
            return;
        }

        if (option && option.key === "Complete") {
            tasking.openCompletionInBeacon();
        }
        const sms = self._smsAfterSubmit;
        self._smsAfterSubmit = null;
        hideThen(sms ? () => parentVM.attachSendSMSModal([], sms.team, null, sms.job) : null);
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
    self.teamPickedAsset(null);
    self.clearPendingStatus();
    self.pendingTask(null);
    self._smsAfterSubmit = null;
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
      self.teamPickedAsset(suggestion.asset);
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

  // Status change subscriptions -- down here because subscribing wakes the
  // computeds, which read the Incident/Team field observables declared above.

  // Pointing the log at a different incident or team drops any picked status
  // or Task Team. Keyed on the fields, not the tasking, so a tasking that
  // changes under an open dialog (e.g. called off elsewhere) keeps the choice
  // and submit can refuse it with a reason instead of silently dropping it.
  const statusTargetKey = ko.pureComputed(() =>
    `${self.resolvedJob()?.id() ?? ""}|${self.teamCallsignCandidates().join(",")}`
  );
  statusTargetKey.subscribe(() => {
    self.clearPendingStatus();
    self.pendingTask(null);
  });

  // A picked incident whose taskings haven't loaded yet (e.g. not expanded in
  // the register) -- load them so the team's tasking can be found.
  // fetchTasking has its own cooldown.
  self.resolvedJob.subscribe(job => {
    if (job && !job.taskings().length && !job.taskingLoading?.()) job.fetchTasking?.();
  });
}
