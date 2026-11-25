/**
 * Every council system the Lambda serves, as /lad_v2/council/{council}/{dataset}.
 *
 * A council is { name, system, datasets }, and a dataset is
 * { ttlSeconds, load(fetchJson, now) -> GeoJSON features }. To add a council,
 * write its module next to parramatta.mjs and add it here: the route, cache
 * and response shape come with it. A FloodSmart council's catchment rainfall
 * is one line (floodsmart.mjs, see northernbeaches.mjs).
 */

import { parramatta } from './parramatta.mjs';
import { northernbeaches } from './northernbeaches.mjs';

export const COUNCILS = {
  parramatta,
  northernbeaches,
};
