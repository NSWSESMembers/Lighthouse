/*
  Open Team Summary in a visible Chrome window against the fake demo
  data, for clicking around / manual screenshots. Close the window (or
  Ctrl+C) to exit.

    npm run dev && npm run teamsummary:demo
    npm run teamsummary:demo -- --verbose     # log mock traffic and page errors
    npm run teamsummary:demo -- --dark        # dark colour scheme
*/

import { launchTeamSummary } from './launch.mjs';

const { browser } = await launchTeamSummary({
  headless: false,
  launch: 'today',
  viewport: { width: 1600, height: 900 },
  verbose: process.argv.includes('--verbose'),
  dark: process.argv.includes('--dark'),
});
console.log('Team Summary demo running with fake data -- close the browser window to exit.');
await new Promise((resolve) => browser.on('disconnected', resolve));
