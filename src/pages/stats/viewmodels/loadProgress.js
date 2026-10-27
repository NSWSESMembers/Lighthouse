/*
  What the first-load ring shows (stats.html, #stats-loading): the shared
  incident-search ring (src/pages/shared/incidentLoad.js), finishing with
  "Building charts…".
*/

import { describeLoad as describeIncidentLoad } from '../../shared/incidentLoad.js';

export { SLOW_AFTER_MS, RING_CIRCUMFERENCE, centreValueSize, PAGE_SIZE, etaText, estimateMsLeft } from '../../shared/incidentLoad.js';

/** @param {object} s  as describeIncidentLoad, with phase 'starting' | 'incidents' | 'charts' */
export function describeLoad(s) {
  return describeIncidentLoad({
    ...s,
    phase: s.phase === 'charts' ? 'finishing' : s.phase,
    finishingTitle: 'Building charts…',
  });
}
