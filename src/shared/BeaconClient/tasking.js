import { request } from './core/request.js';

// The POST/PUT/DELETE tasking endpoints intermittently return 500 despite
// applying the change; callers re-sync from SignalR, so a failed response is
// swallowed (nullOnError) rather than thrown.

export function task(teamID, jobId, host, userId = 'notPassed', token) {
  return request(host + '/Api/v1/Tasking', {
    method: 'POST',
    token,
    json: {
      TeamIds: [teamID],
      JobIds: [jobId],
      LighthouseFunction: 'client.TaskTeam',
      userId: userId,
    },
    nullOnError: true,
  });
}

export function updateTeamStatus(host, taskingID, status, payload, token) {
  return request(host + '/Api/v1/Tasking/' + taskingID + '/' + status, {
    method: 'POST',
    token,
    json: payload,
    nullOnError: true,
  });
}

export function callOffTeam(host, taskingID, payload, token) {
  return request(host + '/Api/v1/Tasking/' + taskingID + '/Calloff', {
    method: 'PUT',
    token,
    json: payload,
    nullOnError: true,
  });
}

/**
 * @param {Record<string, unknown>|string} payload  form fields (or a pre-encoded string)
 */
export function untaskTeam(host, taskingID, payload, token) {
  return request(host + '/Api/v1/Tasking/' + taskingID, {
    method: 'DELETE',
    token,
    form: payload,
    nullOnError: true,
  });
}

export async function sequence(sequenceBody, host, token) {
  try {
    await request(host + '/Api/v1/Tasking/Sequences', {
      method: 'PUT',
      token,
      json: sequenceBody,
      responseType: 'none',
    });
    return true;
  } catch (_) {
    return false;
  }
}
