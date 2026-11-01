/*
  CADence simulated exercises (Train and Test Beacon only).

  CADence is a training tool that runs simulated teams in Beacon for an
  exercise. Its backend publishes where each simulated vehicle and vessel is,
  in the same GeoJSON shape as Beacon's `GET /Api/v1/ResourceLocations/Radio`.
  While a member has chosen an exercise on Lighthouse's CADence Simulated
  Exercise page (see cadenceSimulationShare.js), BeaconClient/asset.js reads the
  radio feed from here instead of from Beacon, so the simulated teams draw,
  match their Beacon teams and feed Instant Task suggestions like real radios.

  The backend signs the user in with the Beacon bearer token Lighthouse
  already holds: it checks the issuer, signature, audience and beaconApi
  scope itself, and only trusts the Train and Test Beacon identity servers.
  This module adds a second gate on our side. Only the environments listed in
  ENVIRONMENTS ever call the backend, so a production Beacon token is never
  sent to it, whatever a caller passes in.
*/

import { request } from './BeaconClient/core/request.js';

// A CADence deployment: its backend (`feedBase`, /v1 included) and its radio
// join page (`radioUrl`), which belong together, so a Beacon environment takes
// both from the same deployment. `radioQr` is a static QR code of radioUrl,
// relative to the extension root (static/ in this repo), shown on the CADence
// Simulated Exercise page: make a new one if radioUrl changes.
//
// This is CADence's development deployment, the only one so far. Its backend
// only accepts Train and Test Beacon tokens.
const CADENCE_DEV = Object.freeze({
  feedBase: 'https://api.dev.cadence-extension.com/v1',
  radioUrl: 'https://radio.dev.cadence-extension.com',
  radioQr: 'icons/cadence-radio-dev-qr.svg',
});

// Beacon environments that can run CADence exercises, and the CADence
// deployment each one uses. `api` is the Beacon API base the pages receive as
// `host` (Beacon's urls.Base); `site` is the Beacon site origin they receive
// as `source`. Either identifies the environment.
const ENVIRONMENTS = Object.freeze([
  Object.freeze({
    env: 'train',
    label: 'Train Beacon',
    site: 'https://trainbeacon.ses.nsw.gov.au',
    api: 'https://apitrainbeacon.ses.nsw.gov.au',
    ...CADENCE_DEV,
  }),
  Object.freeze({
    env: 'test',
    label: 'Test Beacon',
    site: 'https://testbeacon.ses.nsw.gov.au',
    api: 'https://apitestbeacon.ses.nsw.gov.au',
    ...CADENCE_DEV,
  }),
]);

/**
 * Thrown by the feed calls. `unavailable` is true when simulated assets can't
 * be used here at all: the Beacon environment isn't Train or Test, the
 * selection is incomplete, or the backend refused the token (401/403). Other
 * failures (network, 5xx) leave it false, so callers can keep the mode and try
 * again on the next refresh.
 */
export class SimulationFeedError extends Error {
  constructor(message, { status = null, unavailable = false, url = null } = {}) {
    super(message);
    this.name = 'SimulationFeedError';
    this.status = status;
    this.unavailable = unavailable;
    this.url = url;
  }
}

/** True when `err` means simulated assets can't be used in this environment. */
export function isSimulationUnavailable(err) {
  return (
    !!err && (err instanceof SimulationFeedError || err.name === 'SimulationFeedError') && err.unavailable === true
  );
}

/** An exercise's name as shown to the user ("Unnamed exercise" when it has none). */
export function exerciseDisplayName(name) {
  return name && String(name).trim() ? String(name).trim() : 'Unnamed exercise';
}

/**
 * How a selected exercise copy is named to the user: the exercise, plus the
 * headquarters for a group exercise ("Storm night · Wollongong"). Plain text,
 * so escape it before putting it in HTML.
 *
 * @param {{exerciseName?: string, copyName?: string, mode?: string}|null} selection
 */
export function simulationLabel(selection) {
  if (!selection) return '';
  const name = exerciseDisplayName(selection.exerciseName);
  return selection.mode === 'group' && selection.copyName ? `${name} · ${selection.copyName}` : name;
}

/**
 * The tooltip of the "Simulated locations" pill in Beacon's navbar
 * (injectscripts/all.js) while `selection` is chosen, or '' for none. It names
 * the exercise only: a job page shows the copy for the job's own HQ, which may
 * not be the one chosen. Plain text: set it as an attribute, never as HTML.
 */
export function simulatedLocationsTitle(selection) {
  if (!selection) return '';
  return (
    'LAD and job maps are showing simulated vehicles and vessels from the CADence exercise ' +
    `${exerciseDisplayName(selection.exerciseName)}, not live radio positions. Click to change or stop.`
  );
}

