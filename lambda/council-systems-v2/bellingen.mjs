/**
 * Bellingen Shire Council bridge flood cameras
 * (https://www.bellingen.nsw.gov.au/Services/Bridge-Flood-Camera-Network).
 *
 * The council's page shows each camera's webcam.io image,
 * https://webcam.io/webcams/{id}/latest.jpg, which redirects to the image
 * itself, e.g. https://assets11.webcam.io/w11/{id}/20261124/074157-5781b1.jpg:
 * the time taken, UTC. A HEAD request reads the redirect, so the image isn't
 * downloaded. Every 30 minutes in normal conditions.
 *
 * Positions and which way each camera looks: worked out by us from its
 * image, as the council doesn't publish them, except Wild Cattle Creek's
 * position, which we were given.
 */

import { cameraDataset } from './cameras.mjs';

const WEBCAM_IO = 'https://webcam.io';

/** A webcam.io latest.jpg redirect -> { imageUrl, takenAt }. Throws if it isn't one. */
export function webcamIoImage(location, id) {
  const url = location ? new URL(location, WEBCAM_IO) : null;
  const m = url?.pathname.match(new RegExp(`^/w\\d+/${id}/(\\d{4})(\\d{2})(\\d{2})/(\\d{2})(\\d{2})(\\d{2})-[0-9a-f]+\\.jpg$`));
  if (!m || url.protocol !== 'https:' || !/(^|\.)webcam\.io$/.test(url.hostname)) {
    throw new Error('No latest image from webcam.io');
  }
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  return { imageUrl: url.href, takenAt: new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString() };
}

// id is ours (routes are lower case); webcam is webcam.io's id. `more` is
// { approximate } or the camera's view, { bearing, fov } (cameras.mjs).
const camera = (id, webcam, name, lat, lng, more = {}) => ({
  id, name, lat, lng, ...more,
  timelapseUrl: `${WEBCAM_IO}/webcams/${webcam}`,
  latest: async ({ fetchHead }) => {
    const res = await fetchHead(`${WEBCAM_IO}/webcams/${webcam}/latest.jpg`);
    return webcamIoImage(res.headers.get('location'), webcam);
  },
});

const CAMERAS = [
  camera('lavenders', 'z71j19', 'Lavenders Bridge, Bridge Street, Bellingen', -30.4510212, 152.8977963, { bearing: 50 }),
  camera('leans', '90K1qM', "Lean's Bridge, Darkwood Road, Thora", -30.4291261, 152.7707969, { bearing: 325 }),
  camera('moodys', 'P6VeDP', 'Moodys Bridge, Kalang Road, Kalang', -30.4683333, 152.8694167, { bearing: 140 }),
  camera('spicketts', 'Mmlkkz', 'Spicketts Bridge, Bowraville Road, Brierfield', -30.504925, 152.893853, { bearing: 182 }),
  camera('slarkes', 'zJlV69', 'Slarkes Bridge, North Bank Road', -30.455999, 152.930090, { bearing: 268 }),
  camera('wildcattle', 'P6VQ1P', 'Wild Cattle Creek', -30.2819167, 152.7746111, { bearing: 225 }),
];

export const bellingen = {
  name: 'Bellingen Shire Council',
  system: 'Bridge flood cameras',
  datasets: {
    'flood-cameras': cameraDataset('bellingen', CAMERAS),
  },
};
