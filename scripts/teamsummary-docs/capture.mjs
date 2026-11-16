/*
  Capture Team Summary screenshots headlessly against the fake demo data.

    npm run dev && npm run teamsummary:shots
    npm run teamsummary:shots -- --out docs/teams/images     # write straight into the guide
    npm run teamsummary:shots -- --only overview,dark        # just some shots
    npm run teamsummary:shots -- --verbose                   # log mock traffic and page errors

  Each shot starts from a fresh page. The clock is pinned so the data and
  times are the same on every run.

  Add a shot: add to SHOTS below. `run(page)` drives the page into the state
  to capture; `target(page)` (optional) returns a locator to crop to,
  otherwise the viewport is captured.
*/

import { launchTeamSummary, waitForTeams, settle } from './launch.mjs';
import { arg } from '../page-docs/launchPage.mjs';
import { runShots } from '../page-docs/runners.mjs';

// Pinned "now": a Sunday afternoon in Sydney.
const NOW = arg('now', '2026-11-15T15:30:00+11:00');
const verbose = process.argv.includes('--verbose');
const WALL = { width: 1600, height: 1000 };

const SHOTS = {
  overview: {
    launch: { viewport: WALL },
  },
  dark: {
    launch: { viewport: WALL, dark: true },
  },
  card: {
    launch: { viewport: WALL },
    target: (page) => page.locator('#team-80000'),
  },
  'header-train': {
    launch: { viewport: WALL, env: 'trainbeacon' },
    target: (page) => page.locator('.ts-header'),
  },
  incident: {
    launch: { viewport: WALL },
    run: async (page) => {
      await waitForTeams(page);
      await page.locator('#team-80000 .history-incident').first().click();
      await page.locator('.incident-popover .incident-number').waitFor();
      await settle(page, 500);
    },
    target: (page) => page.locator('.incident-popover'),
  },
  // The Team Filter, as it opens when the page loads.
  teams: {
    launch: { viewport: WALL },
    run: async (page) => {
      await waitForTeams(page, { keepDialog: true });
      await page.locator('#teams-modal.show').waitFor();
      await settle(page, 500);
    },
    target: (page) => page.locator('#teams-modal .modal-content'),
  },
  settings: {
    launch: { viewport: WALL },
    run: async (page) => {
      await waitForTeams(page);
      await page.locator('#settings-button').click();
      await page.locator('#settings-modal.show').waitFor();
      await settle(page, 500);
    },
    target: (page) => page.locator('#settings-modal .modal-content'),
  },
  footer: {
    launch: { viewport: WALL },
    target: (page) => page.locator('.ts-footer'),
  },
  loading: {
    launch: { viewport: { width: 900, height: 600 }, searchDelayMs: 60000 },
    run: async (page) => {
      await page.locator('#teams-loading .loader-ring').waitFor();
      await page.waitForTimeout(3200);
    },
    target: (page) => page.locator('#teams-loading .card'),
  },
};

for (const shot of Object.values(SHOTS)) shot.run = shot.run || waitForTeams;

await runShots({
  shots: SHOTS,
  defaultOut: 'build/teamsummary-screenshots',
  launch: (extra) => launchTeamSummary({ now: NOW, launch: 'today', verbose, ...extra }),
});
