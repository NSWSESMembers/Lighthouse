/*
  Capture LAD documentation screenshots headlessly against the fake demo data.

    npm run dev && npm run lad:shots
    npm run lad:shots -- --out docs/lad/images     # write straight into the guide
    npm run lad:shots -- --only main,team-expanded  # just some shots
    npm run lad:shots -- --verbose                  # log mock traffic and page errors

  Each shot starts from a fresh page (fresh config, config modal open on
  load), so shots don't leak state into each other. The clock is pinned so
  times in the lists are stable between runs; map tiles are live, so the
  basemap can change if Esri updates it.

  Add a shot: append to SHOTS below. `run(page)` drives the page into the
  state to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the whole viewport is captured.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchLad, closeConfigAndLoad, settle } from './launch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// Pinned "now" for repeatable list timestamps: a Monday afternoon in Sydney.
const NOW = arg('now', '2026-10-05T15:30:00+11:00');

const configTab = (id) => ({
  run: async (page) => {
    await page.locator(`#cfgTab-${id}`).click();
    await settle(page, 600);
  },
  target: (page) => page.locator('#configModal .modal-content'),
});

/** Zoom the Situation Map in `steps` clicks of its + button, waiting for each zoom to land. */
async function zoomMapIn(page, steps) {
  for (let i = 0; i < steps; i++) {
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);
  }
  await settle(page, 800);
}

/** A screenshot target covering the bounding box of every element matching `selector`. */
function unionOf(page, selector, pad = 2) {
  return {
    async screenshot(opts) {
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      const boxes = (await Promise.all((await page.locator(selector).all()).map((l) => l.boundingBox()))).filter(Boolean);
      if (!boxes.length) throw new Error(`nothing matched ${selector}`);
      const x = Math.min(...boxes.map((b) => b.x)) - pad;
      const y = Math.min(...boxes.map((b) => b.y)) - pad;
      const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
      const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
      return page.screenshot({ ...opts, clip: { x, y, width: right - x, height: bottom - y } });
    },
  };
}

/** Open the photo viewer for 2610-1207 and wait for the first photo and thumbnails. */
async function openPhotos(page) {
  await closeConfigAndLoad(page);
  const row = page.locator('tr.job-row[data-job-id="70006"]');
  await row.scrollIntoViewIfNeeded();
  await row.locator('.images-button:visible').click();
  await page.locator('#incidentImagesModal').waitFor({ state: 'visible' });
  await settle(page, 1200);
}

/**
 * Open New Radio Log from the Radio Log button on DEM01's tasking under
 * 2610-1207 (70006), so the incident, team and status change are all filled.
 */
async function openTaskingRadioLog(page) {
  await closeConfigAndLoad(page);
  const row = page.locator('tr.job-row[data-job-id="70006"]');
  await row.scrollIntoViewIfNeeded();
  await row.locator('[data-bind*="toggleAndExpand"]').first().click();
  await settle(page, 800);
  await row.locator('button[title="Radio Log"]:visible').first().click();
  await page.locator('#CreateOpsLogModal').waitFor({ state: 'visible' });
  await page.locator('#OpsLogTextInput').fill('Team arrived on scene, starting roof assessment.');
  await settle(page, 600);
}

/** Open the Trackable Asset Library from the config modal's rail link (saves + loads, then opens it). */
async function openAssetLibrary(page) {
  await page.locator('#configModal button:has-text("Trackable Asset Library")').click();
  await page.locator('#trackableAssetsModal').waitFor({ state: 'visible' });
  await settle(page, 1500);
}

/** A library card by its asset name. */
const libraryCard = (page, name) =>
  page.locator('#trackableAssetsModal .card').filter({ has: page.locator('.fs-4', { hasText: new RegExp(`^${name}$`) }) });

// Spotlight's input only searches on keydown, so type rather than fill().
async function openSpotlight(page, query) {
  await closeConfigAndLoad(page);
  await page.keyboard.press('Control+k');
  await settle(page, 600);
  await page.locator('#spotlightSearchInput').pressSequentially(query);
  await settle(page, 600);
}

const spotlightBox = (page) => unionOf(page,
  '#SpotlightSearchModal .input-group, #SpotlightSearchModal .modal-body > .d-flex.flex-wrap, #spotlightResults button', 6);

