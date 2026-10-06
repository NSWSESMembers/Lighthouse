/*
  Open LAD in a visible Chrome window against the fake demo data, for
  clicking around / manual screenshots. Close the window (or Ctrl+C) to exit.

    npm run dev && npm run lad:demo
    npm run lad:demo -- --verbose     # log mock traffic and page errors
*/

import { launchLad } from './launch.mjs';

const { browser } = await launchLad({ headless: false, verbose: process.argv.includes('--verbose') });
console.log('LAD demo running with fake data -- close the browser window to exit.');
await new Promise((resolve) => browser.on('disconnected', resolve));
