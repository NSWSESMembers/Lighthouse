/*
  Capture Incident Summary screenshots headlessly against the fake demo data.

    npm run dev && npm run summary:shots
    npm run summary:shots -- --out docs/summary/images     # write straight into the guide
    npm run summary:shots -- --only overview,dark          # just some shots
    npm run summary:shots -- --verbose                     # log mock traffic and page errors

  Each shot starts from a fresh page. The clock is pinned so the data and
  times are the same on every run.

  Add a shot: add to SHOTS below. `run(page)` drives the page into the state
  to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the viewport is captured.
*/

import { launchSummary, waitForSummary, settle } from './launch.mjs';
import { arg } from '../page-docs/launchPage.mjs';
import { runShots } from '../page-docs/runners.mjs';

// Pinned "now": a Thursday afternoon in Sydney.
const NOW = arg('now', '2026-10-15T15:30:00+11:00');
const verbose = process.argv.includes('--verbose');
const WALL = { width: 1600, height: 900 };

const SHOTS = {
  overview: {
    launch: { viewport: WALL },
  },
  dark: {
    launch: { viewport: WALL, dark: true },
  },
  'title-train': {
    launch: { viewport: WALL, env: 'trainbeacon' },
    target: (page) => page.locator('.title-box').locator('xpath=..'),
  },
  footer: {
    launch: { viewport: WALL },
    target: (page) => page.locator('.summary-footer'),
  },
  // New incidents have just come in: the New cell is highlighted.
  'new-incidents': {
    launch: { viewport: WALL },
    run: async (page, { scenario }) => {
      await waitForSummary(page);
      scenario.addNew(2);
      await page.locator('.footer-refresh button').click();
      await page.locator('#tile-new.is-new').waitFor();
      await settle(page, 600);
    },
    target: (page) => page.locator('.lh-box', { hasText: 'Incident Status' }),
  },
  settings: {
    launch: { viewport: WALL },
    run: async (page) => {
      await waitForSummary(page);
      await page.locator('#settings-button').click();
      await page.locator('#settings-modal.show').waitFor();
      await settle(page, 500);
    },
    target: (page) => page.locator('#settings-modal .modal-content'),
  },
  loading: {
    launch: { viewport: { width: 900, height: 600 }, summaryDelayMs: 60000 },
    run: async (page) => {
      await page.locator('#summary-loading .loader-ring').waitFor();
      await page.waitForTimeout(3200);
    },
    target: (page) => page.locator('#summary-loading .card'),
  },
};

for (const shot of Object.values(SHOTS)) shot.run = shot.run || waitForSummary;

await runShots({
  shots: SHOTS,
  defaultOut: 'build/summary-screenshots',
  launch: (extra) => launchSummary({ now: NOW, launch: 'today', verbose, ...extra }),
});