/** True when two selections (or two nulls) are the same exercise copy. */
export function sameSimulation(a, b) {
  if (!a || !b) return !a && !b;
  return String(a.exerciseId) === String(b.exerciseId) && String(a.copyId) === String(b.copyId);
}

/**
 * The copy of the selected exercise that belongs to one headquarters, as a
 * selection, or null when that HQ has no copy in it. A group exercise gives
 * each participant HQ its own copy, with teams of the same callsigns, so
 * Beacon's job page shows the copy for the job's own HQ rather than the one
 * that was chosen.
 *
 * @param {{exerciseId: string, copyId: string, exerciseName?: string, copyName?: string, mode?: string,
 *   participantHqId?: string,
 *   copies?: Array<{copyId: string, participantHqId: string, participantHqName: string}>}|null} selection
 * @param {string|number|null} hqId  Beacon entity id of the HQ
 */
export function selectionForHq(selection, hqId) {
  if (!selection || hqId == null || String(hqId) === '') return null;
  const hq = String(hqId);
  const copies = Array.isArray(selection.copies) ? selection.copies : [];
  let copy = copies.find((c) => c && String(c.participantHqId) === hq);
  if (!copy && String(selection.participantHqId ?? '') === hq) {
    copy = { copyId: selection.copyId, participantHqId: hq, participantHqName: selection.copyName };
  }
  if (!copy) return null;
  return {
    exerciseId: String(selection.exerciseId),
    copyId: String(copy.copyId),
    exerciseName: String(selection.exerciseName ?? ''),
    copyName: String(copy.participantHqName ?? ''),
    mode: selection.mode === 'group' ? 'group' : 'individual',
    participantHqId: hq,
  };
}

function originOf(value) {
  try {
    return new URL(String(value)).origin;
  } catch (_) {
    return null;
  }
}

/**
 * The CADence environment for a Beacon API host or site URL, or null when
 * simulated exercises aren't offered there (production and everything else).
 *
 * @param {string} hostOrSite  e.g. params.host / urls.Base, or params.source
 * @returns {{env: string, label: string, site: string, api: string, feedBase: string, radioUrl: string,
 *   radioQr: string}|null}
 */
export function simulationEnvironment(hostOrSite) {
  const origin = originOf(hostOrSite);
  if (!origin) return null;
  return ENVIRONMENTS.find((e) => e.api === origin || e.site === origin) || null;
}

function requireEnvironment(host) {
  const environment = simulationEnvironment(host);
  if (!environment) {
    throw new SimulationFeedError('Simulated exercises are only available on Train and Test Beacon', {
      unavailable: true,
    });
  }
  return environment;
}

function feedError(err, url) {
  const status = typeof err?.status === 'number' ? err.status : null;
  return new SimulationFeedError(`CADence feed ${status ?? 'request failed'} (${url})`, {
    status,
    unavailable: status === 401 || status === 403,
    url,
  });
}

// `refreshToken` (optional) gives the newest Beacon token the caller can get,
// renewed if it was about to expire. A 401/403 is often a stale copy: a page
// keeps the token it was handed while Beacon or another page renews the
// stored one, and the backend refuses it once it expires. So a refusal asks
// for the newest token and, if that's a different one, tries once more with
// it. Only a refusal of the newest token makes the error `unavailable`.
async function feedRequest(url, { token, signal, refreshToken }) {
  try {
    return await request(url, { token, signal });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    const refused = err?.status === 401 || err?.status === 403;
    if (refused && typeof refreshToken === 'function') {
      let fresh = null;
      try {
        fresh = await refreshToken();
      } catch (refreshErr) {
        console.warn('[cadence] Could not get a newer Beacon token:', refreshErr);
      }
      if (fresh && fresh !== token) return feedRequest(url, { token: fresh, signal });
    }
    throw feedError(err, url);
  }
}

// A copy's positions only go to teams assigned to its participant HQ (see
// selectionForHq and Asset.exerciseHqId), so a copy without one is dropped.
function normaliseCopy(copy) {
  if (!copy || copy.copyId == null || copy.copyId === '') return null;
  if (copy.participantHqId == null || copy.participantHqId === '') return null;
  return {
    copyId: String(copy.copyId),
    participantHqId: String(copy.participantHqId),
    participantHqName: copy.participantHqName != null ? String(copy.participantHqName) : '',
  };
}

