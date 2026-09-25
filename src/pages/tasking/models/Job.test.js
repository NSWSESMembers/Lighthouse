// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import ko from 'knockout';
import { Job } from './Job.js';
import { Enum } from '../utils/enum.js';

describe('derived computeds', () => {
  it('derive from jobStatusType/jobPriorityType/jobType', () => {
    const j = new Job({
      JobStatusType: { Id: 2, Name: 'Active' },
      JobPriorityType: { Id: 1, Name: 'Rescue' },
      JobType: { Id: 5, Name: 'Flood' },
    });
    expect(j.statusId()).toBe(2);
    expect(j.statusName()).toBe('Active');
    expect(j.priorityId()).toBe(1);
    expect(j.priorityName()).toBe('Rescue');
    expect(j.typeName()).toBe('Flood');
  });

  it('falls back typeName to the raw type string when there is no jobType object', () => {
    const j = new Job({ Type: 'Storm' });
    expect(j.typeName()).toBe('Storm');
  });

  it('resolves jobStatusType/jobPriorityType from the *TypeId fallback when the full object is missing', () => {
    // Some push payloads (jobCreated/jobUpdated) only carry the id.
    const j = new Job({ JobStatusTypeId: 4, JobPriorityTypeId: 1 }); // Tasked / Rescue
    expect(j.statusName()).toBe('Tasked');
    expect(j.priorityName()).toBe('Rescue');
  });

  it('is blank when there is neither the object nor a resolvable id', () => {
    const j = new Job({});
    expect(j.statusName()).toBe('');
    expect(j.statusId()).toBeNull();
  });
});

describe('statusNameAndCount', () => {
  function taskingStub(status) {
    return { currentStatus: () => status, currentStatusId: () => null };
  }

  it('appends the raw tasking count for Active/Tasked statuses', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.taskings.push(taskingStub('Tasked'));
    j.taskings.push(taskingStub('Complete'));
    expect(j.statusNameAndCount()).toBe('Active (2)');
  });

  it('counts only Tasked/Enroute/Onsite taskings when config.taskingCountActiveOnly is set', () => {
    const config = { taskingCountActiveOnly: () => true };
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } }, { config });
    j.taskings.push(taskingStub('Tasked'));
    j.taskings.push(taskingStub('Enroute'));
    j.taskings.push(taskingStub('CalledOff'));
    expect(j.statusNameAndCount()).toBe('Active (2)');
  });

  it('does not append a count for other statuses', () => {
    const j = new Job({ JobStatusType: { Id: 6, Name: 'Complete' } });
    j.taskings.push(taskingStub('Complete'));
    expect(j.statusNameAndCount()).toBe('Complete');
  });
});

describe('can*Job status gating', () => {
  // [statusName/Id, canAcknowledge, canReject, canTask, canReopen]
  it.each([
    ['New', 1, true, true, true, false],
    ['Active', 2, false, true, true, false],
    ['Rejected', 3, true, false, false, false],
    ['Tasked', 4, false, false, true, false],
    ['Referred', 5, false, false, true, false],
    ['Complete', 6, false, false, false, true],
    ['Cancelled', 7, false, false, false, true],
    ['Finalised', 8, false, false, false, true],
  ])('gates from %s', (_name, statusId, ack, reject, task, reopen) => {
    const j = new Job({ JobStatusType: { Id: statusId, Name: _name } });
    expect(j.canAcknowledgeJob(), 'canAcknowledgeJob').toBe(ack);
    expect(j.canRejectJob(), 'canRejectJob').toBe(reject);
    expect(j.canTaskJob(), 'canTaskJob').toBe(task);
    expect(j.canReopenJob(), 'canReopenJob').toBe(reopen);
  });
});

