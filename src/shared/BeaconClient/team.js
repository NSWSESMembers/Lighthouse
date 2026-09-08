import $ from 'jquery';
import { request, requestPaginated } from './core/request.js';

// Single-page result only.
export async function getTasking(id, host, userId = 'notPassed', token) {
  const results = await requestPaginated(
    host + '/Api/v1/Tasking/Search?LighthouseFunction=GetTaskingfromBeacon&ViewModelType=1&userId=' + userId + '&TeamIds=' + id,
    { token, pageSize: 100 },
  );
  return { Results: results };
}

// Single-page result only.
export async function getHistory(id, host, userId = 'notPassed', token) {
  const results = await requestPaginated(
    host + '/Api/v1/Teams/' + id + '/History?LighthouseFunction=GetHistoryfromBeacon&userId=' + userId,
    { token, pageLimit: 1, pageSize: 20 },
  );
  return { Results: results };
}

export function get(id, viewModelType = 1, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Teams/' + id + '?LighthouseFunction=GetTeamfromBeacon&userId=' + userId + '&viewModelType=' + viewModelType,
    { token },
  );
}

/**
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entities, or null for "all"
 * @param {object} [opts]
 * @param {number[]} [opts.statusTypes=[]]  StatusTypeId filter
 * @param {number[]} [opts.typeIds=[]]  team TypeIds filter (Field / Operations / Aviation)
 * @param {(collected: number, total: number) => void} [opts.onProgress]
 * @param {(page: any) => void} [opts.onPage]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{Results: any[]}>}
 */
export async function teamSearch(unit, host, StartDate, EndDate, userId = 'notPassed', token, opts = {}) {
  const { statusTypes = [], typeIds = [], onProgress, onPage, signal } = opts;

  const params = {};
  params['StatusStartDate'] = StartDate.toISOString();
  params['StatusEndDate'] = EndDate.toISOString();
  params['SortField'] = 'callsign';
  params['SortOrder'] = 'asc';
  params['StatusTypeId'] = statusTypes;
  params['IncludeDeleted'] = false;

  // Beacon's Teams/Search filters on team type (Field / Operations / Aviation)
  // when given TypeIds -- serialised traditionally as TypeIds=1&TypeIds=3.
  if (Array.isArray(typeIds) && typeIds.length > 0) {
    params['TypeIds'] = typeIds;
  }

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      params['AssignedToId'] = unit.Id;
      params['CreatedAtId'] = unit.Id;
    } else {
      const assignedToId = [];
      const createdAtId = [];
      unit.forEach((d) => {
        assignedToId.push(d.Id);
        createdAtId.push(d.Id);
      });
      params['AssignedToId'] = assignedToId;
      params['CreatedAtId'] = createdAtId;
    }
  }

  const url = host + '/Api/v1/Teams/Search?LighthouseFunction=GetJSONTeamsfromBeacon&userId=' + userId + '&' + $.param(params, true);
  const results = await requestPaginated(url, { token, pageSize: 50, onProgress, onPage, signal });
  return { Results: results };
}

/**
 * Team positions as GeoJson, derived from each team's most recent tasking update.
 *
 * @returns {Promise<{type: 'FeatureCollection', features: any[]}>}
 */
export async function getTeamGeoJson(hqs, host, startDate, endDate, userId = 'notPassed', token) {
  const teamStartRange = new Date();
  teamStartRange.setFullYear(teamStartRange.getFullYear() - 1);
  const teamEndRange = new Date();
  const statusTypes = [3]; // Only activated teams

  const teams = await teamSearch(hqs, host, teamStartRange, teamEndRange, userId, token, {
    statusTypes,
    onProgress: (collected, total) => console.log('teamSearch progress', collected, total),
  });

  const features = await Promise.all(
    teams.Results.map(async (team) => {
      const teamTasking = await getTasking(team.Id, host, userId, token);
      let latestTasking = null;
      let latestTime = null;

      teamTasking.Results.forEach((task) => {
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
