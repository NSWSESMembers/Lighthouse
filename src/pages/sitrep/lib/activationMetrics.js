/*
  Headline sitrep metrics: unique teams activated during the period, and
  unique volunteers who participated in an activation during the period.

  Both are built from each candidate team's reconstructed status/membership
  intervals (see teamHistoryParsing.js), never from a single current-status
  snapshot -- a team that has been continuously Activated through the whole
  period, with no status change inside it, must still count; so must a
  volunteer who joined before the period and is still on the team.
*/

import { intervalOverlapsWindow, intersectIntervals } from './intervals.js';
import { extractStatusIntervals, extractMembershipIntervals, historyCoversInstant } from './teamHistoryParsing.js';

const ACTIVATED_STATUS = 'activated';

/**
 * @typedef {object} TeamHistoryContext
 * @property {string|number} teamId
 * @property {string} callsign
 * @property {Array<{Name: string, TimeStamp: string}>} historyRows
 * @property {number} historyTotalItems
 * @property {string|null} [teamTypeName]  Beacon team type -- "Field", "Operations", "Aviation" -- for the personnel breakdown
 * @property {Array<{Id: string|number, RegistrationNumber?: string, Person: {Id: string|number, FirstName: string, LastName: string}}>} currentMembers
 */

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build a name -> stable person id lookup from every candidate team's
 * *current* member list combined (a volunteer's id needs to resolve even
 * when the matching history entry belongs to a different team than the one
 * they currently sit on). Only resolves names to an id when exactly one
 * current member across all teams matches -- an ambiguous match (e.g. two
 * "J Smith"s) is left unresolved rather than guessed.
 *
 * @param {TeamHistoryContext[]} teamContexts
 * @returns {Map<string, string|number>}
 */
function buildNameToIdMap(teamContexts) {
  const byName = new Map();
  for (const team of teamContexts) {
    for (const member of team.currentMembers ?? []) {
      const fullName = normalizeName(`${member.Person.FirstName} ${member.Person.LastName}`);
      if (byName.has(fullName) && byName.get(fullName) !== member.Person.Id) {
        byName.set(fullName, null); // ambiguous -- more than one distinct person shares this name
      } else {
        byName.set(fullName, member.Person.Id);
      }
    }
  }
  return byName;
}

/**
 * @param {TeamHistoryContext[]} teamContexts
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {{
 *   activatedTeamIds: Set<string|number>,
 *   activatedTeamsWithIncompleteHistory: Set<string|number>,
 * }}
 */
export function computeActivatedTeams(teamContexts, windowStart, windowEnd) {
  const activatedTeamIds = new Set();
  const activatedTeamsWithIncompleteHistory = new Set();

  for (const team of teamContexts) {
    const statusIntervals = extractStatusIntervals(team.historyRows);
    const activatedIntervals = statusIntervals.filter((i) => i.status.toLowerCase() === ACTIVATED_STATUS);

    const overlapsWindow = activatedIntervals.some((i) => intervalOverlapsWindow(i.start, i.end, windowStart, windowEnd));
    if (overlapsWindow) {
      activatedTeamIds.add(team.teamId);
    }

    // Flag when history doesn't reach back to the window start: an
    // undetected Activated interval that began before the oldest fetched
    // entry would make this team a false negative for "activated during
    // the period".
    const coversWindowStart = historyCoversInstant(
      { results: team.historyRows, totalItems: team.historyTotalItems },
      windowStart,
    );
    if (!coversWindowStart) {
      activatedTeamsWithIncompleteHistory.add(team.teamId);
    }
  }

  return { activatedTeamIds, activatedTeamsWithIncompleteHistory };
}

/**
 * @param {TeamHistoryContext[]} teamContexts
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {{
 *   volunteerIds: Set<string|number>,
 *   volunteerIdsByType: Map<string, Set<string|number>>,
 *   nameOnlyDetails: Map<string, {name: string, teams: Set<string|number>}>,
 *   participantKeys: Set<string>,
 *   participantKeysByType: Map<string, Set<string>>,
 *   nameOnlyVolunteers: Set<string>,
 *   teamsWithIncompleteHistory: Set<string|number>,
 * }}
 */
export function computeUniqueVolunteers(teamContexts, windowStart, windowEnd) {
  const volunteerIds = new Set();
  // the same people, grouped by the (lower-cased) type of the team they served on;
  // someone on both a Field and an Operations team appears in both sets, once in volunteerIds
  const volunteerIdsByType = new Map();
  // Everyone who took part, once each: "id:<person id>" when the person could be
  // identified, else "name:<name>" (e.g. someone stood down and since off every
  // team, whose name in history can no longer be matched to an id). A person
  // is counted once however many teams/activations they were on or left.
  const participantKeys = new Set();
  const participantKeysByType = new Map();
  const addParticipant = (key, typeKey) => {
    participantKeys.add(key);
    if (!participantKeysByType.has(typeKey)) participantKeysByType.set(typeKey, new Set());
    participantKeysByType.get(typeKey).add(key);
  };
  const nameOnlyVolunteers = new Set();
  // the same people as nameOnlyVolunteers, as written in history, with the teams they were on
  const nameOnlyDetails = new Map();
  const teamsWithIncompleteHistory = new Set();
  const nameToId = buildNameToIdMap(teamContexts);

  for (const team of teamContexts) {
    const statusIntervals = extractStatusIntervals(team.historyRows).filter(
      (i) => i.status.toLowerCase() === ACTIVATED_STATUS,
    );
    const membershipIntervals = extractMembershipIntervals(team.historyRows);
    const typeKey = (team.teamTypeName || '').trim().toLowerCase();

    const coversWindowStart = historyCoversInstant(
      { results: team.historyRows, totalItems: team.historyTotalItems },
      windowStart,
    );
    if (!coversWindowStart) {
      teamsWithIncompleteHistory.add(team.teamId);
    }

    for (const membership of membershipIntervals) {
      for (const activated of statusIntervals) {
        const overlap = intersectIntervals(membership, activated);
        if (!overlap) continue;
        if (!intervalOverlapsWindow(overlap.start, overlap.end, windowStart, windowEnd)) continue;

        const stableId = nameToId.get(normalizeName(membership.name));
        if (stableId) {
          volunteerIds.add(stableId);
          if (!volunteerIdsByType.has(typeKey)) volunteerIdsByType.set(typeKey, new Set());
          volunteerIdsByType.get(typeKey).add(stableId);
          addParticipant(`id:${stableId}`, typeKey);
        } else {
          // No current member matches this name (they've since left every
          // team we know about) or the name is ambiguous -- fall back to a
          // name-based tally, kept separate from the id-backed count.
          nameOnlyVolunteers.add(normalizeName(membership.name));
          const nameKey = normalizeName(membership.name);
          if (!nameOnlyDetails.has(nameKey)) nameOnlyDetails.set(nameKey, { name: membership.name.trim(), teams: new Set() });
          nameOnlyDetails.get(nameKey).teams.add(team.callsign || team.teamId);
          addParticipant(`name:${normalizeName(membership.name)}`, typeKey);
        }
      }
    }
  }

  return { volunteerIds, volunteerIdsByType, nameOnlyDetails, participantKeys, participantKeysByType, nameOnlyVolunteers, teamsWithIncompleteHistory };
}
