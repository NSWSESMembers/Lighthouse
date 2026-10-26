/*
  Capture Incident Statistics screenshots headlessly against the fake demo data.

    npm run dev && npm run stats:shots
    npm run stats:shots -- --out docs/stats/images      # write straight into the guide
    npm run stats:shots -- --only overview,filtered     # just some shots
    npm run stats:shots -- --verbose                    # log mock traffic and page errors

  Each shot starts from a fresh page. The clock is pinned so the data and
  times are the same on every run.

  Add a shot: append to SHOTS below. `run(page)` drives the page into the
  state to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the viewport is captured.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchStats, waitForStats, settle } from './launch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// Pinned "now": a Thursday afternoon in Sydney.
const NOW = arg('now', '2026-10-15T15:30:00+11:00');

const section = (page, heading) => page.locator('section', { has: page.locator('h2', { hasText: heading }) });
const card = (page, title) => page.locator('.chart-card', { has: page.locator('.card-header', { hasText: title }) });

/** Select a breakdown pie's nth legend entry (the slice itself can sit under its neighbour's centre). */
async function clickSlice(page, title, index = 0) {
  await card(page, title).locator('.pie-legend-row').nth(index).click();
  await settle(page, 700);
}

/** Drag across a bar chart from one fraction of its plot width to another. */
async function brush(page, chartId, from, to) {
  const plot = page.locator(`#${chartId} g.chart-body`);
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
  await page.mouse.up();
  await settle(page, 700);
}

const SHOTS = {
  overview: {
    run: waitForStats,
  },
  toolbar: {
    run: waitForStats,
    // Header and toolbar together: from the top of the page to the toolbar's bottom edge.
    target: (page) => ({
      async screenshot(opts) {
        const box = await page.locator('.stats-toolbar').boundingBox();
        const width = page.viewportSize().width;
        return page.screenshot({ ...opts, clip: { x: 0, y: 0, width, height: box.y + box.height } });
      },
    }),
  },
  breakdowns: {
    launch: { viewport: { width: 1440, height: 1800 } },
    run: waitForStats,
    target: (page) => section(page, 'Breakdown'),
  },
  filtered: {
    run: async (page) => {
      await waitForStats(page);
      await clickSlice(page, 'Incident Type', 0);
      await page.mouse.move(0, 0);
      await settle(page, 400);
    },
  },
  'completion-times': {
    run: waitForStats,
    target: (page) => section(page, 'Completion times'),
  },
  'over-time': {
    run: async (page) => {
      await waitForStats(page);
      await brush(page, 'chart-received', 0.6, 0.85);
    },
    target: (page) => section(page, 'Over time'),
  },
  'latest-incidents': {
    run: waitForStats,
    target: (page) => section(page, 'Latest incidents'),
  },
  'word-cloud': {
    run: waitForStats,
    target: (page) => section(page, 'Situation on scene'),
  },
  dark: {
    launch: { dark: true },
    run: waitForStats,
  },
  // The first-load ring part way through a big load (numbers set directly).
  loading: {
    launch: { firstPageDelayMs: 60000 },
    run: async (page) => {
      // The page's own load must have started, or it resets what we set.
      await page.waitForFunction(() => window.statsVM && window.statsVM.token() && window.statsVM.loadPhase() === 'starting');
      await page.evaluate(async () => {
        const vm = window.statsVM;
        vm.firstPageAt(Date.now() - 91 * 400);
        vm.lastPageAt(Date.now());
        vm.loadTotal(20316);
        vm.loadLoaded(9200);
        vm.loadPhase('incidents');
        await new Promise((r) => setTimeout(r, 600));
      });
    },
    target: (page) => page.locator('#stats-loading .card'),
  },
  'toolbar-train': {
    launch: { env: 'trainbeacon' },
    run: waitForStats,
    target: (page) => SHOTS.toolbar.target(page),
  },
};

const outDir = path.resolve(ROOT, arg('out', 'build/stats-screenshots'));
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
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose, ...(shot.launch || {}) });
  try {
    await shot.run(page);
    // The sticky toolbar would cover the top of a cropped section.
    await page.addStyleTag({ content: '.stats-toolbar { position: static !important; }' });
    if (pageErrors.length) throw new Error(`page error: ${pageErrors[0]}`);
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
