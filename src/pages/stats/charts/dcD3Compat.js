/*
  dc.js 4 talks to d3 through a compatibility layer (d3compat). Its
  prebuilt dist/dc.js and its src/compat modules pick the layer by reading
  `d3.version`, which d3 7 no longer exports: the dist bundle throws on
  load, and the compat module installs nothing (dc then warns on every
  event and throws on pointer/nester).

  So the stats page imports dc's ES source (dc/src/index.js) and installs
  the d3@6+ layer itself -- dc's src/compat/d3v6.js minus the version
  check. Import this before building any chart.
*/

import { d3compat } from 'dc/src/index.js';
import { pointer, groups } from 'd3';

Object.assign(d3compat, {
  eventHandler: (handler) => function eventHandler(event, d) {
    handler.call(this, d, event);
  },
  // manual firing of event, usu for tests
  callHandler: function callHandler(handler, that, event, d) {
    handler.call(that, event, d);
  },
  nester: ({ key, sortKeys, sortValues, entries }) => {
    if (sortValues) {
      entries = [...entries].sort(sortValues);
    }
    let out = groups(entries, key);
    if (sortKeys) {
      out = out.sort(sortKeys);
    }
    // remap to d3@v5 structure
    return out.map((e) => ({ key: `${e[0]}`, values: e[1] }));
  },
  pointer,
});
