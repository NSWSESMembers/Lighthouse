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

/** Open the Trackable Asset Library from the config modal's rail link (saves + loads, then opens it). */
async function openAssetLibrary(page) {
  await page.locator('#configModal button:has-text("Trackable Asset Library")').click();
  await page.locator('#trackableAssetsModal').waitFor({ state: 'visible' });
  await settle(page, 1500);
}

/** A library card by its asset name. */
const libraryCard = (page, name) =>
  page.locator('#trackableAssetsModal .card').filter({ has: page.locator('.fs-4', { hasText: new RegExp(`^${name}$`) }) });

const SHOTS = {
  'config-data': configTab('data'),
  'config-incident-filters': configTab('filters'),
  'config-map-markers': configTab('map'),
  'config-collab-layers': configTab('collab'),
  'config-layout': configTab('sidebar'),
  'config-starred': configTab('starred'),
  'config-appearance': configTab('appearance'),
  'config-instant-task': configTab('suggest'),

  main: { run: closeConfigAndLoad },

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
    run: async (page) => {
      await closeConfigAndLoad(page);
      // Expand a tasked incident so the tasking timeline is visible.
      await page.locator('tr.job-row:has-text("Tasked")').first().locator('[data-bind*="toggleAndExpand"]').first().click();
      await settle(page, 800);
    },
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
      await page.locator('#trackableAssetsModal select[aria-label="Filter by satellite tracking"]').selectOption({ label: 'Satellite tracked only' });
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

  spotlight: {
    run: async (page) => {
      await closeConfigAndLoad(page);
      await page.keyboard.press('Control+k');
      await page.locator('#SpotlightSearchModal input').first().fill('DEM0');
      await settle(page, 600);
    },
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
