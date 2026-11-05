/*
  Open Incident Summary in a visible Chrome window against the fake demo
  data, for clicking around / manual screenshots. Close the window (or
  Ctrl+C) to exit.

    npm run dev && npm run summary:demo
    npm run summary:demo -- --verbose     # log mock traffic and page errors
    npm run summary:demo -- --dark        # dark colour scheme
*/

import { launchSummary } from './launch.mjs';

const { browser } = await launchSummary({
  headless: false,
  launch: 'today',
  viewport: { width: 1600, height: 900 },
  verbose: process.argv.includes('--verbose'),
  dark: process.argv.includes('--dark'),
});
console.log('Incident Summary demo running with fake data -- close the browser window to exit.');
await new Promise((resolve) => browser.on('disconnected', resolve));
