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
```

Requires Google Chrome installed; `playwright-core` drives it (no browser download).

| File | What it does |
| --- | --- |
| `scenario.mjs` | The fake world: one HQ ("Demo City"), teams, incidents, taskings, radio/telematics positions. |
| `mockBeacon.mjs` | Answers Beacon + Lighthouse-lambda requests from the scenario. Other traffic (map tiles, BOM, transport) goes to the real internet. Unhandled Beacon endpoints are logged with `--verbose`. |
| `launch.mjs` | Stubs `chrome.*`, a fake bearer token and the extension's URL params; serves `dist/` from a fake origin. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |
| `fetch-samples.mjs` | Pulls real Beacon payloads into `build/lad-samples/` (gitignored) so `scenario.mjs` can be checked against the real API structure. |

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
