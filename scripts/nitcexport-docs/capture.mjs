/*
  Capture NITC Export screenshots headlessly against the fake demo data.

    npm run dev && npm run nitcexport:shots
    npm run nitcexport:shots -- --out docs/nitc/images         # write straight into the guide
    npm run nitcexport:shots -- --only overview,dark           # just some shots
    npm run nitcexport:shots -- --verbose                      # log mock traffic and page errors

  Each shot starts from a fresh page. The clock is pinned so the data and
  times are the same on every run.

  Add a shot: add to SHOTS below. `run(page)` drives the page into the state
  to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the viewport is captured.
*/

import { launchNitc, waitForNitc } from './launch.mjs';
import { arg } from '../page-docs/launchPage.mjs';
import { runShots } from '../page-docs/runners.mjs';

// Pinned "now": a Thursday afternoon in Sydney.
const NOW = arg('now', '2026-10-15T15:30:00+11:00');
const verbose = process.argv.includes('--verbose');
const WIDE = { width: 1440, height: 1000 };
const MEMBER = { 'lh-nitcexport-report': 'member' };

const SHOTS = {
  overview: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('body'),
  },
  dark: {
    launch: { viewport: WIDE, dark: true },
  },
  report: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('#nitc-report'),
  },
  activity: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('.nitc-preview'),
  },
  member: {
    launch: { viewport: WIDE, storage: MEMBER },
    target: (page) => page.locator('.nitc-preview'),
  },
  // Download CSV: fetching every task.
  download: {
    launch: { viewport: WIDE, pageDelayMs: 2500 },
    run: async (page) => {
      await waitForNitc(page);
      await page.locator('#download').click();
      await page.waitForFunction(() => window.nitcExportVM.dlLoaded() >= 100);
      await page.waitForTimeout(500);
    },
    target: (page) => page.locator('#download-progress .card'),
  },
  'header-train': {
    launch: { viewport: WIDE, env: 'trainbeacon', filters: { TagIds: '701,702' } },
    target: (page) => page.locator('.lh-page-header'),
  },
  loading: {
    launch: { viewport: { width: 900, height: 600 }, pageDelayMs: 60000 },
    run: async (page) => {
      await page.locator('#nitc-loading .loader-ring').waitFor();
      await page.waitForTimeout(2200);
    },
    target: (page) => page.locator('#nitc-loading .card'),
  },
};

for (const shot of Object.values(SHOTS)) shot.run = shot.run || waitForNitc;

await runShots({
  shots: SHOTS,
  defaultOut: 'build/nitcexport-screenshots',
  launch: (extra) => launchNitc({ now: NOW, verbose, ...extra }),
});