describe('canCompleteJob', () => {
  function taskingWithStatus(id) {
    return { currentStatusId: () => id };
  }

  it('is true for an open job with no taskings and no suppliers', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    expect(j.canCompleteJob()).toBe(true);
  });

  it('is false while any tasking is still active (not Complete/CalledOff/Untasked)', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.taskings.push(taskingWithStatus(1)); // Tasked -- still active
    expect(j.canCompleteJob()).toBe(false);
  });

  it('is true once every tasking is Complete/CalledOff/Untasked', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.taskings.push(taskingWithStatus(6)); // Complete
    j.taskings.push(taskingWithStatus(7)); // CalledOff
    j.taskings.push(taskingWithStatus(2)); // Untasked
    expect(j.canCompleteJob()).toBe(true);
  });

  it('is false while any supplier is not Complete/Cancelled', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.suppliers.push({ Status: { Id: 1 } }); // Requested
    expect(j.canCompleteJob()).toBe(false);
  });

  it('is true once every supplier is Complete or Cancelled', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.suppliers.push({ Status: { Id: 3 } }); // Complete
    j.suppliers.push({ Status: { Id: 4 } }); // Cancelled
    expect(j.canCompleteJob()).toBe(true);
  });

  it.each([6, 7, 8, 3, 5])('is false when the job status itself is terminal (%i)', (statusId) => {
    const j = new Job({ JobStatusType: { Id: statusId } });
    expect(j.canCompleteJob()).toBe(false);
  });
});

describe('canCancelJob', () => {
  it('is false for a Rejected job by default', () => {
    const j = new Job({ JobStatusType: { Id: 3, Name: 'Rejected' } });
    expect(j.canCancelJob()).toBe(false);
  });

  it('is true for a Rejected job specifically when the priority is Rescue', () => {
    const j = new Job({ JobStatusType: { Id: 3, Name: 'Rejected' }, JobPriorityType: { Id: 1, Name: 'Rescue' } });
    expect(j.canCancelJob()).toBe(true);
  });

  it('is false while any tasking is still active', () => {
    const j = new Job({ JobStatusType: { Id: 2, Name: 'Active' } });
    j.taskings.push({ currentStatusId: () => 1 }); // Tasked
    expect(j.canCancelJob()).toBe(false);
  });
});

describe('addTasking / removeTasking', () => {
  function makeTasking(id) {
    return { id: ko.observable(id), job: null, setJob(newJob) { this.job = newJob || null; } };
  }

  it('adds a tasking once and is a no-op for a duplicate id', () => {
    const j = new Job({});
    const t = makeTasking('t1');
    j.addTasking(t);
    j.addTasking(t);
    expect(j.taskings().filter((x) => x === t)).toHaveLength(1);
  });

  it('ignores objects without an id() function', () => {
    const j = new Job({});
    expect(() => j.addTasking({})).not.toThrow();
    expect(() => j.addTasking(null)).not.toThrow();
    expect(j.taskings()).toHaveLength(0);
  });

  it('removeTasking removes by id', () => {
    const j = new Job({});
    const t = makeTasking('t1');
    j.addTasking(t);
    j.removeTasking(t);
    expect(j.taskings()).toHaveLength(0);
  });

  it('fixes the tasking backref to point at this job when adding', () => {
    const j = new Job({});
    const t = makeTasking('t1');
    j.addTasking(t);
    expect(t.job).toBe(j);
  });
});

