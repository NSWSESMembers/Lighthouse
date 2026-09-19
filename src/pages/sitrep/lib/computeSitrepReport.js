/*
  Combines the raw data fetchSitrepData.js gathers into the finished set of
  sitrep metrics, plus an honest data-completeness summary. This is the
  single entry point other Lighthouse features (a future dashboard,
  handover pack, export) should call to get the same counts as the Sitrep
  Generator -- see the module-level comment in fetchSitrepData.js for why
  the fetch and the calculation are kept as separate steps.
*/

import { computeActivatedTeams, computeUniqueVolunteers } from './activationMetrics.js';
import { filterIncidentsReceivedInWindow, applyIncidentFilters } from './incidentMetrics.js';
import { summariseIncidents } from './incidentStats.js';

/**
 * @param {Awaited<ReturnType<import('./fetchSitrepData.js').fetchSitrepData>>} fetched
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @param {{sectorId?: string|number|null, eventId?: string|number|null}} [incidentFilters]
 * @returns {{
 *   incidentsReceived: number,
 *   incidentStats: ReturnType<import('./incidentStats.js').summariseIncidents>,
 *   teamsActivated: number,
 *   volunteersParticipating: number,
 *   volunteersParticipatingNameOnly: number,
 *   personnelInvolved: {total: number, field: number, operations: number, aviation: number, other: number},
 *   currentlyActivatedTeamIds: Set<string|number>,
 *   dataCompleteness: {
 *     complete: boolean,
 *     level: 'green'|'amber'|'red',
 *     issues: string[],
 *     issueDetails: Record<number, string[]>,  sub-points for the issue at that index (e.g. the unmatched people)
 *   },
 * }}
 */
export function computeSitrepReport(fetched, windowStart, windowEnd, incidentFilters = {}) {
  const { jobs, jobsFetchComplete, teamContexts, teamsFetchComplete, activationLookbackStart } = fetched;

  const filteredJobs = applyIncidentFilters(
    filterIncidentsReceivedInWindow(jobs, windowStart, windowEnd),
    incidentFilters,
  );

  const { activatedTeamIds, activatedTeamsWithIncompleteHistory } = computeActivatedTeams(
    teamContexts,
    windowStart,
    windowEnd,
  );
  const { volunteerIds, participantKeys, participantKeysByType, nameOnlyVolunteers, nameOnlyDetails, teamsWithIncompleteHistory } = computeUniqueVolunteers(
    teamContexts,
    windowStart,
    windowEnd,
  );

  const idCountForType = (typeKey) => [...(participantKeysByType.get(typeKey) ?? [])].filter((k) => k.startsWith('id:')).length;

  const currentlyActivatedTeamIds = new Set(
    teamContexts.filter((t) => teamIsCurrentlyActivated(t)).map((t) => t.teamId),
  );

  const failedHistoryTeams = teamContexts.filter((t) => t.historyFetchFailed).map((t) => t.callsign || t.teamId);
  const incompleteHistoryTeams = new Set([...activatedTeamsWithIncompleteHistory, ...teamsWithIncompleteHistory]);

  const issues = [];
  if (!jobsFetchComplete) {
    issues.push('The incident list may be incomplete: Beacon did not return every page of matching jobs.');
  }
  if (!teamsFetchComplete) {
    issues.push('The team list may be incomplete: Beacon did not return every page of matching teams.');
  }
  if (failedHistoryTeams.length > 0) {
    issues.push(
      `Couldn't get the activation history for: ${failedHistoryTeams.join(', ')}. These teams are left out of the activation and volunteer counts below, rather than shown as zero.`,
    );
  }
  if (incompleteHistoryTeams.size > 0) {
    const callsigns = teamContexts
      .filter((t) => incompleteHistoryTeams.has(t.teamId))
      .map((t) => t.callsign || t.teamId);
    issues.push(
      `The activation history for ${callsigns.join(', ')} doesn't reach back to the start of the reporting period, so an earlier activation or membership change may be missing.`,
    );
  }
  issues.push(
    `Teams are only found if their status changed at some point from ${activationLookbackStart.toISOString()} onward. A team that has stayed in the same status since before then will not appear in this report.`,
  );
  // sub-points shown under an issue in Data Status, keyed by the issue's position
  const issueDetails = {};
  if (nameOnlyVolunteers.size > 0) {
    issueDetails[issues.length] = [...nameOnlyDetails.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `${p.name} (${[...p.teams].join(', ')})`);
    issues.push(
      `${nameOnlyVolunteers.size} participant(s) appear in team history by name only. They have since left every team in this report, so they can't be matched to a person in Beacon. They are counted as "Other" in Personnel involved, once per name, so two different people with the same name would count as one.`,
    );
  }

  return {
    incidentsReceived: filteredJobs.length,
    incidentStats: summariseIncidents(filteredJobs),
    teamsActivated: activatedTeamIds.size,
    volunteersParticipating: volunteerIds.size,
    volunteersParticipatingNameOnly: nameOnlyVolunteers.size,
    // Personnel involved. Counted by Beacon person id: every person who took
    // part, once each, in total and by the type of team they served on (someone
    // on both a Field and an Operations team is in both, once in total).
    // `other` is anyone who could not be matched to a person id by any means
    // (see activationMetrics.js) -- they are counted once per name, in the total
    // and here, but not under a team type.
    personnelInvolved: {
      total: participantKeys.size,
      field: idCountForType('field'),
      operations: idCountForType('operations'),
      aviation: idCountForType('aviation'),
      other: [...participantKeys].filter((k) => k.startsWith('name:')).length,
    },
    currentlyActivatedTeamIds,
    dataCompleteness: {
      // Traffic light: red = something wasn't fully fetched (figures may be
      // wrong); amber = fetched fully but with a caveat worth reading;
      // green = complete. (The standing "teams are only discovered if..."
      // limitation is always listed as a note and doesn't change the light.)
      level:
        !(jobsFetchComplete && teamsFetchComplete && failedHistoryTeams.length === 0 && incompleteHistoryTeams.size === 0)
          ? 'red'
          : nameOnlyVolunteers.size > 0
            ? 'amber'
            : 'green',
      complete: jobsFetchComplete && teamsFetchComplete && failedHistoryTeams.length === 0 && incompleteHistoryTeams.size === 0,
      issueDetails,
      issues,
    },
  };
}

function teamIsCurrentlyActivated(teamContext) {
  // "Currently activated" (a snapshot, deliberately reported separately from
  // "activated at any point during the period") comes straight from the most
  // recent status-change entry in history, if any is known.
  const rows = [...teamContext.historyRows].sort(
    (a, b) => new Date(a.TimeStamp).getTime() - new Date(b.TimeStamp).getTime(),
  );
  for (let i = rows.length - 1; i >= 0; i--) {
    const match = rows[i].Name?.match(/^Team set as (.+)$/i);
    if (match) return match[1].trim().toLowerCase() === 'activated';
  }
  return false;
}
