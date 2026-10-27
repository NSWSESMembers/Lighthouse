/*
  Beacon calls and errors shared by the pages Beacon opens in a new tab
  (Incident Statistics, Incident Summary, Incident Export). The Beacon client is passed in
  (BeaconClient in the page, a stub in tests).
*/

/**
 * Looks up each HQ id. Done once per page load, the names don't change.
 *
 * @param {{unit: {getName: Function}}} client
 * @param {string[]} hqIds  [] for all of NSW
 * @param {{host: string, userId: string, token: string}} ctx
 * @returns {Promise<object[]>}
 */
export async function loadUnits(client, hqIds, ctx) {
  const units = await Promise.all(hqIds.map((id) => client.unit.getName(id, ctx)));
  return units.filter(Boolean);
}

/**
 * What to tell the user when a load fails.
 *
 * @param {any} err  a BeaconApiError (has `status`) or any Error
 * @param {string} pageName  e.g. "Incident Statistics", for the 401 advice
 */
export function errorText(err, pageName) {
  if (!err) return 'Unknown error';
  if (err.status === 401) return `Beacon refused the request (401). Reopen ${pageName} from Beacon to sign in again.`;
  if (err.status) return `Beacon returned ${err.status}${err.statusText ? ' ' + err.statusText : ''}.`;
  return err.message || String(err);
}