/*
  Fake overlay feeds. Transport NSW and HazardWatch reach LAD through the
  extension's background page (chrome.runtime.sendMessage), which the
  harness stubs, so these answer those messages with invented features
  around Demo City. Positions are [east, north] metres from OVERLAY_ORIGIN
  (the demo HQ); `label` is the callout drawn on the overlay-markers shot.
*/
const OVERLAY_ORIGIN = { lat: -33.815, lng: 151.001 };
const OVERLAY_FEEDS = {
  'transport-incidents': [
    { at: [450, 1250], label: 'Traffic incident', properties: {
      displayName: 'Crash', mainCategory: 'Crash', CategoryIcon: 'Crash',
      roads: [{ mainStreet: 'Banksia Rd', locationQualifier: 'near', suburb: 'Demo River' }],
      adviceA: 'Exercise caution.', adviceB: 'Reduced speed limit.', otherAdvice: 'One lane closed eastbound.',
      speedLimit: 40, start: '2026-10-05T14:10:00+11:00', hideEndDate: true, attendingGroups: ['Police', 'Tow truck'],
    } },
  ],
  'transport-local-reports': [
    { at: [-550, 1650], label: 'Council report', properties: {
      displayName: 'Flooding', mainCategory: 'Flooding', CategoryIcon: 'Flood', impactingNetwork: true,
      roads: [{ mainStreet: 'Old Ferry Rd', locationQualifier: 'at', suburb: 'Demo Flats' }],
      adviceA: 'Road closed.', adviceB: 'Use alternative route.', otherAdvice: 'Closed by Demo Shire Council. Water over the causeway.',
      start: '2026-10-05T08:30:00+11:00', hideEndDate: true,
    } },
  ],
  'transport-cameras': [
    { at: [800, 350], label: 'Traffic camera', properties: { direction: 'N', view: 'Waratah Lane at Kurrajong Rd, looking north', href: '' } },
  ],
};

/** A fake HazardWatch warning area; LAD puts its icon in the middle. */
const HAZARDWATCH_FEED = {
  ring: [[-750, 0], [150, -150], [400, 500], [-100, 900], [-800, 650], [-750, 0]],
  label: 'HazardWatch warning',
  properties: {
    hw_event: 'Flood',
    'hw_AustralianWarningSystem:WarningLevel': 'Watch and Act',
    hw_title: 'Demo River: prepare to evacuate',
    hw_description: '<p>Demo River is expected to reach the moderate flood level this evening. Low-lying parts of Demo River and Demo Flats may be affected.</p><p>Prepare to evacuate and follow the advice of emergency services.</p>',
  },
};

/**
 * Close the config, answer the background-page overlay feeds with the fake
 * data above, then switch on the overlay layers `keys` (mapVM.onlineLayers
 * keys) and wait for them to draw. Incidents and assets are hidden so only
 * overlay markers are on the map; the view is centred `centre` metres from
 * OVERLAY_ORIGIN, and is stored as window.__shotCentre.
 */
async function showOverlays(page, keys, { zoom = 15, centre = [0, 0] } = {}) {
  await closeConfigAndLoad(page);
  await page.evaluate(({ keys, zoom, centre, origin, feeds, hw }) => {
    const vm = window.ko.dataFor(document.body); const mv = vm.mapVM; const map = mv.map;
    const toLngLat = ([e, n]) => [origin.lng + e / (111320 * Math.cos((origin.lat * Math.PI) / 180)), origin.lat + n / 110540];
    const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });
    const points = (rows) => ({ type: 'FeatureCollection', features: rows.map((r) => feature({ type: 'Point', coordinates: toLngLat(r.at) }, r.properties)) });
    const hazardWatch = { type: 'FeatureCollection', features: [feature({ type: 'Polygon', coordinates: [hw.ring.map(toLngLat)] }, hw.properties)] };
    sessionStorage.setItem('lighthouseTransportApiKeyCache', 'demo');
    const send = window.chrome.runtime.sendMessage;
    window.chrome.runtime.sendMessage = (msg, cb) => {
      if (feeds[msg?.type]) return setTimeout(() => cb(points(feeds[msg.type])), 0);
      if (/^hazard-watch/.test(msg?.type)) return setTimeout(() => cb(hazardWatch), 0);
      return send(msg, cb);
    };
    vm.incidentsVisible(false);
    map.removeLayer(mv.assetLayer);
    const [lng, lat] = toLngLat(centre);
    window.__shotCentre = { lat, lng };
    map.setView(window.__shotCentre, zoom, { animate: false });
    keys.forEach((k) => { const e = mv.onlineLayers.get(k); map.addLayer(e.layerGroup); e.refresh(); });
  }, { keys, zoom, centre, origin: OVERLAY_ORIGIN, feeds: OVERLAY_FEEDS, hw: HAZARDWATCH_FEED });
  await settle(page, 2500);
}