describe('isPinned / togglePinned', () => {
  it('reflects the injected isIncidentPinned predicate', () => {
    const j = new Job({ Id: 'job1' }, { isIncidentPinned: (id) => id === 'job1' });
    expect(j.isPinned()).toBe(true);
  });

  it('swallows a throwing isIncidentPinned and reports false', () => {
    const j = new Job({ Id: 'job1' }, { isIncidentPinned: () => { throw new Error('boom'); } });
    expect(j.isPinned()).toBe(false);
  });

  it('togglePinned calls toggleIncidentPinned with the job id and stops event propagation', () => {
    const toggleIncidentPinned = vi.fn();
    const j = new Job({ Id: 'job1' }, { toggleIncidentPinned });
    const e = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
    const result = j.togglePinned(null, e);
    expect(toggleIncidentPinned).toHaveBeenCalledWith('job1');
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('togglePinned swallows a throwing toggleIncidentPinned', () => {
    const j = new Job({ Id: 'job1' }, { toggleIncidentPinned: () => { throw new Error('boom'); } });
    expect(() => j.togglePinned(null, null)).not.toThrow();
  });
});

describe('actionRequiredTagsGrouped', () => {
  it('groups by name (case-insensitively), suffixing a ×N count when duplicated', () => {
    const j = new Job({
      ActionRequiredTags: [
        { Id: 1, Name: 'Callback', TagGroupId: 27 },
        { Id: 2, Name: 'callback', TagGroupId: 27 },
        { Id: 3, Name: 'Other', TagGroupId: 27 },
      ],
    });
    const labels = j.actionRequiredTagsGrouped().map((g) => g.label);
    expect(labels).toEqual(['Callback ×2', 'Other']);
  });

  it('the constructor already filters to TagGroupId 27', () => {
    const j = new Job({
      ActionRequiredTags: [
        { Id: 1, Name: 'Keep', TagGroupId: 27 },
        { Id: 2, Name: 'Drop', TagGroupId: 99 },
      ],
    });
    expect(j.actionRequiredTags().map((t) => t.name())).toEqual(['Keep']);
  });
});

describe('actionRequiredCountLabel', () => {
  it('counts raw tags, not the deduplicated/grouped list', () => {
    const j = new Job({
      ActionRequiredTags: [
        { Id: 1, Name: 'Callback', TagGroupId: 27 },
        { Id: 2, Name: 'callback', TagGroupId: 27 },
      ],
    });
    expect(j.actionRequiredTagsGrouped().length).toBe(1);
    expect(j.actionRequiredCountLabel()).toBe('2 outstanding actions');
  });

  it('singularises for exactly one outstanding action', () => {
    const j = new Job({ ActionRequiredTags: [{ Id: 1, Name: 'Callback', TagGroupId: 27 }] });
    expect(j.actionRequiredCountLabel()).toBe('1 outstanding action');
  });

  it('reads "0 outstanding actions" when there are none', () => {
    const j = new Job({});
    expect(j.actionRequiredCountLabel()).toBe('0 outstanding actions');
  });
});

describe('icemsAgencies badge/icon mapping', () => {
  it('prefers ResourceStatus over AgencyStatus when present and not Closed', () => {
    const j = new Job({});
    j._icemsAgenciesRaw.push({ Name: 'NSWSES', ResourceStatusId: 4, AgencyStatusId: 3 }); // On Scene vs Responded
    const [agency] = j.icemsAgencies();
    expect(agency.badgeClass).toBe('bg-success'); // ResourceStatus 4
    expect(agency.iconClass).toBe('fas fa-carrot');
  });

  it('falls back to AgencyStatus when AgencyStatusId is Closed', () => {
    const j = new Job({});
    const closedId = Enum.IncidentAgenciesInvolvedStatus.Closed.Id;
    j._icemsAgenciesRaw.push({ Name: 'NSWPF', ResourceStatusId: 4, AgencyStatusId: closedId });
    const [agency] = j.icemsAgencies();
    expect(agency.statusLabel).not.toBe('Unknown');
  });

  it('falls back to a building icon for an unrecognised agency name', () => {
    const j = new Job({});
    j._icemsAgenciesRaw.push({ Name: 'UNKNOWNORG', AgencyStatusId: 1 });
    const [agency] = j.icemsAgencies();
    expect(agency.iconClass).toBe('fas fa-building');
    expect(agency.badgeClass).toBe('bg-warning text-dark'); // AgencyStatus Requested
  });
});

describe('toggle/expand/collapse', () => {
  it('flips expanded', () => {
    const j = new Job({});
    expect(j.expanded()).toBe(false);
    j.toggle();
    expect(j.expanded()).toBe(true);
    j.toggle();
    expect(j.expanded()).toBe(false);
  });

  it('expand/collapse set an explicit value', () => {
    const j = new Job({});
    j.expand();
    expect(j.expanded()).toBe(true);
    j.collapse();
    expect(j.expanded()).toBe(false);
  });
});

describe('onStatusOptionClick', () => {
  it('is a no-op for a null option or a disabled one', () => {
    const openJobStatusConfirmModal = vi.fn();
    const j = new Job({}, { openJobStatusConfirmModal });
    j.onStatusOptionClick(null);
    j.onStatusOptionClick({ key: 'Cancel', enabled: false });
    j.onStatusOptionClick({ key: 'Cancel', enabled: ko.observable(false) });
    expect(openJobStatusConfirmModal).not.toHaveBeenCalled();
  });

  // `enabled` is populated exclusively from Job.statusOptions, which always
  // passes a real ko computed (e.g. self.canCancelJob) -- a genuine
  // ko.observable/pureComputed. Note this is NOT the same as "any function":
  // ko.utils.unwrapObservable only calls ko.isObservable() values, so a
  // plain (non-observable) function passed as `enabled` would be treated as
  // truthy regardless of what it returns. That path is untested here because
  // nothing in the codebase actually exercises it.
  it('unwraps a genuine ko observable/computed `enabled`', () => {
    const openJobStatusConfirmModal = vi.fn();
    const j = new Job({}, { openJobStatusConfirmModal });
    j.onStatusOptionClick({ key: 'Cancel', enabled: ko.observable(false) });
    expect(openJobStatusConfirmModal).not.toHaveBeenCalled();
  });

  it('delegates to requestJobStatusChange -> openJobStatusConfirmModal for an enabled option', () => {
    const openJobStatusConfirmModal = vi.fn();
    const j = new Job({}, { openJobStatusConfirmModal });
    j.onStatusOptionClick({ key: 'Cancel', enabled: true });
    expect(openJobStatusConfirmModal).toHaveBeenCalledWith(j, 'Cancel');
  });

  it('accepts a real ko observable/computed `enabled`', () => {
    const openJobStatusConfirmModal = vi.fn();
    const j = new Job({}, { openJobStatusConfirmModal });
    j.onStatusOptionClick({ key: 'Reopen', enabled: ko.observable(true) });
    expect(openJobStatusConfirmModal).toHaveBeenCalledWith(j, 'Reopen');
  });

  it('closes the bootstrap dropdown menu/toggle found via the event target', () => {
    document.body.innerHTML = `
      <div class="dropdown">
        <button data-bs-toggle="dropdown" class="show" aria-expanded="true"></button>
        <div class="dropdown-menu show"></div>
        <span id="click-target"></span>
      </div>
    `;
    const j = new Job({}, { openJobStatusConfirmModal: vi.fn() });
    const target = document.getElementById('click-target');
    j.onStatusOptionClick({ key: 'Cancel', enabled: true }, { target });

    expect(document.querySelector('.dropdown-menu').classList.contains('show')).toBe(false);
    const toggle = document.querySelector('[data-bs-toggle="dropdown"]');
    expect(toggle.classList.contains('show')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('onStatusNameClick', () => {
  it('refreshes data only when the dropdown is opening (className ends with " show")', () => {
    const fetchJobById = vi.fn((_id, cb) => cb(null));
    const j = new Job({ Id: 'job1' }, { fetchJobById });
    j.onStatusNameClick(null, { delegateTarget: { className: 'jobstatus-dropdown-btn show' } });
    expect(fetchJobById).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the dropdown is closing', () => {
    const fetchJobById = vi.fn((_id, cb) => cb(null));
    const j = new Job({ Id: 'job1' }, { fetchJobById });
    j.onStatusNameClick(null, { delegateTarget: { className: 'jobstatus-dropdown-btn' } });
    expect(fetchJobById).not.toHaveBeenCalled();
  });
});

describe('hasUnacceptedNotifications', () => {
  it('is true only once there are unaccepted notifications', () => {
    const j = new Job({});
    expect(j.hasUnacceptedNotifications()).toBe(false);
    j.unacceptedNotifications.push({});
    expect(j.hasUnacceptedNotifications()).toBe(true);
  });
});
