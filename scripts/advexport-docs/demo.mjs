/*
  Open Incident Export in a visible Chrome window against the fake demo
  data, for clicking around / manual screenshots. Close the window (or
  Ctrl+C) to exit.

    npm run dev && npm run advexport:demo
    npm run advexport:demo -- --verbose     # log mock traffic and page errors
    npm run advexport:demo -- --dark        # dark colour scheme
*/

import { launchExport } from './launch.mjs';

const { browser } = await launchExport({
  headless: false,
  viewport: { width: 1440, height: 900 },
  verbose: process.argv.includes('--verbose'),
  dark: process.argv.includes('--dark'),
  opsLogDelayMs: 150,
});
console.log('Incident Export demo running with fake data -- close the browser window to exit.');
await new Promise((resolve) => browser.on('disconnected', resolve));