/** A `width` x `height` crop of the map around window.__shotCentre, shifted by [dx, dy]. */
function mapCrop(page, width, height, [dx, dy] = [0, 0]) {
  return {
    async screenshot(opts) {
      const box = await page.locator('#map').boundingBox();
      const c = await page.evaluate(() => window.ko.dataFor(document.body).mapVM.map.latLngToContainerPoint(window.__shotCentre));
      return page.screenshot({ ...opts, clip: { x: box.x + c.x - width / 2 + dx, y: box.y + c.y - height / 2 + dy, width, height } });
    },
  };
}

const SHOTS = {
  'config-data': configTab('data'),
  'config-incident-filters': configTab('filters'),
  'config-map-markers': configTab('map'),
  // Map markers tab with the Asset markers section open (overlapping
  // markers setting and its options).
  'config-asset-markers': {
    run: async (page) => {
      await page.locator('#cfgTab-map').click();
      await settle(page, 400);
      await page.locator('button[data-bs-target="#cfgSub-mapAssets"]').click();
      await settle(page, 600);
    },
    target: (page) => page.locator('#configModal .modal-content'),
  },
  'config-collab-layers': configTab('collab'),
  'config-layout': configTab('sidebar'),
  'config-starred': configTab('starred'),
  'config-appearance': configTab('appearance'),
  'config-instant-task': configTab('suggest'),

  main: { run: closeConfigAndLoad },

  // The map legend, expanded.
  legend: {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.evaluate(() => {
        const body = document.querySelector('.legend-body');
        if (body && getComputedStyle(body).display === 'none') document.querySelector('.toggle-legend').click();
      });
      await settle(page, 600);
    },
    target: (page) => page.locator('.legend-container'),
  },

  'team-register': {
    run: closeConfigAndLoad,
    target: (page) => page.locator('#paneTop'),
  },

  'team-expanded': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.locator('tr.team-row').first().locator('[data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
    },
    target: (page) => page.locator('#paneTop'),
  },

  'incident-expanded': {
    // Taller, so the whole expanded panel fits in the incident pane.
    launch: { viewport: { width: 1600, height: 1300 } },
    run: async (page) => {
      await closeConfigAndLoad(page);
      // Expand a tasked incident with a tag and a separate contact, so the
      // tags, the "Called By" line and the taskings list are all visible.
      await page.locator('tr.job-row[data-job-id="70005"] [data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
      // The register's sticky header would cover the top of the crop.
      await page.addStyleTag({ content: 'table.jobs > thead { visibility: hidden; }' });
    },
    target: (page) => page.locator('tr.job-row .job-details:visible'),
  },

  // Team register's toolbar buttons (star -> gear), without the search box.
  'register-controls': {
    run: closeConfigAndLoad,
    target: (page) => unionOf(page, '#paneTop .pane-toolbar button:visible:not(.input-group button)'),
  },

  // "In map view only": zoom the map in so only part of the area is
  // visible, then turn the toggle on for both registers.
  'in-view-only': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await zoomMapIn(page, 2);
      await page.locator('button[title="Only list teams within the current map view"]').click();
      await page.locator('button[title="Only list incidents within the current map view"]').click();
      await settle(page, 800);
    },
  },

  'in-view-toggle-active': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await zoomMapIn(page, 2);
      await page.locator('button[title="Only list incidents within the current map view"]').click();
      await settle(page, 800);
    },
    target: (page) => page.locator('#paneBottom .pane-toolbar'),
  },

  // The indicators under an incident ID: photos, outstanding actions and
  // ICEMS. 70006 (2610-1207) has all three.
  'incident-row-icons': {
    run: closeConfigAndLoad,
    target: (page) => page.locator('tr.job-row[data-job-id="70006"]'),
  },
  'icon-incident-photo': {
    run: closeConfigAndLoad,
    target: (page) => unionOf(page, 'tr.job-row[data-job-id="70006"] .images-button:visible', 1),
  },
  'icon-icems': {
    run: closeConfigAndLoad,
    target: (page) => unionOf(page, 'tr.job-row[data-job-id="70006"] em.fa-share-alt:visible', 1),
  },

  // Just the thumbtack + count, for inline use in the text.
  'icon-action-pin': {
    run: closeConfigAndLoad,
    target: (page) => unionOf(page, 'tr.job-row[data-job-id="70001"] .action-required-button:visible', 1),
  },

  // ...and the grouped "xN" pills on the expanded incident.
  'incident-action-pills': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.locator('tr.job-row[data-job-id="70001"] [data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
    },
    target: (page) => unionOf(page, 'tr.job-row[data-job-id="70001"] #actionRequiredTags > span', 10),
  },

  // Incident photo viewer (2610-1207 has three fake photos).
  'incident-photos': {
    run: openPhotos,
    target: (page) => page.locator('#incidentImagesModal .modal-content'),
  },
  'incident-photos-zoomed': {
    run: async (page) => {
      await openPhotos(page);
      await page.locator('#incidentImagesModal button[title="Zoom to actual size"]').click();
      await settle(page, 600);
      // Pan to the middle of the photo (what drag-to-pan does): scroll the
      // zoomed preview box so the damaged roof is in view.
      await page.evaluate(() => {
        const box = [...document.querySelectorAll('#incidentImagesModal *')]
          .find((el) => el.scrollWidth > el.clientWidth + 50 && el.scrollHeight > el.clientHeight + 50);
        if (box) box.scrollTo((box.scrollWidth - box.clientWidth) / 2, (box.scrollHeight - box.clientHeight) * 0.35);
      });
      await settle(page, 400);
    },
    target: (page) => page.locator('#incidentImagesModal .modal-content'),
  },

  // Incident marker hover popup for 2610-1207: priority/type, address,
  // situation, status + unit, ICEMS agency badges and the action badge.
  // Agencies load when the incident is expanded, so expand it first, then
  // focus the map on it and hover its marker.
  'incident-hover': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      const row = page.locator('tr.job-row[data-job-id="70006"]');
      await row.scrollIntoViewIfNeeded();
      await row.locator('[data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
      await row.locator('[data-bind*="click: j.focusMap"]').first().click();
      await settle(page, 1500);
      // Focusing opens the incident's popup; its pointer sits just above the
      // marker. Note that spot, close the popup, then hover the marker.
      const tip = await page.locator('.leaflet-popup-tip-container').boundingBox();
      await page.locator('.leaflet-popup-close-button').click();
      await settle(page, 400);
      await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height + 8);
      await page.locator('.leaflet-tooltip.job-tooltip').waitFor();
      await settle(page, 400);
    },
    target: (page) => unionOf(page, '.leaflet-tooltip.job-tooltip', 30),
  },

  // "Open in Beacon" with no Beacon Remote tab registered: LAD explains why
  // and offers to open the page in a new window instead.
  'remote-tab-missing': {
    launch: { remoteTab: 'missing' },
    run: async (page) => {
      await closeConfigAndLoad(page);
      const row = page.locator('tr.job-row[data-job-id="70006"]');
      await row.scrollIntoViewIfNeeded();
      await row.locator('[data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
      await page.locator('tr.job-row[data-job-id="70006"] button:has-text("Open in Beacon")').first().click();
      await page.locator('#alerts-container .alert').first().waitFor();
      await settle(page, 600);
    },
    target: (page) => page.locator('#alerts-container .alert').first(),
  },

  // Trackable Asset Library: search, Talkgroup/Type/Satellite filters and
  // the asset cards (DEM02 has a satellite tracker, DEMB1 is satellite-only
  // with an inactive tracker).
  'trackable-assets-library': {
    run: openAssetLibrary,
    target: (page) => page.locator('#trackableAssetsModal .modal-content'),
  },

  // The same list narrowed to satellite-tracked assets: DEM02 (active tracker)
  // and DEMB1 (satellite-only, tracker not active -> crossed-out icon).
  'trackable-assets-library-satellite': {
    run: async (page) => {
      await openAssetLibrary(page);
      await page.locator('#trackableAssetsModal select[aria-label="Filter by location source"]').selectOption({ label: 'Satellite tracker' });
      await settle(page, 600);
    },
    target: (page) => page.locator('#trackableAssetsModal .modal-content'),
  },

  // Asset popup for DEM02, opened with the library's "Show on map" button.
  'asset-popup': {
    run: async (page) => {
      await openAssetLibrary(page);
      await libraryCard(page, 'DEM02').locator('button[title="Show on map"]').click();
      await page.locator('.leaflet-popup .veh-pop').waitFor();
      await settle(page, 1200);
    },
    target: (page) => page.locator('.leaflet-popup-content-wrapper'),
  },

  // Inline satellite icons (active / crossed out) for the guide text.
  'icon-satellite': {
    launch: { scale: 3 },
    run: openAssetLibrary,
    target: (page) => unionOf(page, '#trackableAssetsModal .card:has(.fs-4:text-is("DEM02")) .sat-icon:visible', 2),
  },
  'icon-show-on-map': {
    run: openAssetLibrary,
    target: (page) => unionOf(page, '#trackableAssetsModal .card:has(.fs-4:text-is("DEM02")) button[title="Show on map"]', 1),
  },
  'icon-satellite-inactive': {
    launch: { scale: 3 },
    run: openAssetLibrary,
    target: (page) => unionOf(page, '#trackableAssetsModal .card:has(.fs-4:text-is("DEMB1")) .sat-icon:visible', 2),
  },

  // Overlapping asset markers spread out at street level: the demo's five
  // assets (matched + unmatched layers) moved close together, so some stay
  // upright, one swings around its position and two move out on lines.
  'asset-markers-spread': {
    launch: { scale: 2 },
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.evaluate(() => {
        const mv = window.ko.dataFor(document.body).mapVM;
        mv.map.addLayer(mv.unmatchedAssetLayer);
      });
      await settle(page, 1500);
      await page.evaluate(() => {
        const mv = window.ko.dataFor(document.body).mapVM; const map = mv.map;
        const ms = [];
        mv.assetLayer.eachLayer((m) => ms.push(m));
        mv.unmatchedAssetLayer.eachLayer((m) => ms.push(m));
        const c = map.getCenter();
        map.setView(c, 18, { animate: false });
        const p0 = map.latLngToContainerPoint(c);
        const offsets = [[0, 0], [34, 6], [-30, 14], [6, -4], [8, 44]];
        ms.forEach((m, i) => { if (offsets[i]) m.setLatLng(map.containerPointToLatLng(p0.add(offsets[i]))); });
        window.__shotCentre = c;
        mv.assetPinLayout.run();
      });
      await settle(page, 1200);
    },
    target: (page) => ({
      async screenshot(opts) {
        const box = await page.locator('#map').boundingBox();
        const c = await page.evaluate(() => window.ko.dataFor(document.body).mapVM.map.latLngToContainerPoint(window.__shotCentre));
        return page.screenshot({ ...opts, clip: { x: box.x + c.x - 170, y: box.y + c.y - 180, width: 340, height: 300 } });
      },
    }),
  },

  // A selected vehicle's breadcrumb trail: fixes are recorded as positions
  // arrive, so seed one (30 minutes, a fix every 5) leading to its marker,
  // then open its popup.
  'asset-trail': {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.evaluate(() => {
        const mv = window.ko.dataFor(document.body).mapVM; const map = mv.map;
        let m = null;
        mv.assetLayer.eachLayer((l) => { m ||= l; });
        map.setView(m.getLatLng(), 16, { animate: false });
        const p0 = map.latLngToContainerPoint(m.getLatLng());
        const offsets = [[250, 210], [205, 150], [185, 95], [120, 75], [55, 40], [0, 0]];
        const fixes = offsets.map(([dx, dy], i) => {
          const ll = map.containerPointToLatLng(p0.add([dx, dy]));
          return { lat: ll.lat, lng: ll.lng, t: Date.now() - (offsets.length - 1 - i) * 5 * 60 * 1000 };
        });
        mv.assetTrails.trails.set(String(m._assetId), fixes);
        window.__shotMarker = m;
        m.openPopup();
      });
      await settle(page, 1500);
    },
    target: (page) => ({
      async screenshot(opts) {
        const box = await page.locator('#map').boundingBox();
        const c = await page.evaluate(() => window.ko.dataFor(document.body).mapVM.map.latLngToContainerPoint(window.__shotMarker.getLatLng()));
        return page.screenshot({ ...opts, clip: { x: box.x + c.x - 200, y: box.y + c.y - 440, width: 490, height: 690 } });
      },
    }),
  },

  // New Radio Log opened from a tasking: Radio tag selected, incident and
  // team filled, current status + "update to" in the footer.
  'radio-log-dialog': {
    launch: { viewport: { width: 1400, height: 1000 } },
    run: openTaskingRadioLog,
    target: (page) => page.locator('#CreateOpsLogModal .modal-content'),
  },

  // ...with On site picked: the status change details and the footer.
  'radio-log-status-change': {
    launch: { viewport: { width: 1400, height: 1000 } },
    run: async (page) => {
      await openTaskingRadioLog(page);
      await page.locator('#CreateOpsLogModal .modal-footer .dropup .dropdown-toggle').click();
      await page.locator('#CreateOpsLogModal .modal-footer .dropdown-item:has-text("On site")').click();
      await page.locator('#CreateOpsLogModal .ops-log-status-details button:has-text("+30")').click();
      // don't capture the +30 button in its hover/focus state
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement?.blur());
      await settle(page, 800);
    },
    target: (page) => unionOf(page, '#CreateOpsLogModal .ops-log-status-details, #CreateOpsLogModal .modal-footer', 0),
  },

  // Blank New Radio Log pointed at a team that isn't tasked to the incident
  // (DEM02 on 2610-1207): the Task Team / Task Team & SMS choice in the footer.
  'radio-log-task-team': {
    launch: { viewport: { width: 1400, height: 1000 } },
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.locator('#paneTop button[title="Radio Log"]:visible').first().click();
      await page.locator('#CreateOpsLogModal').waitFor({ state: 'visible' });
      await settle(page, 600); // the dialog focuses Text once shown
      await page.locator('#CreateOpsLogModal input[placeholder^="Search by incident"]').fill('2610-1207');
      await page.locator('#CreateOpsLogModal ul[data-ops-log-dropdown="job"] button').first().dispatchEvent('mousedown');
      await page.locator('#CreateOpsLogModal input[placeholder^="Search by team"]').fill('DEM02');
      await page.locator('#OpsLogTextInput').fill('DEM02 available, tasking to this incident.');
      await page.locator('#CreateOpsLogModal .modal-footer button:has-text("Task Team & SMS")').click();
      await page.mouse.move(0, 0);
      await settle(page, 600);
    },
    target: (page) => page.locator('#CreateOpsLogModal .modal-footer'),
  },

  // The Layers panel: search, basemap picker and every overlay group.
  overlays: {
    launch: { viewport: { width: 1800, height: 1200 } },
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.locator('.ld-toggle-btn').click();
      await settle(page, 600);
    },
    target: (page) => page.locator('.ld-panel'),
  },

  // Overlay layers that drop clickable markers on the map, each labelled:
  // a Transport NSW incident, council report and camera, a HazardWatch warning (area +
  // icon) and an SES unit HQ (unit locations ship with the extension; the
  // rest is fake). Incidents and assets are hidden.
  'overlay-markers': {
    launch: { viewport: { width: 1800, height: 1000 }, scale: 2 },
    run: async (page) => {
      await showOverlays(page, ['transport-incidents', 'transport-cameras', 'hazardwatch-warnings', 'sesUnitLocations'], { centre: [0, 850] });
      await page.evaluate(({ feeds, hw }) => {
        const mv = window.ko.dataFor(document.body).mapVM; const map = mv.map;
        const labels = [];
        // The incidents layer draws the incident feed, then the council reports feed.
        const layerRows = {
          'transport-incidents': [...feeds['transport-incidents'], ...feeds['transport-local-reports']],
          'transport-cameras': feeds['transport-cameras'],
        };
        for (const [key, rows] of Object.entries(layerRows)) {
          let i = 0;
          mv.onlineLayers.get(key).layerGroup.eachLayer((m) => labels.push([m, rows[i++]?.label]));
        }
        const markersOf = (key) => { const out = []; const walk = (g) => g.eachLayer((l) => (l.getLatLng && l.options.icon ? out.push(l) : l.eachLayer && walk(l))); walk(mv.onlineLayers.get(key).layerGroup); return out; };
        markersOf('hazardwatch-warnings').forEach((m) => labels.push([m, hw.label]));
        // The unit HQ marker nearest the view centre.
        const hq = markersOf('sesUnitLocations').sort((a, b) => map.distance(a.getLatLng(), window.__shotCentre) - map.distance(b.getLatLng(), window.__shotCentre))[0];
        labels.push([hq, 'SES unit HQ']);
        labels.forEach(([m, text]) => text && m.bindTooltip(text, { permanent: true, direction: 'right', offset: [12, 0], className: 'shot-callout' }).openTooltip());
        const style = document.createElement('style');
        style.textContent = '.shot-callout{font-size:13px;font-weight:600;padding:3px 8px;border:2px solid #1f6feb;color:#1f2328}.shot-callout.leaflet-tooltip-right:before{border-right-color:#1f6feb}';
        document.head.appendChild(style);
      }, { feeds: Object.fromEntries(Object.entries(OVERLAY_FEEDS).map(([k, rows]) => [k, rows.map((r) => ({ label: r.label }))])), hw: { label: HAZARDWATCH_FEED.label } });
      await settle(page, 800);
    },
    target: (page) => mapCrop(page, 640, 580, [60, 0]),
  },

  // The popup from clicking an overlay marker (the traffic incident).
  'overlay-marker-popup': {
    launch: { viewport: { width: 1800, height: 1000 } },
    run: async (page) => {
      await showOverlays(page, ['transport-incidents'], { centre: [450, 1250], zoom: 16 });
      await page.evaluate(() => {
        window.ko.dataFor(document.body).mapVM.onlineLayers.get('transport-incidents').layerGroup.getLayers()[0].openPopup(); // the traffic incident, not the council report
      });
      await settle(page, 1000);
    },
    target: (page) => mapCrop(page, 380, 320, [0, -110]),
  },

  spotlight: {
    run: async (page) => {
      await openSpotlight(page, 'DEM0');
    },
  },

  // Command shots crop to the search box, command bar and results (or the dialog it opens).
  'spotlight-msg': {
    run: async (page) => {
      await openSpotlight(page, 'msg dem02');
    },
    target: spotlightBox,
  },

  'spotlight-calloff': {
    run: async (page) => {
      await openSpotlight(page, 'calloff dem02');
      await page.locator('#spotlightResults button').first().click(); // the team's tasked incident
      await settle(page, 600);
    },
    target: spotlightBox,
  },

  'spotlight-calloff-dialog': {
    run: async (page) => {
      await openSpotlight(page, 'calloff dem02');
      await page.locator('#spotlightResults button').first().click();
      await settle(page, 600);
      await page.locator('#spotlightSearchInput').press('Enter');
      await settle(page, 800);
      await page.keyboard.type('Resident has arranged a private contractor');
      await settle(page, 300);
    },
    target: (page) => page.locator('#CallOffModal .modal-content'),
  },

  'spotlight-help': {
    run: async (page) => {
      await openSpotlight(page, '?');
      await settle(page, 400);
    },
    target: (page) => page.locator('#SpotlightHelpModal .modal-content'),
  },
};

const outDir = path.resolve(ROOT, arg('out', 'build/lad-screenshots'));
const only = arg('only', '')?.split(',').filter(Boolean);
const verbose = process.argv.includes('--verbose');
const names = only.length ? only : Object.keys(SHOTS);
const unknown = names.filter((n) => !SHOTS[n]);
if (unknown.length) {
  console.error(`Unknown shot(s): ${unknown.join(', ')}\nAvailable: ${Object.keys(SHOTS).join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const name of names) {
  const shot = SHOTS[name];
  const { browser, page } = await launchLad({ now: NOW, verbose, ...(shot.launch || {}) });
  try {
    await settle(page, 800);
    await shot.run(page);
    const file = path.join(outDir, `${name}.png`);
    const target = shot.target ? shot.target(page) : page;
    await target.screenshot({ path: file, animations: 'disabled' });
    console.log(`✓ ${path.relative(ROOT, file)}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}: ${err.message.split('\n')[0]}`);
  } finally {
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
