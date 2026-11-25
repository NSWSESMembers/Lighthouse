/**
 * Clarence Valley Council flood monitoring cameras
 * (https://www.clarence.nsw.gov.au/Emergencies-Disasters/Flood-monitoring-stations).
 *
 *   flood-cameras         the cameras: name, position and river gauge. The
 *                         list below, so it never calls anyone's site.
 *   flood-cameras/{id}    one camera's latest image, when someone opens it.
 *
 * The council's page has cameras from three systems:
 *
 * - Prince Street, Grafton: a Manly Hydraulics Laboratory (MHL) camera at its
 *   Grafton gauge, which the council's page embeds as MHL's animation page
 *   (index.php?page=animation&stn=<hex "grafton">&uid=<hex "clarence.nsw.gov.au">).
 *   That page lists the latest images as
 *   /s3/www/media/webcams/grafton/20261124_17114068_grafton.jpg: the time
 *   taken in AEST all year (MHL's note: an hour behind during daylight
 *   saving). Hourly, more often in a flood.
 * - Bluff Bridge, Orara Way: an Envault camera, embedded as one fixed URL
 *   that always serves the latest image, so nothing is fetched to find it.
 *   The time is stamped on the image. Hourly in daylight, more often in a
 *   flood.
 *
 * - "Other Locations": seven cameras published only as one live video (Ant
 *   Media Server, plain http on an IP address), a 3x3 grid of them at
 *   1920x1080 with the date and time in the last two squares. Each camera's
 *   still is cut from the newest frame (videostill.mjs) when someone opens
 *   it. The boxes below are measured from the grid; if the council changes
 *   its layout they'll need measuring again. A camera that's off is black
 *   with its name in the grid, and is served as offline.
 *
 * The page's water-level charts (Bluff Bridge, Esk River) aren't used: their
 * levels have no stated datum.
 *
 * Positions and which way each camera looks were checked against its image
 * on the map by hand. Palmer's Island's camera is off, so its position is
 * still a guess from the place name (approximate) and it has no bearing.
 */

import { cameraDataset } from './cameras.mjs';
import { liveStill } from './videostill.mjs';

const MHL = 'https://www.mhl.nsw.gov.au';
const hex = (s) => Buffer.from(s).toString('hex').toUpperCase();
// The animation page wants the embedding site; this is the council's own embed.
const mhlAnimationUrl = (stn, n) =>
  `${MHL}/index.php?page=animation&n=${n}&iframes=1&stn=${hex(stn)}&uid=${hex('clarence.nsw.gov.au')}`;

const CAMERAS = [
  {
    id: 'princestreet',
    name: 'Prince Street, Grafton (Clarence River)',
    lat: -29.6933466,
    lng: 152.9318394,
    bearing: 219.63,
    gaugeUrl: 'https://mhlfit.net/Station-204400',
    timelapseUrl: mhlAnimationUrl('grafton', 12),
    latest: async ({ fetchText }) => latestMhlImage(await fetchText(mhlAnimationUrl('grafton', 1)), 'grafton'),
  },
  {
    id: 'bluffbridge',
    name: 'Bluff Bridge, Orara Way (Orara River)',
    lat: -29.9363956,
    lng: 152.9848994,
    bearing: 232.29,
    latest: async () => ({ imageUrl: 'https://www.envault.com.au/api?contentUrl=6a435e358e530', takenAt: null }),
  },
];

const LIVE_SERVER = 'http://180.150.8.170:5080/LiveApp';
const LIVE_NAME = 'chrondowo5j69i601344j0j4sourceidchromeiewindowopenrlz1C1CHBFenGBAU980AU980oqwindowopenaqschrom4iewindowGBAU980AU98069i57j0i512l5j69i65j69i60ie';
const LIVE_VIDEO = `${LIVE_SERVER}/streams/${LIVE_NAME}.m3u8`;
// The council page's "Open cameras" link: the video itself, all seven cameras.
const LIVE_PAGE = `${LIVE_SERVER}/play.html?name=${LIVE_NAME}`;
const COLUMNS = [{ x: 0, w: 613 }, { x: 637, w: 628 }, { x: 1289, w: 631 }];
const ROWS = [{ y: 0, h: 314 }, { y: 397, h: 345 }, { y: 797, h: 283 }];

// [id, name (as in the grid), column, row, lat, lng, bearing, gauge or null].
// No bearing: the position is a guess, so it's approximate.
const GRID_CAMERAS = [
  ['harwood', 'Harwood Bridge', 0, 0, -29.4333167, 153.2394806, 68.51, null],
  ['lilydale', 'Lilydale Bridge', 1, 0, -29.5480375, 152.6730958, 337.01, null],
  ['palmersisland', "Palmer's Island", 2, 0, -29.4321, 153.26563, null, null],
  ['rogans', 'Rogans Bridge', 0, 1, -29.6221056, 152.8823111, 31.83, 'https://mhlfit.net/Station-204414'],
  ['sandycrossing', 'Sandy Crossing', 1, 1, -29.7648639, 153.0949389, 64.49, null],
  ['maclean', 'Maclean Bridge', 2, 1, -29.465875, 153.1956528, 243.66, null],
  ['boothbys', 'Boothbys', 0, 2, -29.6151028, 153.0193139, 41.06, null],
].map(([id, name, col, row, lat, lng, bearing, gaugeUrl]) => ({
  id, name, lat, lng, gaugeUrl,
  ...(bearing === null ? { approximate: true } : { bearing }),
  liveUrl: LIVE_PAGE,
  latest: (fetchers) => liveStill(LIVE_VIDEO, { ...COLUMNS[col], ...ROWS[row] }, fetchers),
}));

/**
 * MHL's animation page -> its newest image: { imageUrl, takenAt }. The file
 * name's time is AEST (UTC+10) all year. Throws if there's no image.
 */
export function latestMhlImage(html, stn) {
  const re = new RegExp(`/s3/www/media/webcams/${stn}/(\\d{4})(\\d{2})(\\d{2})_(\\d{2})(\\d{2})(\\d{2})\\d*_${stn}\\.jpg`, 'g');
  const found = [...String(html || '').matchAll(re)];
  if (!found.length) throw new Error('No image on the MHL camera page');
  const newest = found.reduce((a, b) => (b[0] > a[0] ? b : a));
  const [y, mo, d, h, mi, s] = newest.slice(1).map(Number);
  return {
    imageUrl: `${MHL}${newest[0]}`,
    takenAt: new Date(Date.UTC(y, mo - 1, d, h - 10, mi, s)).toISOString(),
  };
}

export const clarence = {
  name: 'Clarence Valley Council',
  system: 'Flood monitoring cameras',
  datasets: {
    // Images are an hour apart in normal conditions, more often in a flood.
    'flood-cameras': cameraDataset('clarence', [...CAMERAS, ...GRID_CAMERAS]),
  },
};
