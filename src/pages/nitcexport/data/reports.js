/*
  The two NITC Export reports, from Beacon's NonIncident/Search results
  (ViewModelType 6): pure, no DOM.

  Activity List: one row per task (Non-Incident Task Card), with its
  participants and their hours.
  Member List: one row per member, with their hours under each of the tags
  on the tasks they were part of, and their total.

  The CSV header keeps the old page's column names, so spreadsheets built on
  the old export still line up.
*/

import { isoDateTime } from '../../shared/dates.js';

export const REPORTS = [
  { value: 'activity', id: 'report-activity', label: 'Activity List', hint: 'One row per task, with its participants and their hours.' },
  { value: 'member', id: 'report-member', label: 'Member List', hint: 'One row per member, with their hours under each tag.' },
];

export const ACTIVITY_HEADER = ['Name', 'StartDate', 'EndDate', 'Unit', 'Tags', 'TotalParticipants', 'TotalHours', 'Participants'];

/** The Member List column for hours on tasks with no tags. */
export const NO_TAG = 'No tag';

/** Hours to 2 decimal places, without float dust (0.1 + 0.2 is 0.3). */
export function roundHours(hours) {
  return Math.round(hours * 100) / 100;
}

/**
 * A participant's hours on a task. A participant with no end time of their
 * own (still signed on, or never signed off) gets the task's end; one with
 * no start gets the task's start. Times that don't make sense count 0.
 *
 * @param {{StartDate?: string, EndDate?: string}} participant
 * @param {{StartDate?: string, EndDate?: string}} task
 */
export function participantHours(participant, task) {
  const start = Date.parse(participant.StartDate || task.StartDate);
  const end = Date.parse(participant.EndDate || task.EndDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return roundHours((end - start) / 36e5);
}

const tagNames = (task) => (task.Tags || []).map((t) => t.Name).filter(Boolean);
const personName = (person) => person?.FullName || [person?.FirstName, person?.LastName].filter(Boolean).join(' ') || 'Unknown';

/**
 * Activity List rows, in the order Beacon sent the tasks (newest first).
 * Participants are written `Name[hours]` (PR #608: square brackets, as
 * names can have round ones in them), separated by "; " so a spreadsheet
 * can split them (names have spaces in them, so a space alone can't).
 *
 * @param {object[]} tasks
 * @returns {Array<Array<string|number>>}  cells in ACTIVITY_HEADER order
 */
export function activityRows(tasks) {
  return tasks.map((task) => {
    const people = (task.Participants || []).map((p) => ({ name: personName(p.Person), hours: participantHours(p, task) }));
    return [
      task.Name || '',
      isoDateTime(task.StartDate),
      isoDateTime(task.EndDate),
      task.CreatedAt?.Code || '',
      tagNames(task).join(','),
      people.length,
      roundHours(people.reduce((sum, p) => sum + p.hours, 0)),
      people.map((p) => `${p.name}[${p.hours}]`).join('; '),
    ];
  });
}

/**
 * The Member List: a column per tag (A to Z, with "No tag" last when any
 * task had none), and a row per member (A to Z by name). Members are told
 * apart by their Beacon person id, so two people with the same name get a
 * row each. A task with two tags counts its hours under both, so the tag
 * columns can add up to more than Total Hours.
 *
 * @param {object[]} tasks
 * @returns {{header: string[], rows: Array<Array<string|number>>}}
 */
export function memberReport(tasks) {
  const members = new Map();
  const tags = new Set();
  let untagged = false;

  for (const task of tasks) {
    const names = tagNames(task);
    if (!names.length && (task.Participants || []).length) untagged = true;
    const columns = names.length ? names : [NO_TAG];
    for (const p of task.Participants || []) {
      const key = p.Person?.Id ?? personName(p.Person);
      if (!members.has(key)) members.set(key, { name: personName(p.Person), total: 0, hours: new Map() });
      const member = members.get(key);
      const hours = participantHours(p, task);
      member.total += hours;
      for (const tag of columns) {
        if (tag !== NO_TAG) tags.add(tag);
        member.hours.set(tag, (member.hours.get(tag) || 0) + hours);
      }
    }
  }

  const tagColumns = [...tags].sort((a, b) => a.localeCompare(b, 'en-AU', { sensitivity: 'base' }));
  if (untagged) tagColumns.push(NO_TAG);
  const rows = [...members.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'en-AU', { sensitivity: 'base' }))
    .map((m) => [m.name, roundHours(m.total), ...tagColumns.map((t) => roundHours(m.hours.get(t) || 0))]);
  return { header: ['Name', 'TotalHours', ...tagColumns], rows };
}

/**
 * The header and rows for a report.
 *
 * @param {'activity'|'member'} report
 * @param {object[]} tasks
 */
export function buildReport(report, tasks) {
  return report === 'member' ? memberReport(tasks) : { header: ACTIVITY_HEADER, rows: activityRows(tasks) };
}

/** The column headings the preview shows. */
export const PREVIEW_LABELS = {
  Name: 'Name',
  StartDate: 'Start',
  EndDate: 'End',
  Unit: 'Unit',
  Tags: 'Tags',
  TotalParticipants: 'People',
  TotalHours: 'Total hours',
  Participants: 'Participants [hours]',
};
