# Incident Export harness

Runs the built Incident Export page (`dist/pages/advexport.html`, source in
`src/pages/advexport/`) outside the extension, in your installed Google Chrome,
against a mock Beacon serving **entirely fake data**. Built on the shared
harness in [`scripts/page-docs`](../page-docs/README.md).

```sh
npm run dev                      # build dist/ first
npm run advexport:check          # end-to-end checks in headless Chrome (exit 1 on failure)
npm run advexport:demo           # visible Chrome window with the demo data (--dark for dark mode)
npm run advexport:shots          # headless screenshots -> build/advexport-screenshots/
npm run advexport:shots -- --only overview,dark --out docs/export/images
```

Add `--verbose` to any of them to log mock traffic and page errors.

| File | What it does |
| --- | --- |
| `scenario.mjs` | The incidents from the Incident Statistics harness ([`scripts/stats-docs/scenario.mjs`](../stats-docs/scenario.mjs)), plus the columns only the export shows: invented caller and contact names, ACMA fiction-range phone numbers, premises access, and an Ops Log with some ICEMS Incident Update Messages for each ICEMS incident. Seeded. |
| `launch.mjs` | `launchExport()`: answers `Entities/{id}`, `Jobs/Search` (HQ and date filters, Beacon's paging) and `OperationsLog/search`, and counts requests in `stats` (including the most Ops Log requests at once). `downloadCsv()` clicks Download and returns the file. |
| `check.mjs` | End-to-end checks: count, title, default columns and preview; the downloaded CSV (header, ISO times, one row per incident, quotes and line breaks); remembered columns, All / None, Reset; no columns; ICEMS counts (only ICEMS incidents, four at a time, right numbers, a failed Ops Log); Beacon errors, Try again and a failed Reload; no incidents; one HQ / all of NSW; header colour per Beacon; the guide link; OS dark mode. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |

`launchExport` options: those of `launchPage` (`headless`, `viewport`, `dark`,
`env`, `watermark`, `verbose`, `scale`, `hours`, `range`) plus `now`, `hq`,
`failSearch` (HTTP status for `Jobs/Search`), `failSearchTimes` (503 the next
N searches; or set `stats.failNext` mid-run), `pageDelayMs` (to watch the ring),
`failOpsLogFor` (incident ids whose Ops Log fails), `opsLogDelayMs`, `storage`
(localStorage to start with, e.g. `{ 'lh-advexport-fields': '["Identifier"]' }`).
