/*
  Launch the built Team Summary page (dist/pages/teamsummary.html) in the
  locally installed Google Chrome against a mock Beacon serving the fake
  scenario (scenario.mjs). The extension stand-ins are in
  scripts/page-docs/launchPage.mjs.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import { launchPage, json, settle, BEACON_HOST } from '../page-docs/launchPage.mjs';
import { buildScenario, searchTeams } from './scenario.mjs';

export { settle, BEACON_HOST };

function mockBeacon(scenario, log, requests, { failSearch, failSearchTimes = 0, searchDelayMs, failHistory }) {
  let failsLeft = failSearchTimes;
  return async (route, url) => {
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    requests.push(`${p}${url.search}`);
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) {
      const unit = scenario.units.find((u) => u.Id === Number(m[1]));
      return unit ? json(route, unit) : json(route, { Message: 'Not found' }, 404);
    }
    if (p === '/Api/v1/Teams/Search') {
      if (searchDelayMs) await new Promise((resolve) => setTimeout(resolve, searchDelayMs));
      if (failSearch) return json(route, { Message: 'Demo failure' }, failSearch);
      if (failsLeft > 0) {
        failsLeft--;
        return json(route, { Message: 'Demo failure' }, 503);
      }
      const hqs = url.searchParams.getAll('AssignedToId').map(Number);
      const statusIds = url.searchParams.getAll('StatusTypeId').map(Number);
      const teams = searchTeams(scenario, { hqs, statusIds });
      const page = Number(url.searchParams.get('PageIndex') || 1);
      const size = Number(url.searchParams.get('PageSize') || 50);
      log(`[mock] Teams/Search hq=${hqs.join(',') || 'all'} status=${statusIds.join(',')} ${url.searchParams.get('StatusStartDate')}..${url.searchParams.get('StatusEndDate')} -> ${teams.length}`);
      return json(route, { CurrentPage: page, PageSize: size, TotalItems: teams.length, Results: teams.slice((page - 1) * size, page * size) });
    }
    if ((m = p.match(/^\/Api\/v1\/Teams\/(\d+)\/History$/))) {
      if (failHistory) return json(route, { Message: 'Demo failure' }, failHistory);
      const rows = scenario.history.get(Number(m[1])) || [];
      const size = Number(url.searchParams.get('PageSize') || 20);
      return json(route, { CurrentPage: 1, PageSize: size, TotalItems: rows.length, Results: rows.slice(0, size) });
    }
    if ((m = p.match(/^\/Api\/v1\/Jobs\/(\d+)$/))) {
      const job = scenario.jobs.get(m[1]);
      return job ? json(route, job) : json(route, { Message: 'Not found' }, 404);
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
 * @param {'today'|undefined} [opts.launch]  'today': open with today's range, as Beacon's menu does
 * @param {number} [opts.failSearch]  answer Teams/Search with this HTTP status instead
 * @param {number} [opts.failSearchTimes]  answer the first N Teams/Search requests with a 503, then normally
 * @param {number} [opts.searchDelayMs]  delay each Teams/Search answer (to watch the ring)
 * @param {number} [opts.failHistory]  answer Teams/{id}/History with this HTTP status
 * @param {Record<string,string>} [opts.storage]  localStorage to start with (the Settings choices)
 */
export async function launchTeamSummary(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const hq = opts.hq ?? scenario.units.map((u) => u.Id);
  let range = opts.range;
  if (opts.launch === 'today') {
    // Beacon's menu: midnight to 23:59 today. The page is pinned to Sydney, Node may not be.
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now);
    const offset = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', timeZoneName: 'longOffset' })
      .formatToParts(now).find((x) => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
    range = { start: new Date(`${day}T00:00:00${offset}`), end: new Date(`${day}T23:59:00${offset}`) };
  }
  let log = () => {};
  const requests = [];
  const beacon = mockBeacon(scenario, (msg) => log(msg), requests, opts);
  const launched = await launchPage({
    ...opts, page: 'teamsummary.html', beacon, hq, now, range, shiftClock: Boolean(opts.now),
  });
  log = launched.log;
  if (opts.storage) {
    await launched.page.evaluate((s) => { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, opts.storage);
    await launched.page.reload();
    await launched.page.waitForFunction(() => document.body.style.opacity === '1');
  }
  return { ...launched, scenario, requests };
}

/**
 * Wait for the first load to finish (or fail), and the shown teams' history.
 * The Team Filter opens by itself after the first load, as on the old page;
 * this closes it unless `keepDialog`.
 */
export async function waitForTeams(page, { keepDialog = false } = {}) {
  await page.waitForFunction(() => window.teamSummaryVM && (window.teamSummaryVM.error()
    || (!window.teamSummaryVM.loading() && !window.teamSummaryVM.historyLoading())));
  await settle(page, 600);
  if (!keepDialog && await page.locator('#teams-modal.show').count()) {
    await page.locator('#teams-modal .modal-footer button').click();
    await page.locator('#teams-modal').waitFor({ state: 'hidden' });
    await settle(page, 200);
  }
}
