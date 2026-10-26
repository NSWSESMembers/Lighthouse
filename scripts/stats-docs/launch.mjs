/*
  Launch the built Incident Statistics page (dist/pages/stats.html) in the
  locally installed Google Chrome, outside the extension, against a mock
  Beacon serving the fake scenario (scenario.mjs).

  What stands in for the extension:
    - window.chrome: storage.local holding a fake bearer token, and
      runtime.getManifest -- the only chrome.* APIs the page touches.
    - the URL params Beacon's Lighthouse menu passes (host/source/hq/start/end).
    - dist/ served from a fake origin via request interception, with
      resources/unitClusters.json swapped for the scenario's fake clusters.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildScenario } from './scenario.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const APP_ORIGIN = 'http://lighthouse.demo.test';
export const BEACON_HOST = 'https://beacon.demo.test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

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
  const {
    headless = true, viewport = { width: 1440, height: 1000 }, hours = 72,
    dark = false, failSearch = 0, verbose = false, scale = 1, watermark = false, env = 'production',
    pageDelayMs = 0, firstPageDelayMs = pageDelayMs,
  } = opts;
  if (!fs.existsSync(path.join(DIST, 'pages/stats.html'))) {
    throw new Error('dist/pages/stats.html not found -- run `npm run dev` first');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  // The page watermarks Development builds; guide screenshots shouldn't carry it.
  if (!watermark) manifest.name = manifest.name.replace(/\s*Development.*$/i, '');
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const hq = opts.hq ?? scenario.units.map((u) => u.Id);
  const log = verbose ? (msg) => console.log(msg) : () => {};
  const pageErrors = [];

  const browser = await chromium.launch({ channel: 'chrome', headless });
  const context = await browser.newContext({
    viewport, deviceScaleFactor: scale, timezoneId: scenario.timezone, locale: 'en-AU',
    colorScheme: dark ? 'dark' : 'light',
  });
  if (opts.now) {
    // Shift Date rather than freeze it, so timers and transitions still run.
    await context.addInitScript((offsetMs) => {
      const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate {
        constructor(...args) { if (args.length === 0) super(RealDate.now() + offsetMs); else super(...args); }
        static now() { return RealDate.now() + offsetMs; }
      };
    }, now.getTime() - Date.now());
  }

  await context.addInitScript(({ tokenKey, manifest }) => {
    const store = { [tokenKey]: JSON.stringify({ token: 'demo-token', expdate: '2099-01-01T00:00:00Z' }) };
    window.chrome = {
      runtime: { id: 'lighthouse-demo', getManifest: () => manifest },
      storage: {
        local: {
          get: (keys, cb) => {
            const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || store);
            const out = {};
            list.forEach((k) => { if (k in store) out[k] = store[k]; });
            setTimeout(() => cb(out), 0);
          },
          set: (obj, cb) => { Object.assign(store, obj); cb && setTimeout(cb, 0); },
        },
      },
    };
  }, { tokenKey: `beaconAPIToken-${BEACON_HOST}`, manifest });

  const beacon = mockBeacon(scenario, log);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      if (url.pathname === '/resources/unitClusters.json') return json(route, scenario.clusters);
      const file = path.join(DIST, decodeURIComponent(url.pathname));
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
      log(`[app] 404 ${url.pathname}`);
      return route.fulfill({ status: 404, body: '' });
    }
    if (url.origin === BEACON_HOST) {
      if (url.pathname.startsWith('/Api/v1/Jobs/Search')) {
        const first = (Number(url.searchParams.get('PageIndex')) || 1) === 1;
        const delay = first ? firstPageDelayMs : pageDelayMs;
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (failSearch && url.pathname.startsWith('/Api/v1/Jobs/Search')) {
        return json(route, { Message: 'Demo failure' }, failSearch);
      }
      return beacon(route, url);
    }
    log(`[net] blocked ${url.href.slice(0, 120)}`);
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => {
    pageErrors.push(e.message);
    if (verbose) console.log(`[page error] ${e.message}`);
  });
  if (verbose) page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console] ${m.text().slice(0, 300)}`); });

  const params = new URLSearchParams({
    host: BEACON_HOST,
    source: env === 'production' ? BEACON_HOST : `https://${env}.ses.nsw.gov.au`,
    userId: '17',
    hq: hq.join(','),
    start: new Date(now.getTime() - hours * 3600 * 1000).toISOString(),
    end: now.toISOString(),
  });
  await page.goto(`${APP_ORIGIN}/pages/stats.html?${params}`);
  await page.waitForFunction(() => document.body.style.opacity === '1');

  return { browser, context, page, scenario, pageErrors };
}

/** Wait for the first load to finish (or fail) and the word cloud to lay out. */
export async function waitForStats(page, { cloud = true } = {}) {
  await page.waitForFunction(() => window.statsVM && (!window.statsVM.loading() || window.statsVM.error()));
  if (cloud) await page.locator('#word-cloud svg, #word-cloud p').first().waitFor({ timeout: 10000 }).catch(() => {});
  await settle(page);
}

/** Let fetches, chart transitions and KO's deferred updates finish. */
export async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}
