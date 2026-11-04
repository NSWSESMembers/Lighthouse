# LAD docs harness

Runs the built LAD (tasking) page outside the extension, in your installed
Google Chrome, against a mock Beacon serving **entirely fake data**. Use it to
click around without a Beacon login, or to regenerate the user guide's
screenshots automatically.

```sh
npm run dev                 # build dist/ first (the harness serves dist/pages/tasking.html)
npm run lad:demo            # visible Chrome window with the demo data
npm run lad:shots           # headless screenshots -> build/lad-screenshots/
npm run lad:shots -- --only main,team-expanded --out docs/lad/images
npm run lad:bench           # performance benchmark, 1000 fake incidents, median of 5 runs
```

Requires Google Chrome installed; `playwright-core` drives it (no browser download).

## On a real device (iPad, phone): `lad:serve`

```sh
npm run dev && npm run lad:serve      # prints http://<this-mac's-LAN-ip>:4123/ -- open it on the device
npm start                              # optional, other terminal: rebuild on save, then reload the device
```

A plain HTTP server on the LAN (same Wi-Fi; allow `node` through the macOS
firewall when asked). It serves `dist/` with the same `chrome.*` stub as
`launch.mjs`, plus a fetch/XHR shim that sends every cross-origin request
through the server to `mockBeacon.mjs`, so the device sees the same fake data.
Each page load rebuilds the scenario.

- The page loads [eruda](https://github.com/liriliri/eruda), an on-page
  devtools console, since a tablet browser has none (`--no-eruda` to drop it).
  For full devtools on iPadOS use Safari: iPad Settings › Safari › Advanced ›
  Web Inspector, then Mac Safari › Develop › the iPad. Other iPad browsers
  (Orion, Chrome) use the same WebKit engine, so layout bugs reproduce in Safari.
- `?trace=1` on the URL logs every tap (pointer/touch/mouse/click events) and
  map popup open/close, with a stack for each close, to the console.
- `--host 127.0.0.1` keeps it off the LAN, `--port` changes the port.

Touch-only behaviour can be checked headlessly in Playwright's WebKit
(`npx playwright-core install webkit`, then `webkit.launch()` with
`hasTouch: true` and `page.touchscreen.tap()`), but it doesn't reproduce iOS
keyboard or tap timing, so finish on the device.

| File | What it does |
| --- | --- |
| `scenario.mjs` | The fake world: one HQ ("Demo City"), teams, incidents, taskings, radio/telematics positions. |
| `mockBeacon.mjs` | Answers Beacon + Lighthouse-lambda requests from the scenario. Other traffic (map tiles, BOM, transport) goes to the real internet. Unhandled Beacon endpoints are logged with `--verbose`. |
| `launch.mjs` | Stubs `chrome.*`, a fake bearer token and the extension's URL params; serves `dist/` from a fake origin. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |
| `serve.mjs` | LAN server for real devices (`npm run lad:serve`, see above). |
| `bench.mjs` | Performance benchmark: load, cluster zoom, status changes and DOM size with `--jobs N` fake incidents (see below). |
| `fetch-samples.mjs` | Pulls real Beacon payloads into `build/lad-samples/` (gitignored) so `scenario.mjs` can be checked against the real API structure. |

## Benchmarking

`launchLad({ jobCount })` (and `buildScenario(now, { jobCount })`) scales the
incident list up past the 14 hand-written ones: the same incidents repeated and
scattered up to ~15 km around Demo City, the same every run. `bench.mjs` uses
it to time the page's hot paths:

```sh
npm run lad:bench -- --jobs 1000 --runs 5            # this checkout's dist/
npm run lad:bench -- --cpu 4                          # with 4× CPU throttling
```

To compare a change with its base, check the base out in a worktree, copy this
folder into it (so it has `bench.mjs` and `jobCount`), symlink `node_modules`,
build it, and run the bench with `--root <worktree>`:

```sh
git worktree add --detach ../lh-base origin/master-dev
ln -s "$PWD/node_modules" ../lh-base/node_modules
cp scripts/lad-docs/*.mjs ../lh-base/scripts/lad-docs/
(cd ../lh-base && npx webpack --config webpack.dev.js)
npm run lad:bench -- --root ../lh-base && npm run lad:bench
git worktree remove --force ../lh-base
```

Let the page settle before measuring a phase (the bench waits 2.5 s after
load); measuring straight after load mixes in the tail of the load work.

## Data rules

`scenario.mjs` mirrors the **structure** of real Beacon responses (field names,
nesting, types, the offset-free local timestamps), but every **value** is
invented: people, callsigns, ids, phone numbers (ACMA fictional range), plates,
street names and localities. Coordinates sit in western Sydney only so the
basemap looks plausible.

Never copy values out of `build/lad-samples/`, and never commit that folder.
The one structure the samples didn't cover is a team's `Members` entries
(the sampled team had none), so `{ TeamLeader, Person }` comes from
`models/Team.js`.

## Refreshing against the real API

```sh
npm run lad:samples -- --hq <entityId>   # prompts for a short-lived bearer token (hidden input)
```

It defaults to trainbeacon and widens the search window or drops the HQ
filter if nothing comes back. Compare the samples' structure with `scenario.mjs`
after a Beacon change.
