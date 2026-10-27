/*
  Capture Incident Export screenshots headlessly against the fake demo data.

    npm run dev && npm run advexport:shots
    npm run advexport:shots -- --out docs/advexport/images     # write straight into the guide
    npm run advexport:shots -- --only overview,dark            # just some shots
    npm run advexport:shots -- --verbose                       # log mock traffic and page errors

  Each shot starts from a fresh page. The clock is pinned so the data and
  times are the same on every run.

  Add a shot: add to SHOTS below. `run(page)` drives the page into the state
  to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the viewport is captured.
*/

import { launchExport, waitForExport } from './launch.mjs';
import { arg } from '../page-docs/launchPage.mjs';
import { runShots } from '../page-docs/runners.mjs';

// Pinned "now": a Thursday afternoon in Sydney.
const NOW = arg('now', '2026-10-15T15:30:00+11:00');
const verbose = process.argv.includes('--verbose');
const WIDE = { width: 1440, height: 1000 };

const SHOTS = {
  overview: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('body'),
  },
  dark: {
    launch: { viewport: WIDE, dark: true },
  },
  columns: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('#export-fields'),
  },
  preview: {
    launch: { viewport: WIDE },
    target: (page) => page.locator('.export-preview'),
  },
  // The ICEMS column ticked: counting the Ops Logs.
  icems: {
    launch: { viewport: WIDE, opsLogDelayMs: 600 },
    run: async (page) => {
      await waitForExport(page);
      await page.locator('.export-field:has(input[value="ICEMSIUMTransactions"])').click();
      await page.locator('.icems-progress').waitFor();
      await page.waitForTimeout(1300);
    },
    target: (page) => page.locator('.export-actions').locator('xpath=..'),
  },
  'header-train': {
    launch: { viewport: WIDE, env: 'trainbeacon' },
    target: (page) => page.locator('.lh-page-header'),
  },
  loading: {
    launch: { viewport: { width: 900, height: 600 }, pageDelayMs: 2500 },
    run: async (page) => {
      await page.locator('#export-loading .loader-ring').waitFor();
      await page.waitForFunction(() => window.exportVM.loadLoaded() >= 100);
      await page.waitForTimeout(500); // not settle(): that waits for the load to finish
    },
    target: (page) => page.locator('#export-loading .card'),
  },
};

for (const shot of Object.values(SHOTS)) shot.run = shot.run || waitForExport;

await runShots({
  shots: SHOTS,
  defaultOut: 'build/advexport-screenshots',
  launch: (extra) => launchExport({ now: NOW, verbose, ...extra }),
});
