/*
  Launch the built Incident Export page (dist/pages/advexport.html) in the
  locally installed Google Chrome against a mock Beacon serving the fake
  scenario (scenario.mjs). The extension stand-ins are in
  scripts/page-docs/launchPage.mjs.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import { launchPage, json, settle, BEACON_HOST } from '../page-docs/launchPage.mjs';
import { buildScenario } from './scenario.mjs';

export { settle, BEACON_HOST };

/** Beacon timestamps are offset-free Sydney local time; launchPage.mjs pins Node and the browser to Sydney. */
const beaconDate = (s) => new Date(s);

/** The incidents Beacon would return for some HQs ([] = all) over a range, newest first. */
export function searchRows(scenario, { hqs, start, end }) {
  return scenario.jobs.filter((j) => {
    const received = beaconDate(j.JobReceived);
    return (!hqs.length || hqs.includes(j.EntityAssignedTo.Id)) && received >= start && received <= end;
  });
}

function mockBeacon(scenario, log, opts, stats) {
  const { failSearch = 0, pageDelayMs = 0, failOpsLogFor = [], opsLogDelayMs = 0 } = opts;
  stats.failNext = opts.failSearchTimes || 0; // a check can set it again mid-run
  return async (route, url) => {
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) {
      const unit = scenario.units.find((u) => u.Id === Number(m[1]));
      return unit ? json(route, unit) : json(route, { Message: 'Not found' }, 404);
    }
    if (p === '/Api/v1/Jobs/Search') {
      if (pageDelayMs) await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
      stats.searches++;
      if (failSearch) return json(route, { Message: 'Demo failure' }, failSearch);
      if (stats.failNext > 0) {
        stats.failNext--;
        return json(route, { Message: 'Demo failure' }, 503);
      }
      const rows = searchRows(scenario, {
        hqs: url.searchParams.getAll('Hq').map(Number),
        start: new Date(url.searchParams.get('StartDate')),
        end: new Date(url.searchParams.get('EndDate')),
      });
      const size = Number(url.searchParams.get('PageSize')) || rows.length || 1;
      const index = Number(url.searchParams.get('PageIndex')) || 1;
      stats.pageSizes.push(size);
      log(`[mock] Jobs/Search -> ${rows.length} (page ${index})`);
      return json(route, { CurrentPage: index, PageSize: size, TotalItems: rows.length, Results: rows.slice((index - 1) * size, index * size) });
    }
    if (p.toLowerCase() === '/api/v1/operationslog/search') {
      const id = Number(url.searchParams.get('JobIds[]'));
      stats.opsLogs++;
      stats.opsLogRunning++;
      stats.opsLogMostAtOnce = Math.max(stats.opsLogMostAtOnce, stats.opsLogRunning);
      try {
        if (opsLogDelayMs) await new Promise((resolve) => setTimeout(resolve, opsLogDelayMs));
        if (failOpsLogFor.includes(id)) return json(route, { Message: 'Demo failure' }, 503);
        const log = scenario.opsLogs.get(id);
        const entries = log ? log.entries : [];
        return json(route, { CurrentPage: 1, PageSize: 1000, TotalItems: entries.length, Results: entries });
      } finally {
        stats.opsLogRunning--;
      }
    }
    log(`[mock] unhandled Beacon GET ${p}${url.search.slice(0, 120)}`);
    return json(route, { Message: 'Not found' }, 404);
  };
}

/**
 * @param {object} [opts]  launchPage options (headless, viewport, dark, env, watermark,
 *        verbose, scale, hours, range), plus:
 * @param {Date|string} [opts.now]  start the page's clock (and the scenario) at this instant
 * @param {number[]} [opts.hq]  HQ ids to open with; default all four demo units, [] for "all of NSW"
 * @param {number} [opts.failSearch]  answer Jobs/Search with this HTTP status instead
 * @param {number} [opts.failSearchTimes]  answer the next N Jobs/Search requests with a 503 (or set `stats.failNext` later)
 * @param {number} [opts.pageDelayMs]  delay each Jobs/Search page (to watch the ring)
 * @param {number[]} [opts.failOpsLogFor]  incident ids whose Ops Log answers 503
 * @param {number} [opts.opsLogDelayMs]  delay each Ops Log answer (to watch the ICEMS count)
 * @param {Record<string,string>} [opts.storage]  localStorage to start with (saved columns)
 * @returns {Promise<{browser, context, page, pageErrors, log, scenario, stats}>}  `stats` counts mock requests
 */
export async function launchExport(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const hq = opts.hq ?? scenario.units.map((u) => u.Id);
  const stats = { searches: 0, pageSizes: [], opsLogs: 0, opsLogRunning: 0, opsLogMostAtOnce: 0, failNext: 0 };
  let log = () => {};
  const beacon = mockBeacon(scenario, (msg) => log(msg), opts, stats);
  const launched = await launchPage({ ...opts, page: 'advexport.html', beacon, hq, now, shiftClock: Boolean(opts.now) });
  log = launched.log;
  if (opts.storage) {
    await launched.page.evaluate((s) => { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, opts.storage);
    await launched.page.reload();
    await launched.page.waitForFunction(() => document.body.style.opacity === '1');
  }
  return { ...launched, scenario, stats };
}

/** Wait for the first load to finish (or fail). */
export async function waitForExport(page) {
  await page.waitForFunction(() => window.exportVM && (!window.exportVM.loading() || window.exportVM.error()));
  await settle(page, 500);
}

/** Click Download CSV (which fetches every incident) and return { name, text } of the CSV the page saved. */
export async function downloadCsv(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return { name: download.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') };
}
