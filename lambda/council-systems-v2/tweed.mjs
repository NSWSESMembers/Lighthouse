/**
 * Tweed Shire Council flood monitoring cameras
 * (https://www.tweed.nsw.gov.au/property-rates/floods-stormwater/flood-monitoring-cameras).
 *
 *   flood-cameras         the cameras: name, position and river gauge. The
 *                         list below, so it never calls Tweed's site.
 *   flood-cameras/{id}    one camera's latest image and when it was taken,
 *                         read from that camera's page when someone opens it.
 *
 * There's no API. The council's page embeds one page per camera from
 * floodcam.tweed.nsw.gov.au (ASP.NET on Azure), and each of those has the
 * latest image in its HTML as
 *   <img id="LatestImageViewer1_imgLatest" src="/ImageProxy.ashx?container={id}&amp;blob={file}">
 * where {file} is e.g. WooyungRoad_AK1536687_20261124173038387_TIMING.jpg:
 * the time it was taken, Sydney time, to the millisecond. Images are taken
 * every 15 minutes; CameraImages.aspx?folder={id}&viewmode=timelapse shows
 * the last 4 hours.
 *
 * Positions are from the council page's Google Maps link for each camera
 * (Mount Warning Road's corrected by us); which way each looks, worked out
 * by us from its image.
 */

import { cameraDataset } from './cameras.mjs';

const SITE = 'https://floodcam.tweed.nsw.gov.au';
const BOM_GAUGE = (id) => `https://www.bom.gov.au/fwo/IDN60231/IDN60231.${id}.plt.shtml`;

// [id (the camera's folder), name, lat, lng, river gauge page or null,
//  bearing: which way it looks, degrees from north]
// Terranora Road and Oaks Avenue link the same gauge on the council's page.
const CAMERAS = [
  ['bilambil', 'Bilambil Sports Club', -28.227057, 153.465852, null, 264],
  ['boatharbour', 'Boatharbour Bridge', -28.322146, 153.347479, BOM_GAUGE('058204'), 298],
  ['byangumbridge', 'Byangum Bridge', -28.354229, 153.36102, BOM_GAUGE('558065'), 200],
  ['clothierscreekroad', 'Clothiers Creek Road', -28.3317267, 153.5220043, null, 121],
  ['crabbescreekroad', 'Crabbes Creek Road', -28.4554974, 153.4925399, BOM_GAUGE('558105'), 270],
  ['fingalroad', 'Fingal Road', -28.2095091, 153.5641113, BOM_GAUGE('558010'), 190],
  ['mtwarningroadbridge', 'Mount Warning Road', -28.3841112, 153.3367992, BOM_GAUGE('058167'), 345],
  ['mbahbridge', 'Murwillumbah Bridge', -28.327447, 153.39989, BOM_GAUGE('058186'), 170],
  ['piggabeenroad', 'Piggabeen Road', -28.188171, 153.490797, 'https://www.mhl.nsw.gov.au/Station-201448', 285],
  ['pottsvilleroad', 'Pottsville Road', -28.4357842, 153.4942454, BOM_GAUGE('558103'), 68],
  ['terranoraroad', 'Terranora Road', -28.2676281, 153.4706112, BOM_GAUGE('558014'), 85],
  ['oaksave', 'Tweed Valley Way (Oaks Avenue)', -28.269023, 153.510166, BOM_GAUGE('558014'), 11],
  ['wooyungroad', 'Wooyung Road', -28.453879, 153.530784, BOM_GAUGE('558095'), 87],
].map(([id, name, lat, lng, gaugeUrl, bearing]) => ({
  id, name, lat, lng, gaugeUrl, bearing,
  timelapseUrl: `${SITE}/CameraImages.aspx?folder=${id}&viewmode=timelapse`,
  latest: async ({ fetchText }) => latestImage(await fetchText(`${SITE}/flood-cameras/${id}`), id),
}));

const sydneyParts = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

/** Sydney's offset from UTC in ms at instant `ms`. */
function sydneyOffset(ms) {
  const p = Object.fromEntries(sydneyParts.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/**
 * "WooyungRoad_AK1536687_20261124173038387_TIMING.jpg" -> its time as ISO
 * UTC ("2026-11-24T06:30:38.387Z"), or null.
 */
export function imageTime(file) {
  const m = String(file || '').match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})_/);
  if (!m) return null;
  const [y, mo, d, h, mi, s, ms] = m.slice(1).map(Number);
  const local = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  // The offset at the local time read as UTC is within a few hours of the
  // right instant; checking it again there handles the DST changeover.
  let utc = local - sydneyOffset(local);
  utc = local - sydneyOffset(utc);
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/** A camera page's latest image: { imageUrl, takenAt }. Throws if it isn't there. */
export function latestImage(html, id) {
  const tag = String(html || '').match(/<img\b[^>]*\bid="LatestImageViewer1_imgLatest"[^>]*>/i)?.[0] || '';
  const src = tag.match(/\bsrc="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&');
  const url = src ? new URL(src, SITE) : null;
  if (!url || url.origin !== SITE || url.pathname !== '/ImageProxy.ashx' || url.searchParams.get('container') !== id) {
    throw new Error('No latest image on the camera page');
  }
  return { imageUrl: url.href, takenAt: imageTime(url.searchParams.get('blob')) };
}

export const tweed = {
  name: 'Tweed Shire Council',
  system: 'Flood monitoring cameras',
  datasets: {
    // Images are 15 minutes apart.
    'flood-cameras': cameraDataset('tweed', CAMERAS),
  },
};
