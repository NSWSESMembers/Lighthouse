/*
  Shared harness for the Lighthouse pages Beacon opens in a new tab
  (Incident Statistics, Incident Summary): launch a built page from dist/
  in the locally installed Google Chrome, outside the extension, against a
  mock Beacon.

  What stands in for the extension:
    - window.chrome: storage.local holding a fake bearer token, and
      runtime.getManifest -- the only chrome.* APIs the pages touch.
    - the URL params Beacon's Lighthouse menu passes (host/source/hq/start/end).
    - dist/ served from a fake origin via request interception.

  Each page's harness (scripts/<page>-docs/launch.mjs) supplies the fake
  Beacon answers. Requires a build first: `npm run dev` (or `npm run prod`).
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const APP_ORIGIN = 'http://lighthouse.demo.test';
export const BEACON_HOST = 'https://beacon.demo.test';
export const TIMEZONE = 'Australia/Sydney';

export const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * @param {object} opts
 * @param {string} opts.page  the page under dist/pages/, e.g. 'summary.html'
 * @param {(route, url: URL) => Promise|void} opts.beacon  answers every request to BEACON_HOST
 * @param {Record<string, any>} [opts.appJson]  app paths answered with this JSON instead of dist/
 *        (e.g. { '/resources/unitClusters.json': fakeClusters })
 * @param {number[]} opts.hq  HQ ids for the `hq` param ([] for "all of NSW")
 * @param {Date} opts.now  the instant the page's clock starts at (and the launch range ends)
 * @param {boolean} [opts.shiftClock]  shift the page's Date to `now` (else it uses the real time)
 * @param {number} [opts.hours=72]  launch range: the last N hours to `now`
 * @param {{start: Date, end: Date}} [opts.range]  launch range, instead of `hours`
 * @param {boolean} [opts.headless=true]
 * @param {{width:number,height:number}} [opts.viewport]
 * @param {boolean} [opts.dark]  emulate a dark OS colour scheme
 * @param {'production'|'trainbeacon'|'devbeacon'} [opts.env='production']  which Beacon the page
 *        thinks it was opened from (the `source` param; requests still go to the mock)
 * @param {boolean} [opts.watermark=false]  keep the Development build's watermark (dev builds only)
 * @param {boolean} [opts.verbose]  log mock traffic and page errors
 * @param {number} [opts.scale=1]  device pixel ratio
 * @returns {Promise<{browser, context, page, pageErrors: string[], log: Function}>}
 */
export async function launchPage(opts) {
  const {
    page: pageFile, beacon, appJson = {}, hq, now, shiftClock = false, hours = 72, range,
    headless = true, viewport = { width: 1440, height: 1000 },
    dark = false, verbose = false, scale = 1, watermark = false, env = 'production',
  } = opts;
  if (!fs.existsSync(path.join(DIST, 'pages', pageFile))) {
    throw new Error(`dist/pages/${pageFile} not found -- run \`npm run dev\` first`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  // The pages watermark Development builds; guide screenshots shouldn't carry it.
  if (!watermark) manifest.name = manifest.name.replace(/\s*Development.*$/i, '');
  const log = verbose ? (msg) => console.log(msg) : () => {};
  const pageErrors = [];

  const browser = await chromium.launch({ channel: 'chrome', headless });
  const context = await browser.newContext({
    viewport, deviceScaleFactor: scale, timezoneId: TIMEZONE, locale: 'en-AU',
    colorScheme: dark ? 'dark' : 'light',
  });
  if (shiftClock) {
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

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      if (url.pathname in appJson) return json(route, appJson[url.pathname]);
      const file = path.join(DIST, decodeURIComponent(url.pathname));
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
      log(`[app] 404 ${url.pathname}`);
      return route.fulfill({ status: 404, body: '' });
    }
    if (url.origin === BEACON_HOST) return beacon(route, url);
    log(`[net] blocked ${url.href.slice(0, 120)}`);
    return route.abort();
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => {
    pageErrors.push(e.message);
    if (verbose) console.log(`[page error] ${e.message}`);
  });
  if (verbose) page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console] ${m.text().slice(0, 300)}`); });

  const launchRange = range || { start: new Date(now.getTime() - hours * 3600 * 1000), end: now };
  const params = new URLSearchParams({
    host: BEACON_HOST,
    source: env === 'production' ? BEACON_HOST : `https://${env}.ses.nsw.gov.au`,
    userId: '17',
    hq: hq.join(','),
    start: launchRange.start.toISOString(),
    end: launchRange.end.toISOString(),
  });
  await page.goto(`${APP_ORIGIN}/pages/${pageFile}?${params}`);
  await page.waitForFunction(() => document.body.style.opacity === '1');

  return { browser, context, page, pageErrors, log };
}

/** Let fetches, transitions and KO's deferred updates finish. */
export async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** The value after `--name` on the command line. */
export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
