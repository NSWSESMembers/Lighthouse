/**
 * Client side of the power outages Lambda (lambda/power-outages-v2), shared
 * by the tasking map (src/pages/tasking/mapLayers/powerOutages.js) and the
 * Lighthouse map on Beacon (src/background.js fetches it, InjectScriptMapManager
 * draws it).
 *
 * The Lambda returns one GeoJSON FeatureCollection for Ausgrid, Endeavour
 * Energy and Essential Energy, each feature with these properties:
 *   provider ('ausgrid' | 'endeavour' | 'essential'), id,
 *   type ('unplanned' | 'planned'), status, customers, cause, suburbs,
 *   streets, start, estRestore, updated (ISO strings or null), lat, lng
 * plus meta.providers[provider] = { name, ok, fetchedAt, lastGoodAt, count, error? }.
 */

export const POWER_OUTAGES_URL = 'https://lambda.lighthouse-extension.com/lad_v2/power-outages';

export const POWER_PROVIDERS = {
  ausgrid: { name: 'Ausgrid', phone: '13 13 88', colour: '#ff7800' },
  endeavour: { name: 'Endeavour Energy', phone: '131 003', colour: '#26229c' },
  essential: { name: 'Essential Energy', phone: '13 20 80', colour: '#3f8f48' },
};

/**
 * GET the combined outages. Throws on a non-2xx response or a body that
 * isn't a FeatureCollection.
 * @param {string} token Beacon access token
 */
export async function fetchPowerOutages(token, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(POWER_OUTAGES_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`Power outages: HTTP ${res.status}`);
  const body = await res.json();
  if (!body || !Array.isArray(body.features)) throw new Error('Power outages: unexpected response');
  return body;
}

/** "09/11 14:30"-style local time, or '' */
export function formatOutageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Title for a popup, e.g. "Ausgrid unplanned outage". */
export function outageTitle(props) {
  const name = POWER_PROVIDERS[props?.provider]?.name || 'Power';
  return `${name} ${props?.type === 'planned' ? 'planned outage' : 'unplanned outage'}`;
}

/**
 * Popup rows as [label, text] pairs (plain text, to be escaped by the
 * caller). Empty values are left out.
 * @param {object} props feature properties
 * @param {object} [meta] response meta, to flag a company whose feed is stale
 * @param {number} [now] current time in ms
 */
export function outageRows(props, meta, now = Date.now()) {
  const p = props || {};
  const estRestore = formatOutageTime(p.estRestore);
  const overdue = estRestore && Date.parse(p.estRestore) < now;
  const rows = [
    ['Customers affected', p.customers != null ? String(p.customers) : ''],
    ['Status', p.status],
    ['Cause', p.cause],
    ['Suburbs', p.suburbs],
    ['Streets', p.streets],
    [p.type === 'planned' ? 'Starts' : 'Started', formatOutageTime(p.start)],
    ['Est. restore', overdue ? `${estRestore} (overdue)` : estRestore],
    ['Updated', formatOutageTime(p.updated)],
    ['Reference', p.id],
  ];
  const feed = meta?.providers?.[p.provider];
  if (feed && feed.ok === false) {
    const asOf = formatOutageTime(feed.lastGoodAt);
    rows.push(['Feed', asOf ? `Not updating, last loaded ${asOf}` : 'Not updating']);
  }
  const phone = POWER_PROVIDERS[p.provider]?.phone;
  if (phone) rows.push(['Contact', `${POWER_PROVIDERS[p.provider].name} ${phone}`]);
  return rows.filter(([, v]) => v != null && String(v).trim() !== '');
}
