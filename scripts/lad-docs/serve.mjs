/*
  Serve the built LAD page over the LAN against the mock Beacon, so a real
  device (an iPad, a phone) can open it in its own browser. No Playwright on
  the device: this is a plain HTTP server.

    npm run dev && npm run lad:serve            # then open the printed URL on the device
    npm start                                   # (other terminal) rebuild on save; reload the device
    npm run lad:serve -- --port 4123 --host 127.0.0.1 --no-eruda --verbose
    open http://<mac-ip>:4123/?trace=1          # log taps + popup open/close to the console

  What stands in for the extension environment (cf. launch.mjs):
    - the chrome.* stub from launch.mjs, inlined at the top of tasking.html;
    - a fetch/XHR shim that sends every cross-origin request through
      /__mock/ on this server, where mockBeacon.mjs answers Beacon and the
      lambdas from the fake scenario and fetches the rest (feeds the
      extension's host_permissions would let through CORS) on the device's
      behalf. Map tiles and other <img> loads go straight to the internet;
    - eruda (an on-page devtools console, from jsDelivr) unless --no-eruda,
      since an iPad browser has no devtools of its own.

  The scenario is rebuilt on every page load, so a reload resets the demo.
*/

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { buildScenario } from './scenario.mjs';
import { createMockRouter, BEACON_HOST } from './mockBeacon.mjs';
import { renderPhotos } from './photos.mjs';
import { installChromeStub, fakeJwt } from './launch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const argValue = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const PORT = Number(argValue('--port', 4123));
const HOST = argValue('--host', '0.0.0.0'); // 127.0.0.1 keeps it off the LAN
const ERUDA = !args.includes('--no-eruda');
const verbose = args.includes('--verbose');
const log = verbose ? (m) => console.log(m) : () => {};

if (!fs.existsSync(path.join(DIST, 'pages/tasking.html'))) {
  console.error('dist/pages/tasking.html not found -- run `npm run dev` first');
  process.exit(1);
}

// Incident photos are drawn in a browser canvas; render them once up front.
let photoImages = null;
try {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  photoImages = await renderPhotos(await browser.newContext());
  await browser.close();
} catch (e) {
  console.warn(`Incident photos disabled (couldn't start Chrome to draw them): ${e.message}`);
}

let scenario;
let mock;
function resetScenario() {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  scenario = buildScenario(new Date());
  mock = createMockRouter(scenario, { log, photoImages, manifest });
  return manifest;
}
resetScenario();

/** Runs in the page after the chrome stub: route cross-origin fetch/XHR through /__mock/. */
function installRequestShim() {
  const proxied = (url) => {
    let abs;
    try { abs = new URL(url, location.href); } catch { return url; }
    if (abs.origin === location.origin || !/^https?:$/.test(abs.protocol)) return url;
    return `${location.origin}/__mock/?u=${encodeURIComponent(abs.href)}`;
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) return realFetch(new Request(proxied(input.url), input), init);
    return realFetch(proxied(String(input)), init);
  };
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return realOpen.call(this, method, proxied(String(url)), ...rest);
  };
}

/**
 * Runs in the page when the URL has trace=1: logs taps (pointer/touch/mouse/
 * click events) and the map's popup open/close, with a stack for each close,
 * to the console (eruda on the device). For chasing touch-only bugs.
 */
