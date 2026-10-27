# Lighthouse — notes for Claude

Chrome extension for NSW SES Beacon. Most active work is the LAD (tasking)
page in `src/pages/tasking/`; the Incident Statistics page (`stats.html`) is
`src/pages/stats/`, the Incident Summary page (`summary.html`) is
`src/pages/summary/` and the Incident Export page (`advexport.html`) is
`src/pages/advexport/`, all built the same way (Bootstrap 5,
knockout-secure-binding, BeaconClient), with code shared between them in
`src/pages/shared/` (params, page setup, load ring) and
`styles/pages/include/lighthouse-page.css`; shared Beacon API code is in
`src/shared/BeaconClient/`; AWS Lambda backends are in `lambda/`.

## Branches and PRs

- `master-dev` is the integration branch. Branch from `origin/master-dev` and
  open PRs into it; `master` is release-only and lags behind.
- PRs go to `NSWSESMembers/Lighthouse` (`gh pr create --repo NSWSESMembers/Lighthouse --base master-dev`).

## Commands

```sh
npm run dev       # webpack dev build -> dist/
npm run lint      # eslint, zero warnings allowed
npm test          # vitest (*.test.js next to the source)
```

## Running LAD without Beacon: `scripts/lad-docs`

A Playwright harness runs the built tasking page in the installed Google
Chrome against a mock Beacon with entirely fake data. No login or token
needed. Use it to reproduce bugs, check UI changes, and take screenshots.
Full details in `scripts/lad-docs/README.md`.

```sh
npm run dev                                         # required first: serves dist/pages/tasking.html
npm run lad:demo                                    # headed Chrome window
npm run lad:shots -- --only main --out <dir>        # headless screenshots (shot list in capture.mjs)
```

For ad-hoc scripted checks, write a throwaway `.mjs` that imports from
`scripts/lad-docs/launch.mjs` (adjust the path to where your script lives):

```js
import { launchLad, closeConfigAndLoad, settle } from './scripts/lad-docs/launch.mjs';
const { browser, page, scenario } = await launchLad({ now: '2026-10-15T10:00:00', verbose: true });
await settle(page, 800); // let the config modal render, or it won't close
await closeConfigAndLoad(page);
// `ko` is global in the page; ko.dataFor(row) gives the bound model, e.g. a Job for tr.job-row
await browser.close();
```

`launchLad` options: `headless`, `viewport`, `now`, `config` (pre-seeded
`lh-taskingConfig`), `remoteTab`, `verbose`, `scale`.

## Running Incident Statistics without Beacon: `scripts/stats-docs`

Same idea for `stats.html` (fake data in `scripts/stats-docs/scenario.mjs`).
`stats:check` is an end-to-end check run in Chrome (filtering, ranges,
refresh, errors); run it after changing the page. Details in
`scripts/stats-docs/README.md`.

```sh
npm run dev && npm run stats:check                 # end-to-end checks
npm run stats:demo                                 # headed Chrome window
npm run stats:shots -- --out docs/stats/images     # guide screenshots
```

The stats page imports dc.js from `dc/src/index.js` with its own d3 7
compat layer (`charts/dcD3Compat.js`): dc's dist bundle crashes on d3 7.

## Running Incident Summary without Beacon: `scripts/summary-docs`

Same idea for `summary.html` (fake data in `scripts/summary-docs/scenario.mjs`).
These harnesses are built on the shared page harness in `scripts/page-docs/`.
`summary:check` is an end-to-end check in Chrome; run it after changing the
page. Details in `scripts/summary-docs/README.md`.

```sh
npm run dev && npm run summary:check                    # end-to-end checks
npm run summary:demo                                    # headed Chrome window
npm run summary:shots -- --out docs/summary/images      # guide screenshots
```

## Running Incident Export without Beacon: `scripts/advexport-docs`

Same idea for `advexport.html` (incidents reuse `scripts/stats-docs/scenario.mjs`,
plus fake callers and ICEMS Ops Logs in `scripts/advexport-docs/scenario.mjs`).
`advexport:check` is an end-to-end check in Chrome, including the downloaded
CSV; run it after changing the page. Details in `scripts/advexport-docs/README.md`.

```sh
npm run dev && npm run advexport:check                  # end-to-end checks
npm run advexport:demo                                  # headed Chrome window
npm run advexport:shots -- --out docs/export/images     # guide screenshots
```

### Fixture data rules

`scenario.mjs` copies the _structure_ of real Beacon responses, but every
value (names, callsigns, ids, phones, addresses, plates) is invented. Never
copy values from `build/lad-samples/` (real payloads from
`npm run lad:samples`) into committed files, and never commit that folder.

## Gotchas

- **knockout-secure-binding.** `data-bind` attributes use a restricted parser:
  expressions, `!`, `&&`, comparisons and zero-arg calls are fine, but inline
  `function(d, e) {...}` with parameters, or any statement (`if`, etc.) in an
  inline function body, throws. Put the logic in a named view-model method and
  bind to it directly (`click: someMethod`).
- **Deferred KO updates.** The tasking page sets `ko.options.deferUpdates = true`,
  so subscribers run on a microtask, not when the observable is written. If a
  side effect has to happen in the same tick (e.g. a Leaflet layer being
  re-added before zooming to it), call `ko.tasks.runEarly()` first.
- **`credentials: 'omit'` in BeaconClient `request()`.** It's the default in
  `src/shared/BeaconClient/core/request.js`. Without it, extension pages send
  the user's Beacon cookies and Beacon returns 401 despite a valid bearer
  token. Keep it, and use it on any new direct `fetch` to Beacon.

## User-facing docs

The LAD user guide (`docs/lad/`), the Incident Statistics guide
(`docs/stats/`), the Incident Summary guide (`docs/summary/`), the Incident
Export guide (`docs/export/`) and What's New
(`docs/whats-new/index.md`) are synced to the website: `master` publishes the stable copy, `master-dev`
the Development Preview. For user-visible changes,
update the matching guide page and add a What's New entry in the same PR. Use
`npm run lad:shots` / `npm run stats:shots` / `npm run summary:shots` /
`npm run advexport:shots` for guide screenshots.
