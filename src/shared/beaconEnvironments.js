/*
  The Beacon environments Lighthouse pages can be opened for.

  Beacon opens a Lighthouse page with its API base (`host`, Beacon's
  urls.Base), its site origin (`source`) and, for live updates, its SignalR
  hub (`signalr`) in the page's URL, and the page sends the user's Beacon
  token to all three. Anything that can open or frame an extension page can
  choose that URL, so the pages only accept the environments listed here and
  refuse to start (blockUnlessOpenedFromBeacon) for anything else.
*/

// `site` is the `source` param; `api` the `host` params Beacon passes from
// that site.
const ENVIRONMENTS = Object.freeze([
  { env: 'production', site: 'https://beacon.ses.nsw.gov.au', api: ['https://apibeacon.ses.nsw.gov.au'] },
  { env: 'train', site: 'https://trainbeacon.ses.nsw.gov.au', api: ['https://apitrainbeacon.ses.nsw.gov.au'] },
  { env: 'test', site: 'https://testbeacon.ses.nsw.gov.au', api: ['https://apitestbeacon.ses.nsw.gov.au'] },
  { env: 'dev', site: 'https://devbeacon.ses.nsw.gov.au', api: ['https://apidevbeacon.ses.nsw.gov.au'] },
]);

// Beacon Comms SignalR hubs (the manifest's host and optional host
// permissions). Any of them is accepted for any environment: they're all
// Beacon's own.
const SIGNALR_HUBS = Object.freeze([
  'https://beacon-prod-comms.azurewebsites.net',
  'https://beacon-train-comms.azurewebsites.net',
  'https://beacon-test-comms.azurewebsites.net',
  'https://beacon-dev-comms.azurewebsites.net',
]);

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * The environment a `host` (API base) and `source` (site origin) pair belong
 * to, or null when they aren't a known pair. Exact matches only.
 *
 * @param {string} host
 * @param {string} source
 * @returns {'production'|'train'|'test'|'dev'|null}
 */
export function knownBeaconEnvironment(host, source) {
  const site = trimSlash(source);
  const api = trimSlash(host);
  const match = ENVIRONMENTS.find((e) => e.site === site && e.api.includes(api));
  return match ? match.env : null;
}

/** True when `url` is on one of Beacon's SignalR hubs (https only). */
export function isKnownSignalRHub(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && SIGNALR_HUBS.includes(u.origin);
  } catch (_) {
    return false;
  }
}

/**
 * True when this is a real extension page. The docs harnesses serve the
 * built pages over http against a fake Beacon, where nothing is checked.
 */
export function isExtensionPage(loc = globalThis.location) {
  return loc?.protocol === 'chrome-extension:';
}

/**
 * True when the page's `host`, `source` and (if any) `signalr` params are a
 * known Beacon environment, or this isn't an extension page.
 *
 * @param {{host?: string, source?: string, signalr?: string}} params
 */
export function pageParamsAllowed({ host, source, signalr } = {}, loc = globalThis.location) {
  if (!isExtensionPage(loc)) return true;
  if (!knownBeaconEnvironment(host, source)) return false;
  return !signalr || isKnownSignalRHub(signalr);
}

/**
 * Stop the page unless it was opened from Beacon (pageParamsAllowed): shows
 * a short message in place of the page and throws, so call it before the
 * page reads the Beacon token or starts anything.
 *
 * @param {{host?: string, source?: string, signalr?: string}} params
 */
export function blockUnlessOpenedFromBeacon(params) {
  if (pageParamsAllowed(params)) return;
  const show = () => {
    const message = document.createElement('main');
    message.style.cssText = 'max-width:36rem;margin:4rem auto;padding:0 16px;font:16px/1.5 system-ui,sans-serif';
    const heading = document.createElement('h1');
    heading.style.fontSize = '1.5rem';
    heading.textContent = 'Open this page from Beacon';
    const text = document.createElement('p');
    text.textContent =
      'This Lighthouse page wasn’t opened from a Beacon site Lighthouse recognises, so it hasn’t loaded. ' +
      'Open it again from the Lighthouse menu in Beacon.';
    message.append(heading, text);
    document.title = 'Lighthouse';
    document.body.className = '';
    document.body.replaceChildren(message);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
  throw new Error('Lighthouse page not opened from a known Beacon environment');
}
