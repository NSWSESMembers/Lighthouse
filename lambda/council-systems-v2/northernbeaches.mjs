/**
 * Northern Beaches Council FLASH (Flood Information System), built by Royal
 * HaskoningDHV on the Lizard platform, the same platform as FloodSmart. Its
 * gauge readings come from Manly Hydraulics Laboratory (MHL) and the Bureau
 * of Meteorology. Only the public data: no Lizard account is used.
 *
 *   catchment-rainfall  rainfall totals per catchment, measured and forecast
 *                       (GeoServer WFS, the FLASH dashboard's rainfall map)
 *
 * The council's gauges and warning areas need a Lizard login. (The
 * timeseries northernbeaches.lizard.net lists publicly are Lizard's own demo
 * data, not the council's.)
 */

import { catchmentRainfallDataset } from './floodsmart.mjs';

export const northernbeaches = {
  name: 'Northern Beaches Council',
  system: 'FLASH',
  datasets: {
    'catchment-rainfall': catchmentRainfallDataset('floodsmart:northernbeaches_catchments_2701_since9am', [
      'since9am', 'last1hr', 'last3hr', 'last6hr', 'last12hr', 'last24hr', 'last72hr', 'last168hr', 'max6hr',
      'next1hr', 'next2hr', 'next3hr', 'next6hr', 'next12hr', 'next24hr', 'next72hr', 'next168hr',
    ]),
  },
};