function installTouchTrace() {
  if (!/[?&]trace=1\b/.test(location.search)) return;
  const t0 = performance.now();
  const ts = () => ((performance.now() - t0) / 1000).toFixed(3);
  const desc = (el) => (el && el.classList
    ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].slice(0, 3).join('.')}`
    : String(el));
  const types = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];
  for (const type of types) {
    document.addEventListener(type, (e) => {
      console.log(`[trace ${ts()}] ${type}${e.pointerType ? ' ' + e.pointerType : ''}${e.isTrusted ? '' : ' (synthetic)'} -> ${desc(e.target)}`);
    }, true);
  }
  const hook = () => {
    const map = window.ko && window.ko.dataFor(document.body)?.mapVM?.map;
    if (!map) return setTimeout(hook, 500);
    for (const type of ['preclick', 'click', 'contextmenu', 'movestart', 'moveend', 'popupopen']) {
      map.on(type, () => console.log(`[trace ${ts()}] map ${type}`));
    }
    map.on('popupclose', () => console.log(`[trace ${ts()}] map popupclose\n${new Error().stack}`));
    console.log('[trace] on');
  };
  window.addEventListener('load', hook);
}

function pageHead() {
  const manifest = resetScenario();
  const stubArgs = {
    tokenKey: `beaconAPIToken-${BEACON_HOST}`,
    token: fakeJwt(scenario.jobs[0].CreatedBy.Id),
    manifest,
    config: null,
    remoteTab: 'ok',
  };
  let head = `<script>(${installChromeStub})(${JSON.stringify(stubArgs)});(${installRequestShim})();(${installTouchTrace})();</script>`;
  if (ERUDA) head += '<script src="https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.min.js"></script><script>eruda.init();</script>';
  return head;
}

/** A Playwright-Route-shaped wrapper around one proxied request, for mockBeacon.mjs. */
function makeRoute(req, res, target, body) {
  const DROP = new Set(['host', 'origin', 'referer', 'connection', 'content-length', 'accept-encoding']);
  const send = (status, headers, data) => {
    if (res.headersSent) return;
    res.writeHead(status, { ...headers, 'access-control-allow-origin': '*' });
    res.end(data);
  };
  const realFetch = async () => {
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !DROP.has(k)));
    const r = await fetch(target, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body, redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    // fetch() has already decompressed the body.
    const out = Object.fromEntries([...r.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k)));
    return { status: () => r.status, headers: () => out, body: async () => buf };
  };
  return {
    request: () => ({
      url: () => target,
      method: () => req.method,
      headers: () => req.headers,
      resourceType: () => 'fetch',
      postData: () => (body.length ? body.toString() : null),
      postDataJSON: () => { try { return JSON.parse(body.toString()); } catch { return null; } },
    }),
    fulfill: async ({ status = 200, contentType, body: data = '', headers = {}, response } = {}) => {
      if (response) return send(response.status(), headers, await response.body());
      return send(status, contentType ? { 'content-type': contentType, ...headers } : headers, data);
    },
    fetch: realFetch,
    continue: async () => {
      const r = await realFetch();
      send(r.status(), r.headers(), await r.body());
    },
    abort: async () => send(502, {}, ''),
  };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json' };

const landingQuery = () => new URLSearchParams({
  host: BEACON_HOST,
  source: BEACON_HOST,
  hq: String(scenario.hq.Id),
  userId: String(scenario.jobs[0].CreatedBy.Id),
  personId: String(scenario.jobs[0].CreatedBy.Id),
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/__mock/') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
        return res.end();
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const target = url.searchParams.get('u');
      log(`[proxy] ${req.method} ${target.slice(0, 140)}`);
      return await mock(makeRoute(req, res, target, Buffer.concat(chunks)));
    }
    if (url.pathname === '/' || (url.pathname === '/pages/tasking.html' && !url.searchParams.has('host'))) {
      const trace = url.searchParams.get('trace') === '1' ? '&trace=1' : '';
      res.writeHead(302, { location: `/pages/tasking.html?${landingQuery()}${trace}` });
      return res.end();
    }
    const file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      log(`[app] 404 ${url.pathname}`);
      res.writeHead(404);
      return res.end();
    }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    let data = fs.readFileSync(file);
    if (url.pathname === '/pages/tasking.html') data = data.toString().replace(/<head[^>]*>/i, (m) => m + pageHead());
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    console.error(`[serve] ${req.method} ${req.url}: ${e.stack || e}`);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  console.log('LAD demo (fake data) served on the LAN. Open on the device:');
  for (const ip of lan) console.log(`  http://${ip}:${PORT}/`);
  console.log(`  (this machine: http://localhost:${PORT}/)  Ctrl+C to stop.`);
});
