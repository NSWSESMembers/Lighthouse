import $ from 'jquery';
import { request, requestPaginated } from './core/request.js';
import { PAGING_PARAMS_LENGTH, splitQueryParts } from './core/queryBatches.js';

/**
 * Tasking for a team. Single-page result only.
 *
 * @param {string|number} teamId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function getTasking(teamId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return requestPaginated(
    host + '/Api/v1/Tasking/Search?LighthouseFunction=GetTaskingfromBeacon&ViewModelType=1&userId=' + userId + '&TeamIds=' + teamId,
    { token, signal, pageSize: 100 },
  );
}

/**
 * Team history. Single-page result only (first 20).
 *
 * @param {string|number} teamId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function getHistory(teamId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return requestPaginated(
    host + '/Api/v1/Teams/' + teamId + '/History?LighthouseFunction=GetHistoryfromBeacon&userId=' + userId,
    { token, signal, pageLimit: 1, pageSize: 20 },
  );
}

/**
 * A single team.
 *
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal, viewModelType?: number}} ctx
 * @returns {Promise<object|null>}
 */
export function get(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, viewModelType = 1 } = ctx;
  return request(
    host + '/Api/v1/Teams/' + id + '?LighthouseFunction=GetTeamfromBeacon&userId=' + userId + '&viewModelType=' + viewModelType,
    { token, signal },
  );
}

/**
 * Team search over a status date range. A long list of units is split into
 * as many requests as Beacon's query string limit needs; onProgress and onPage
 * then report per request.
 *
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entities, or null for "all"
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          statusTypes?: number[], typeIds?: number[], onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(unit, startDate, endDate, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, statusTypes = [], typeIds = [], onProgress, onPage } = ctx;

  const params = {};
  params['StatusStartDate'] = startDate.toISOString();
  params['StatusEndDate'] = endDate.toISOString();
  params['SortField'] = 'callsign';
  params['SortOrder'] = 'asc';
  params['StatusTypeId'] = statusTypes;
  params['IncludeDeleted'] = false;

  // Beacon's Teams/Search filters on team type (Field / Operations / Aviation)
  // when given TypeIds -- serialised traditionally as TypeIds=1&TypeIds=3.
  if (Array.isArray(typeIds) && typeIds.length > 0) {
    params['TypeIds'] = typeIds;
  }

  let unitIds = [];
  if (unit !== null || typeof unit === 'undefined') {
    unitIds = Array.isArray(unit) ? unit.map((d) => d.Id) : [unit.Id];
  }

  // A long unit list (every unit selected) is split into as many requests as
  // Beacon's query string limit needs; a team can come back from more than one.
  const fixedQuery = 'LighthouseFunction=GetJSONTeamsfromBeacon&userId=' + userId + '&' + $.param(params, true) + '&';
  const parts = unitIds.map((id) => 'AssignedToId=' + encodeURIComponent(id) + '&CreatedAtId=' + encodeURIComponent(id) + '&');
  const batches = splitQueryParts(parts, fixedQuery.length + PAGING_PARAMS_LENGTH);

  const pages = await Promise.all(
    batches.map((batch) =>
      requestPaginated(host + '/Api/v1/Teams/Search?' + (fixedQuery + batch.join('')).slice(0, -1), { token, signal, pageSize: 50, onProgress, onPage }),
    ),
  );
  if (pages.length === 1) return pages[0];
  const byId = new Map();
  pages.forEach((p) => p.results.forEach((team) => byId.set(team.Id, team)));
  const results = [...byId.values()];
  return { results, totalItems: results.length };
}

/**
 * Team positions as GeoJson, derived from each team's most recent tasking update.
 *
 * @param {Array} hqs
 * @param {Date|null} startDate  tasking-range filter (null = "current", hides finalised)
 * @param {Date|null} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{type: 'FeatureCollection', features: object[]}>}
 */
export async function getTeamGeoJson(hqs, startDate, endDate, ctx = {}) {
  const teamStartRange = new Date();
  teamStartRange.setFullYear(teamStartRange.getFullYear() - 1);
  const teamEndRange = new Date();

  const teams = await search(hqs, teamStartRange, teamEndRange, {
    ...ctx,
    statusTypes: [3], // Only activated teams
    onProgress: (collected, total) => console.log('team.search progress', collected, total),
  });

  const features = await Promise.all(
    teams.results.map(async (team) => {
      const teamTasking = await getTasking(team.Id, ctx);
      let latestTasking = null;
      let latestTime = null;

      teamTasking.results.forEach((task) => {
        const rawStatusTime = new Date(task.CurrentStatusTime);
        const taskTime = new Date(rawStatusTime.getTime());

        if (startDate != null && endDate != null) {
          if (taskTime < startDate || taskTime > endDate) {
            return;
          }
        } else {
          if (
            task.Job.JobStatusType.Name === 'Complete' ||
            task.Job.JobStatusType.Name === 'Finalised' ||
            task.Job.JobStatusType.Name === 'Cancelled' ||
            task.Job.JobStatusType.Name === 'Rejected'
          ) {
            return;
          }
        }

        if (latestTime < taskTime && task.CurrentStatus !== 'Tasked' && task.CurrentStatus !== 'Untasked') {
          latestTasking = task;
          latestTime = taskTime;
        }
      });

      if (latestTasking === null) {
        return null;
      }

      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [latestTasking.Job.Address.Longitude, latestTasking.Job.Address.Latitude],
        },
        properties: {
          teamId: latestTasking.Team.Id,
          teamCallsign: latestTasking.Team.Callsign,
          onsite: latestTasking.Onsite,
          offsite: latestTasking.Offsite,
          currentStatusTime: latestTasking.CurrentStatusTime,
          jobId: latestTasking.Job.Id,
        },
      };

      if (latestTasking.PrimaryTaskType) {
        feature.properties.primaryTask = latestTasking.PrimaryTaskType.Name;
      }

      return feature;
    }),
  );

  return {
    type: 'FeatureCollection',
    features: features.filter((feature) => feature !== null),
  };
}