function normaliseExercise(exercise) {
  if (!exercise || exercise.exerciseId == null || exercise.exerciseId === '') return null;
  return {
    exerciseId: String(exercise.exerciseId),
    name: exercise.name != null ? String(exercise.name) : '',
    mode: exercise.mode === 'group' ? 'group' : 'individual',
    createdAt: exercise.createdAt != null ? String(exercise.createdAt) : '',
    copies: (Array.isArray(exercise.copies) ? exercise.copies : []).map(normaliseCopy).filter(Boolean),
  };
}

/**
 * Active exercises visible to the signed-in member's Beacon environment.
 * Copies without a participant HQ are dropped, and so are exercises left with
 * no copy (there would be nothing to show).
 *
 * @param {{host: string, token: string, signal?: AbortSignal, refreshToken?: () => Promise<string|null>}} ctx
 *   refreshToken: the newest Beacon token, asked for once after a 401/403 (see feedRequest)
 * @returns {Promise<Array<{exerciseId: string, name: string, mode: 'group'|'individual', createdAt: string,
 *   copies: Array<{copyId: string, participantHqId: string, participantHqName: string}>}>>}
 */
export async function listExercises(ctx = {}) {
  const { host, token, signal, refreshToken } = ctx;
  const { feedBase } = requireEnvironment(host);
  const body = await feedRequest(`${feedBase}/feed/exercises`, { token, signal, refreshToken });
  const exercises = Array.isArray(body?.exercises) ? body.exercises : [];
  return exercises.map(normaliseExercise).filter((e) => e && e.copies.length > 0);
}

/**
 * Whether a chosen exercise copy is still running, judged from the exercise
 * list. An empty position feed needs this check: the backend sends one for an
 * exercise that has ended, but also for a running one that hasn't published
 * positions yet.
 *
 * @param {{exerciseId: string, copyId: string}} selection
 * @param {{host: string, token: string, signal?: AbortSignal, refreshToken?: () => Promise<string|null>}} ctx
 *   as for listExercises
 * @returns {Promise<'running'|'ended'|'unavailable'|'unknown'>} 'ended' when the exercise or that copy is
 *   no longer listed, 'unavailable' when the backend refused the token (or this isn't Train or Test Beacon),
 *   'unknown' when the list couldn't be loaded (network, 5xx)
 */
export async function selectionStatus(selection, ctx = {}) {
  let exercises;
  try {
    exercises = await listExercises(ctx);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return isSimulationUnavailable(err) ? 'unavailable' : 'unknown';
  }
  const exerciseId = String(selection?.exerciseId ?? '');
  const copyId = String(selection?.copyId ?? '');
  const exercise = exercises.find((e) => e.exerciseId === exerciseId);
  return exercise && exercise.copies.some((c) => c.copyId === copyId) ? 'running' : 'ended';
}

/**
 * The simulated positions for one copy of an exercise, as an array of GeoJSON
 * Features in Beacon's ResourceLocations/Radio shape. The backend returns an
 * empty array once the exercise has ended, for an unknown exercise, for one
 * from another Beacon environment, and for a running exercise that hasn't
 * published positions yet.
 *
 * @param {{exerciseId: string, copyId: string}} selection
 * @param {{host: string, token: string, signal?: AbortSignal, refreshToken?: () => Promise<string|null>}} ctx
 *   as for listExercises
 * @returns {Promise<object[]>}
 */
export async function fetchResourceLocations(selection, ctx = {}) {
  const { host, token, signal, refreshToken } = ctx;
  const { feedBase } = requireEnvironment(host);
  const exerciseId = selection?.exerciseId != null ? String(selection.exerciseId) : '';
  const copyId = selection?.copyId != null ? String(selection.copyId) : '';
  if (!exerciseId || !copyId) {
    throw new SimulationFeedError('No simulated exercise copy selected', { unavailable: true });
  }
  const url =
    `${feedBase}/feed/exercises/${encodeURIComponent(exerciseId)}` +
    `/copies/${encodeURIComponent(copyId)}/resource-locations`;
  const body = await feedRequest(url, { token, signal, refreshToken });
  // Features without a usable name or position can't be drawn or matched.
  return (Array.isArray(body) ? body : []).map(cleanFeature).filter(Boolean);
}

// Simulated features come from outside Beacon, and Lighthouse builds HTML from
// some of their text (the job map's table and markers, the situational
// awareness popups). So text loses the characters that mean something in
// HTML; callsigns, headquarters names and capabilities don't use them.
const HTML_SIGNIFICANT = /[<>&"'`]/g;

function cleanFeature(feature) {
  const properties = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (!properties || properties.name == null || properties.id == null) return null;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const cleaned = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') cleaned[key] = value.replace(HTML_SIGNIFICANT, '');
    else if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' || value === null)
      cleaned[key] = value;
  }
  if (cleaned.name == null || cleaned.name === '') return null;
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: cleaned };
}
