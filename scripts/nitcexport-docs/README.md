# NITC Export harness

Runs the built NITC Export page (`dist/pages/nitcexport.html`, source in
`src/pages/nitcexport/`) outside the extension, in your installed Google Chrome,
against a mock Beacon serving **entirely fake data**. Built on the shared
harness in [`scripts/page-docs`](../page-docs/README.md).

```sh
npm run dev                       # build dist/ first
npm run nitcexport:check          # end-to-end checks in headless Chrome (exit 1 on failure)
npm run nitcexport:demo           # visible Chrome window with the demo data (--dark for dark mode)
npm run nitcexport:shots          # headless screenshots -> build/nitcexport-screenshots/
npm run nitcexport:shots -- --only overview,dark --out docs/nitc/images
```

Add `--verbose` to any of them to log mock traffic and page errors.

| File | What it does |
| --- | --- |
| `scenario.mjs` | 160 Non-Incident Task Cards over 30 days for the four fake HQs, in the structure the page reads from `NonIncident/Search` (ViewModelType 6), with invented members as participants. Includes a name with `#` and brackets, a task with no tags, a participant with no end time and two members with the same name. Seeded. |
| `launch.mjs` | `launchNitc()`: answers `Entities/{id}` and `NonIncident/Search` (HQ, type, tag and date filters, Beacon's paging), and records each search URL and page size in `stats`. `downloadCsv()` clicks Download and returns the file. |
| `check.mjs` | End-to-end checks: opening makes one 10-row request; count, title, preview; Activity List CSV (header, ISO times, `Name[hours]` participants, `#` kept, one row per task); Member List CSV (a row per member by person id, Total Hours adding up, a column per tag, No tag); the remembered report; the NITC screen's filters reach Beacon and the header; Beacon errors, Try again, a failed Reload, a failed Download, Cancel; 401; no tasks; header colour per Beacon; the guide link; OS dark mode. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |

`launchNitc` options: those of `launchPage` (`headless`, `viewport`, `dark`,
`env`, `watermark`, `verbose`, `scale`, `hours` (default 30 days), `range`) plus
`now`, `hq`, `filters` (more NITC screen params, e.g. `{ TagIds: '701,702' }`),
`failSearch` (HTTP status for `NonIncident/Search`), `failSearchTimes` (503 the
next N searches; or set `stats.failNext` mid-run), `pageDelayMs` (to watch the
ring), `storage` (localStorage to start with, e.g. `{ 'lh-nitcexport-report': 'member' }`).

The scenario's *structure* is inferred from what the old page read (no real
NonIncident sample was to hand). `npm run lad:samples` now also saves
`build/lad-samples/nonincident-search.json` to check it against.
