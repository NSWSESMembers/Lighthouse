/**
 * Catchment rainfall from a council's FloodSmart dashboard (the Lizard
 * platform). Each FloodSmart council has a catchments table on Lizard's
 * GeoServer with one rainfall total per column; every rainfall layer on the
 * dashboard is drawn from the same table, so one WFS request returns them all.
 * The councils' tables don't all have the same columns, so each council lists
 * the totals its table has (asking for a missing column fails the request).
 */

import { simplifyGeometry } from './geometry.mjs';

const CATCHMENTS_WFS = 'https://geoserver9.lizard.net/geoserver/floodsmart/ows';

// Our name for each total -> its column in a FloodSmart catchments table (mm).
export const RAINFALL_FIELDS = {
  since9am: 'since9am',
  last1hr: 'ner_l_1hr',
  last3hr: 'ner_l_3hr',
  last6hr: 'ner_l_6hr',
  last12hr: 'ner_l_12hr',
  last24hr: 'ner_l_24hr',
  last48hr: 'ner_l_48hr',
  last72hr: 'ner_l_72hr',
  last168hr: 'ner_l_168hr',
  max6hr: 'max6hrs',
  next1hr: 'ner_f_1hr',
  next2hr: 'ner_f_2hr',
  next3hr: 'ner_f_3hr',
  next6hr: 'ner_f_6hr',
  next12hr: 'ner_f_12hr',
  next24hr: 'ner_f_24hr',
  next48hr: 'ner_f_48hr',
  next72hr: 'ner_f_72hr',
  next168hr: 'ner_f_168hr',
};

/**
 * WFS catchments -> simplified polygons with { name, anchor, totals } where
 * totals has each of `totals` (our names) in mm, or null.
 */
export function catchmentRainfallFeatures(fc, totals) {
  return (fc?.features || [])
    .map((f) => {
      const p = f?.properties || {};
      const out = {};
      for (const key of totals) {
        const v = p[RAINFALL_FIELDS[key]];
        out[key] = v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }
      const a = p.anchorpointgeom?.coordinates;
      return {
        type: 'Feature',
        geometry: f?.geometry ? simplifyGeometry(f.geometry) : null,
        properties: {
          name: String(p.name || 'Catchment').trim(),
          anchor: Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1]) ? [a[0], a[1]] : null,
          totals: out,
        },
      };
    })
    .filter((f) => f.geometry);
}

/** A council's catchment-rainfall dataset, from its catchments table `layer`. */
export function catchmentRainfallDataset(layer, totals) {
  return {
    ttlSeconds: 120, // the totals are recalculated every 5 minutes
    load: async (fetchJson) => {
      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layer,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        propertyName: ['name', 'geom', 'anchorpointgeom', ...totals.map((k) => RAINFALL_FIELDS[k])].join(','),
      });
      return catchmentRainfallFeatures(await fetchJson(`${CATCHMENTS_WFS}?${params}`), totals);
    },
  };
}
