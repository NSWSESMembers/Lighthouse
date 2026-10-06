/*
  Launch the built LAD page (dist/pages/tasking.html) in the locally
  installed Google Chrome, outside the extension, against the mock Beacon.

  What stands in for the extension environment:
    - window.chrome: storage.local (holding a fake bearer token),
      runtime.getManifest/sendMessage -- the only chrome.* APIs the tasking
      page touches.
    - the page URL params the extension normally passes (host/source/hq/...).
    - dist/ served from a fake origin via request interception, so no web
      server is needed.

  Requires a build first: `npm run dev` (or `npm run prod`).
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildScenario } from './scenario.mjs';
import { createMockRouter, BEACON_HOST } from './mockBeacon.mjs';
import { renderPhotos } from './photos.mjs';

// Rendered once per process and reused across launches (capture.mjs relaunches per shot).
let photoImagesCache = null;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const APP_ORIGIN = 'http://lighthouse.demo.test';

function fakeJwt(sub) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: String(sub), exp: 4102444800 })}.demo`;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.headless=true]
 * @param {{width:number,height:number}} [opts.viewport]
 * @param {Date|string} [opts.now]  start the page's clock (and the scenario) at this instant
 * @param {object} [opts.config]  partial lh-taskingConfig to pre-seed (e.g. { darkMode: true })
 * @param {'ok'|'missing'|'closed'} [opts.remoteTab='ok']  how the stubbed background answers
 *        "open in Beacon" requests: success, no Remote tab registered, or the Remote tab closed
 * @param {boolean} [opts.verbose]  log mock traffic and page errors
 */
export async function launchLad(opts = {}) {
  const { headless = true, viewport = { width: 1600, height: 1000 }, config, verbose = false, remoteTab = 'ok' } = opts;
  if (!fs.existsSync(path.join(DIST, 'pages/tasking.html'))) {
    throw new Error('dist/pages/tasking.html not found -- run `npm run dev` first');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  const now = opts.now ? new Date(opts.now) : new Date();
  const scenario = buildScenario(now);
  const log = verbose ? (m) => console.log(m) : () => {};

  const browser = await chromium.launch({ channel: 'chrome', headless });
  const context = await browser.newContext({ viewport, timezoneId: scenario.timezone, locale: 'en-AU' });
  // Shift Date rather than freeze it: row transitions and Leaflet's tile
  // fade measure elapsed Date.now(), so a frozen clock leaves rows and the
  // basemap invisible. Time starts at `now` and runs normally from there.
  if (opts.now) {
    await context.addInitScript((offsetMs) => {
      const RealDate = Date;
      const shifted = () => RealDate.now() + offsetMs;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate {
        constructor(...args) { if (args.length === 0) super(shifted()); else super(...args); }
        static now() { return shifted(); }
      };
    }, now.getTime() - Date.now());
  }

  const operatorId = scenario.jobs[0].CreatedBy.Id;
  await context.addInitScript(({ tokenKey, token, manifest, config, remoteTab }) => {
    const store = { [tokenKey]: JSON.stringify({ token, expdate: '2099-01-01T00:00:00Z' }) };
    window.chrome = {
      runtime: {
        id: 'lighthouse-demo',
        getManifest: () => manifest,
        // "Open in Beacon" etc. Replies mirror src/background.js's
        // tasking-openURL handler; nothing is actually opened.
        sendMessage: (msg, cb) => {
          let reply = { success: true, message: 'Demo mode: not opened' };
          if (msg?.type === 'tasking-openURL' && remoteTab === 'missing') reply = { error: 'No remote tab registered' };
          if (msg?.type === 'tasking-openURL' && remoteTab === 'closed') reply = { error: 'Failed to send tasking remote command', message: 'No tab with id: 123.' };
          if (cb) setTimeout(() => cb(reply), 0);
        },
        onMessage: { addListener() {}, removeListener() {} },
      },
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
    if (config && !localStorage.getItem('lh-taskingConfig.__seeded')) {
      localStorage.setItem('lh-taskingConfig', JSON.stringify(config));
      localStorage.setItem('lh-taskingConfig.__seeded', '1');
    }
  }, { tokenKey: `beaconAPIToken-${BEACON_HOST}`, token: fakeJwt(operatorId), manifest, config: config || null, remoteTab });

  photoImagesCache ??= await renderPhotos(context);
  const mock = createMockRouter(scenario, { log, photoImages: photoImagesCache });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP_ORIGIN) {
      const file = path.join(DIST, decodeURIComponent(url.pathname));
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
      log(`[app] 404 ${url.pathname}`);
      return route.fulfill({ status: 404, body: '' });
    }
    return mock(route);
  });

  const page = await context.newPage();
  if (verbose) {
    page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`[console] ${m.text().slice(0, 300)}`); });
  }

  const params = new URLSearchParams({
    host: BEACON_HOST,
    source: BEACON_HOST,
    hq: String(scenario.hq.Id),
    userId: String(operatorId),
    personId: String(operatorId),
  });
  await page.goto(`${APP_ORIGIN}/pages/tasking.html?${params}`);
  await page.waitForFunction(() => document.body.style.opacity === '1');

  return { browser, context, page, scenario };
}

/** Dismiss the on-load config modal (which kicks off the data load) and wait for the lists to fill. */
export async function closeConfigAndLoad(page) {
  await page.locator('#configModal .modal-footer button.btn-primary').click();
  await page.locator('#configModal').waitFor({ state: 'hidden' });
  await settle(page);
}

/** Let fetches, marker batching and CSS transitions finish. */
export async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}
