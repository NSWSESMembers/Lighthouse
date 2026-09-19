/*
  Orchestrates the Beacon API calls a sitrep needs and hands back raw,
  structured data for activationMetrics.js / incidentMetrics.js to compute
  over. Kept separate from those pure calculators so the calculators stay
  unit-testable with plain fixtures, with no BeaconClient/network involved.

  Known Beacon API limitation this works around: Teams/Search only filters
  on the team's *current* status start date (StatusStartDate/StatusEndDate),
  not on any historical activation interval. A team that has been
  continuously Activated since before `activationLookbackStart` -- with no
  further status change -- will not appear in the search at all, and so
  cannot be counted no matter how its History is parsed. `activationLookback`
  bounds the client-side cost of searching further back to catch such teams;
  widening it trades a slower fetch for a lower chance of missing one.
*/

import * as team from '../../../shared/BeaconClient/team.js';
import * as job from '../../../shared/BeaconClient/job.js';

const DEFAULT_ACTIVATION_LOOKBACK_DAYS = 30;
const HISTORY_PAGE_SIZE = 50;
const HISTORY_PAGE_LIMIT = 6; // up to 300 history rows per team

function noop() {
  // default onProgress: nothing to report to
}

/**
 * @param {object} args
 * @param {object|Array|null} args.unit  HQ/unit selection, as BeaconClient expects
 * @param {Date} args.windowStart
 * @param {Date} args.windowEnd
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} args.ctx
 * @param {number} [args.activationLookbackDays]
 * @param {(status: string) => void} [args.onProgress]
 * @returns {Promise<{
 *   jobs: object[],
 *   jobsFetchComplete: boolean,
 *   teamContexts: import('./activationMetrics.js').TeamHistoryContext[],
 *   teamsFetchComplete: boolean,
 *   activationLookbackStart: Date,
 * }>}
 */
export async function fetchSitrepData({
  unit,
  windowStart,
  windowEnd,
  ctx,
  activationLookbackDays = DEFAULT_ACTIVATION_LOOKBACK_DAYS,
  onProgress = noop,
}) {
  const activationLookbackStart = new Date(windowStart.getTime() - activationLookbackDays * 24 * 60 * 60 * 1000);

  onProgress('Fetching incidents…');
  let jobsFetchComplete = true;
  let jobs = [];
  try {
    const jobPage = await job.search(unit, windowStart, windowEnd, ctx);
    jobs = jobPage.results;
    jobsFetchComplete = jobPage.results.length >= jobPage.totalItems;
  } catch (err) {
    jobsFetchComplete = false;
    throw new SitrepFetchError('incidents', err);
  }

  onProgress('Fetching teams…');
  let teamsFetchComplete = true;
  let teamSearchResults = [];
  try {
    const teamPage = await team.search(unit, activationLookbackStart, windowEnd, {
      ...ctx,
      statusTypes: [], // every status -- a team that stood down inside the window still counts
    });
    teamSearchResults = teamPage.results;
    teamsFetchComplete = teamPage.results.length >= teamPage.totalItems;
  } catch (err) {
    teamsFetchComplete = false;
    throw new SitrepFetchError('teams', err);
  }

  onProgress(`Fetching history for ${teamSearchResults.length} team(s)…`);
  const teamContexts = await Promise.all(
    teamSearchResults.map(async (rawTeam) => {
      try {
        const historyPage = await team.getHistory(rawTeam.Id, {
          ...ctx,
          pageLimit: HISTORY_PAGE_LIMIT,
          pageSize: HISTORY_PAGE_SIZE,
        });
        return {
          teamId: rawTeam.Id,
          callsign: rawTeam.Callsign,
          historyRows: historyPage.results,
          historyTotalItems: historyPage.totalItems,
          historyFetchFailed: false,
          teamTypeName: rawTeam.TeamType?.Name ?? null,
          currentMembers: rawTeam.Members ?? [],
        };
      } catch (err) {
        console.error('Sitrep: team history fetch failed for team', rawTeam.Id, err);
        return {
          teamId: rawTeam.Id,
          callsign: rawTeam.Callsign,
          historyRows: [],
          historyTotalItems: 0,
          historyFetchFailed: true,
          teamTypeName: rawTeam.TeamType?.Name ?? null,
          currentMembers: rawTeam.Members ?? [],
        };
      }
    }),
  );

  return {
    jobs,
    jobsFetchComplete,
    teamContexts,
    teamsFetchComplete,
    activationLookbackStart,
  };
}

export class SitrepFetchError extends Error {
  constructor(stage, cause) {
    super(`Sitrep data fetch failed at stage "${stage}": ${cause?.message || cause}`);
    this.name = 'SitrepFetchError';
    this.stage = stage;
    this.cause = cause;
  }
}
