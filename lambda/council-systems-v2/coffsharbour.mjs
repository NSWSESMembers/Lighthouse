/**
 * City of Coffs Harbour bridge cameras
 * (https://www.coffsharbour.nsw.gov.au/Resident-services/Emergency-and-disaster-information/Bridge-Cameras).
 *
 * One camera, Edward Sharp Bridge, Nana Glen. The council's page links its
 * DisasterWatch image, a fixed URL that always serves the latest image
 * (about 2 MB); its Last-Modified is when it was taken, read with a HEAD
 * request. Every 30 minutes in normal conditions.
 *
 * Position and which way it looks: worked out by us from its image.
 */

import { cameraDataset } from './cameras.mjs';

const EDWARD_SHARP_IMAGE = 'https://public.disasterwatch-iotp.com.au/prospectpublicimages/1529/Edward%20Sharpe%20Bridge.jpeg';

/** A DisasterWatch image's Last-Modified -> ISO, or null. */
export function lastModifiedTime(value) {
  const t = Date.parse(value || '');
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const CAMERAS = [
  {
    id: 'edwardsharp',
    name: 'Edward Sharp Bridge, Grafton Street, Nana Glen',
    lat: -30.1337171,
    lng: 153.0063473,
    bearing: 51,
    latest: async ({ fetchHead }) => {
      const res = await fetchHead(EDWARD_SHARP_IMAGE);
      return { imageUrl: EDWARD_SHARP_IMAGE, takenAt: lastModifiedTime(res.headers.get('last-modified')) };
    },
  },
];

export const coffsharbour = {
  name: 'City of Coffs Harbour',
  system: 'Bridge cameras',
  datasets: {
    'flood-cameras': cameraDataset('coffsharbour', CAMERAS),
  },
};
