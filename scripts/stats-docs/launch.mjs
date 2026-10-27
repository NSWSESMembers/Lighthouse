/*
  Launch the built Incident Statistics page (dist/pages/stats.html) in the
  locally installed Google Chrome against a mock Beacon serving the fake
  scenario (scenario.mjs). The extension stand-ins are in
  scripts/page-docs/launchPage.mjs; resources/unitClusters.json is swapped
  for the scenario's fake clusters.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import { launchPage, json, settle, BEACON_HOST } from '../page-docs/launchPage.mjs';
import { buildScenario } from './scenario.mjs';

export { settle, BEACON_HOST };

/** Beacon timestamps are offset-free Sydney local time; the browser is pinned to Sydney too. */
const beaconDate = (s) => new Date(s);

function mockBeacon(scenario, log) {
  return (route, url) => {
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) {
      const unit = scenario.units.find((u) => u.Id === Number(m[1]));
      return unit ? json(route, unit) : json(route, { Message: 'Not found' }, 404);
    }
    if (p === '/Api/v1/Jobs/Search') {
      // Honour the HQ and date filters, and Beacon's paging envelope.
      const hqs = url.searchParams.getAll('Hq').map(Number);
      const start = new Date(url.searchParams.get('StartDate'));
      const end = new Date(url.searchParams.get('EndDate'));
      const rows = scenario.jobs.filter((j) => {
        const received = beaconDate(j.JobReceived);
        return (!hqs.length || hqs.includes(j.EntityAssignedTo.Id)) && received >= start && received <= end;
      });
      const size = Number(url.searchParams.get('PageSize')) || rows.length || 1;
      const index = Number(url.searchParams.get('PageIndex')) || 1;
      log(`[mock] Jobs/Search hq=${hqs.join(',') || 'all'} -> ${rows.length} (page ${index})`);
      return json(route, { CurrentPage: index, PageSize: size, TotalItems: rows.length, Results: rows.slice((index - 1) * size, index * size) });
    }
    log(`[mock] unhandled Beacon GET ${p}${url.search.slice(0, 120)}`);
    return json(route, { CurrentPage: 1, PageSize: 0, TotalItems: 0, Results: [] });
  };
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.headless=true]
 * @param {{width:number,height:number}} [opts.viewport]
 * @param {Date|string} [opts.now]  start the page's clock (and the scenario) at this instant
 * @param {number[]} [opts.hq]  HQ ids to open with; default all four demo units, [] for "all of NSW"
 * @param {number} [opts.hours=72]  launch range: the last N hours to `now`
 * @param {boolean} [opts.dark]  emulate a dark OS colour scheme
 * @param {'production'|'trainbeacon'|'devbeacon'} [opts.env='production']  which Beacon the page
 *        thinks it was opened from (the `source` param; requests still go to the mock)
 * @param {boolean} [opts.watermark=false]  keep the Development build's watermark (dev builds only)
 * @param {number} [opts.pageDelayMs=0]  delay each Jobs/Search page by this much (to watch the loader)
 * @param {number} [opts.firstPageDelayMs]  delay the first page by this much instead (default pageDelayMs)
 * @param {number} [opts.failSearch]  answer Jobs/Search with this HTTP status instead
 * @param {boolean} [opts.verbose]  log mock traffic and page errors
 * @param {number} [opts.scale=1]  device pixel ratio
 */
export async function launchStats(opts = {}) {
  const { failSearch = 0, pageDelayMs = 0, firstPageDelayMs = pageDelayMs } = opts;
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const hq = opts.hq ?? scenario.units.map((u) => u.Id);
  let log = () => {};
  const mock = mockBeacon(scenario, (msg) => log(msg));
  const beacon = async (route, url) => {
    if (url.pathname.startsWith('/Api/v1/Jobs/Search')) {
      const first = (Number(url.searchParams.get('PageIndex')) || 1) === 1;
      const delay = first ? firstPageDelayMs : pageDelayMs;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failSearch) return json(route, { Message: 'Demo failure' }, failSearch);
    }
    return mock(route, url);
  };
  const launched = await launchPage({
    ...opts, page: 'stats.html', beacon, hq, now, shiftClock: Boolean(opts.now),
    appJson: { '/resources/unitClusters.json': scenario.clusters },
  });
  log = launched.log;
  return { ...launched, scenario };
}

/** Wait for the first load to finish (or fail) and the word cloud to lay out. */
export async function waitForStats(page, { cloud = true } = {}) {
  await page.waitForFunction(() => window.statsVM && (!window.statsVM.loading() || window.statsVM.error()));
  if (cloud) await page.locator('#word-cloud svg, #word-cloud p').first().waitFor({ timeout: 10000 }).catch(() => {});
  await settle(page);
}
