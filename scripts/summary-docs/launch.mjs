/*
  Launch the built Incident Summary page (dist/pages/summary.html) in the
  locally installed Google Chrome against a mock Beacon serving the fake
  scenario (scenario.mjs). The extension stand-ins are in
  scripts/page-docs/launchPage.mjs.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import { launchPage, json, settle, BEACON_HOST } from '../page-docs/launchPage.mjs';
import { buildScenario, summaryRows } from './scenario.mjs';

export { settle, BEACON_HOST };

function mockBeacon(scenario, log, { failSummary, failSummaryTimes = 0, summaryDelayMs }) {
  let failsLeft = failSummaryTimes;
  return async (route, url) => {
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) {
      const unit = scenario.units.find((u) => u.Id === Number(m[1]));
      return unit ? json(route, unit) : json(route, { Message: 'Not found' }, 404);
    }
    if (p === '/Api/v1/Reports/JobsSummary') {
      if (summaryDelayMs) await new Promise((resolve) => setTimeout(resolve, summaryDelayMs));
      if (failSummary) return json(route, { Message: 'Demo failure' }, failSummary);
      if (failsLeft > 0) {
        failsLeft--;
        return json(route, { Message: 'Demo failure' }, 503);
      }
      const hqs = url.searchParams.getAll('EntityIds').map(Number);
      const start = new Date(url.searchParams.get('StartDate'));
      const end = new Date(url.searchParams.get('EndDate'));
      log(`[mock] JobsSummary hq=${hqs.join(',') || 'all'} ${start.toISOString()}..${end.toISOString()}`);
      return json(route, { result: summaryRows(scenario, { hqs, start, end }) });
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
 * @param {number} [opts.failSummary]  answer JobsSummary with this HTTP status instead
 * @param {number} [opts.failSummaryTimes]  answer the first N JobsSummary requests with a 503, then normally
 * @param {number} [opts.summaryDelayMs]  delay each JobsSummary answer (to watch the ring)
 * @param {Record<string,string>} [opts.storage]  localStorage to start with (the Settings choices)
 */
export async function launchSummary(opts = {}) {
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
  const beacon = mockBeacon(scenario, (msg) => log(msg), opts);
  const launched = await launchPage({
    ...opts, page: 'summary.html', beacon, hq, now, range, shiftClock: Boolean(opts.now),
  });
  log = launched.log;
  if (opts.storage) {
    await launched.page.evaluate((s) => { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, opts.storage);
    await launched.page.reload();
    await launched.page.waitForFunction(() => document.body.style.opacity === '1');
  }
  return { ...launched, scenario };
}

/** Wait for the first load to finish (or fail). */
export async function waitForSummary(page) {
  await page.waitForFunction(() => window.summaryVM && (!window.summaryVM.loading() || window.summaryVM.error()));
  await settle(page, 600);
}
