/*
  Launch the built NITC Export page (dist/pages/nitcexport.html) in the
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

/** The tasks Beacon would return for the NITC screen's filters, newest first. */
export function searchRows(scenario, { entityIds = [], typeIds = [], tagIds = [], start, end }) {
  return scenario.tasks.filter((t) => {
    const at = beaconDate(t.StartDate);
    return (!entityIds.length || entityIds.includes(t.CreatedAt.Id))
      && (!typeIds.length || typeIds.includes(t.NonIncidentType.Id))
      && (!tagIds.length || t.Tags.some((g) => tagIds.includes(g.Id)))
      && at >= start && at <= end;
  });
}

function mockBeacon(scenario, log, opts, stats) {
  const { failSearch = 0, pageDelayMs = 0 } = opts;
  stats.failNext = opts.failSearchTimes || 0; // a check can set it again mid-run
  return async (route, url) => {
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) {
      const unit = scenario.units.find((u) => u.Id === Number(m[1]));
      return unit ? json(route, unit) : json(route, { Message: 'Not found' }, 404);
    }
    if (p === '/Api/v1/NonIncident/Search') {
      if (pageDelayMs) await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
      stats.searches++;
      stats.urls.push(url.search);
      if (failSearch) return json(route, { Message: 'Demo failure' }, failSearch);
      if (stats.failNext > 0) {
        stats.failNext--;
        return json(route, { Message: 'Demo failure' }, 503);
      }
      const ids = (name) => url.searchParams.getAll(`${name}[]`).map(Number);
      const rows = searchRows(scenario, {
        entityIds: ids('EntityIds'),
        typeIds: ids('NonIncidentTypeIds'),
        tagIds: ids('TagIds'),
        start: new Date(url.searchParams.get('StartDate')),
        end: new Date(url.searchParams.get('EndDate')),
      });
      const size = Number(url.searchParams.get('PageSize')) || rows.length || 1;
      const index = Number(url.searchParams.get('PageIndex')) || 1;
      stats.pageSizes.push(size);
      log(`[mock] NonIncident/Search -> ${rows.length} (page ${index})`);
      return json(route, { CurrentPage: index, PageSize: size, TotalItems: rows.length, Results: rows.slice((index - 1) * size, index * size) });
    }
    log(`[mock] unhandled Beacon GET ${p}${url.search.slice(0, 120)}`);
    return json(route, { Message: 'Not found' }, 404);
  };
}

/**
 * @param {object} [opts]  launchPage options (headless, viewport, dark, env, watermark,
 *        verbose, scale, hours, range), plus:
 * @param {Date|string} [opts.now]  start the page's clock (and the scenario) at this instant
 * @param {number[]} [opts.hq]  HQ ids the NITC screen was filtered to; default all four demo units, [] for none
 * @param {Record<string,string>} [opts.filters]  more NITC screen filters (NonIncidentTypeIds, TagIds, IncludeCompleted)
 * @param {number} [opts.failSearch]  answer NonIncident/Search with this HTTP status instead
 * @param {number} [opts.failSearchTimes]  answer the next N searches with a 503 (or set `stats.failNext` later)
 * @param {number} [opts.pageDelayMs]  delay each search page (to watch the ring)
 * @param {Record<string,string>} [opts.storage]  localStorage to start with (the remembered report)
 * @returns {Promise<{browser, context, page, pageErrors, log, scenario, stats}>}  `stats` counts mock requests
 */
export async function launchNitc(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const hq = opts.hq ?? scenario.units.map((u) => u.Id);
  const stats = { searches: 0, pageSizes: [], urls: [], failNext: 0 };
  let log = () => {};
  const beacon = mockBeacon(scenario, (msg) => log(msg), opts, stats);
  const launched = await launchPage({
    hours: 30 * 24, ...opts, page: 'nitcexport.html', beacon, hq, now, shiftClock: Boolean(opts.now), extraParams: opts.filters,
  });
  log = launched.log;
  if (opts.storage) {
    await launched.page.evaluate((s) => { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, opts.storage);
    await launched.page.reload();
    await launched.page.waitForFunction(() => document.body.style.opacity === '1');
  }
  return { ...launched, scenario, stats };
}

/** Wait for the first load to finish (or fail). */
export async function waitForNitc(page) {
  await page.waitForFunction(() => window.nitcExportVM && (!window.nitcExportVM.loading() || window.nitcExportVM.error()));
  await settle(page, 500);
}

/** Click Download CSV (which fetches every task) and return { name, text } of the CSV the page saved. */
export async function downloadCsv(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return { name: download.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') };
}
