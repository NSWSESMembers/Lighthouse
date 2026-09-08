import { request } from './core/request.js';

// Limited to 1000 entries; no paging support.
export function search(Id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/OperationsLog/search?LighthouseFunction=GetOperationsLogfromBeacon&userId=' + userId + '&JobIds%5B%5D=' + Id + '&PageIndex=1&PageSize=1000&SortOrder=desc&SortField=TimeLogged',
    { token },
  );
}

export function get(entryId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/OperationsLog/' + entryId + '?LighthouseFunction=GetOperationsLogEntryfromBeacon&userId=' + userId,
    { token },
  );
}

/**
 * @param {Record<string, unknown>|string} payload  form fields (or a pre-encoded string)
 */
export function create(host, payload, token) {
  return request(host + '/Api/v1/OperationsLog', { method: 'POST', token, form: payload });
}

export function unresolvedActionsLog(job, host, userId = 'notPassed', token) {
  const queryParams = new URLSearchParams({
    DateFrom: new Date(job.jobReceived()).toISOString(),
    DateTo: new Date().toISOString(),
    'JobIds[0]': job.id(),
    ExcludeJobEntries: 'false',
    ExcludeIcemsEntries: 'true',
    UnresolvedActionsOnly: 'true',
    'TagIds[0]': 286,
    'TagIds[1]': 423,
    'TagIds[2]': 285,
    'TagIds[3]': 506,
    'TagIds[4]': 288,
    'TagIds[5]': 290,
    'TagIds[6]': 289,
    'TagIds[7]': 551,
    'TagIds[8]': 291,
    'TagIds[9]': 307,
    'TagIds[10]': 292,
    'TagIds[11]': 424,
    'TagIds[12]': 422,
    'TagIds[13]': 287,
    PageIndex: 1,
    PageSize: 100,
    SortField: 'TimeLogged',
    SortOrder: 'desc',
    LighthouseFunction: 'GetOperationsLogUnresolvedActions',
    userId: userId,
  });

  return request(`${host}/Api/v1/OperationsLog/search?${queryParams.toString()}`, { token });
}
