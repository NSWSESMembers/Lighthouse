/*
  Open NITC Export in a visible Chrome window against the fake demo data,
  for clicking around / manual screenshots. Close the window (or Ctrl+C) to
  exit.

    npm run dev && npm run nitcexport:demo
    npm run nitcexport:demo -- --verbose     # log mock traffic and page errors
    npm run nitcexport:demo -- --dark        # dark colour scheme
*/

import { launchNitc } from './launch.mjs';

const { browser } = await launchNitc({
  headless: false,
  viewport: { width: 1440, height: 900 },
  verbose: process.argv.includes('--verbose'),
  dark: process.argv.includes('--dark'),
  pageDelayMs: 150,
});
console.log('NITC Export demo running with fake data -- close the browser window to exit.');
await new Promise((resolve) => browser.on('disconnected', resolve));
