# Incident Summary harness

Runs the built Incident Summary page (`dist/pages/summary.html`, source in
`src/pages/summary/`) outside the extension, in your installed Google Chrome,
against a mock Beacon serving **entirely fake data**. Built on the shared
harness in [`scripts/page-docs`](../page-docs/README.md).

```sh
npm run dev                    # build dist/ first
npm run summary:check          # end-to-end checks in headless Chrome (exit 1 on failure)
npm run summary:demo           # visible Chrome window with the demo data (--dark for dark mode)
npm run summary:shots          # headless screenshots -> build/summary-screenshots/
npm run summary:shots -- --only overview,dark --out docs/summary/images
```

Add `--verbose` to any of them to log mock traffic and page errors.

| File | What it does |
| --- | --- |
| `scenario.mjs` | The fake world: ~300 incidents across the four demo units over the last week, weighted to a storm in the last two days. Seeded. `summaryRows()` turns them into Beacon's `Reports/JobsSummary` rows for an HQ list and range; `addNew()` adds New incidents mid-run. |
| `launch.mjs` | `launchSummary()`: answers `Entities/{id}` and `Reports/JobsSummary` (filtered by `EntityIds` and dates). `launch: 'today'` opens with today's range, as Beacon's menu does. |
| `check.mjs` | End-to-end checks: counts match the report, single HQ / all of NSW titles, range buttons, the new-incident highlight and sound, Settings (dark mode, remembered, old themes carried over), box colour per Beacon, big counts fitting, Beacon errors, the slow-Beacon ring, the guide link, OS dark mode. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |

`launchSummary` options: those of `launchPage` (`headless`, `viewport`, `dark`,
`env`, `watermark`, `verbose`, `scale`, `hours`, `range`) plus `now`, `hq`,
`launch: 'today'`, `failSummary` (HTTP status for `JobsSummary`),
`summaryDelayMs` (to watch the ring), `storage` (localStorage to start with,
e.g. `{ LighthouseSummaryNewJobSound: 'Chime' }`).
