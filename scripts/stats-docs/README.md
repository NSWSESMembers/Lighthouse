# Incident Statistics harness

Runs the built Incident Statistics page (`dist/pages/stats.html`, source in
`src/pages/stats/`) outside the extension, in your installed Google Chrome,
against a mock Beacon serving **entirely fake data**. Use it to check the page
end to end, click around without a Beacon login, or regenerate the guide's
screenshots. Built on the shared harness in [`scripts/page-docs`](../page-docs/README.md).

```sh
npm run dev                  # build dist/ first
npm run stats:check          # end-to-end checks in headless Chrome (exit 1 on failure)
npm run stats:demo           # visible Chrome window with the demo data (--dark for dark mode)
npm run stats:shots          # headless screenshots -> build/stats-screenshots/
npm run stats:shots -- --only overview,filtered --out docs/stats/images
```

Add `--verbose` to any of them to log mock traffic and page errors.

Requires Google Chrome installed; `playwright-core` drives it (no browser download).

| File | What it does |
| --- | --- |
| `scenario.mjs` | The fake world: four units in one zone, ~360 incidents over the last week, weighted to a storm in the last two days. Seeded, so the data is the same for a given `now`. |
| `launch.mjs` | `launchStats()`: on `launchPage()` (fake `chrome.*`, token, URL params, `dist/` served from a fake origin); answers `Entities/{id}` and `Jobs/Search` (filtered by HQ and date, paged). Swaps `resources/unitClusters.json` for fake clusters. Other network requests are blocked. |
| `check.mjs` | End-to-end checks: loading, filtering by pie and by brushing, range buttons, hourly vs daily buckets, a filter surviving a refresh, single-HQ title, word cloud counts, header colour per Beacon, Beacon errors, dark mode. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |

The unit tests (`npm test`) cover the data handling in `src/pages/stats/data/`, the shared page code in `src/pages/shared/`
and the view model. `check.mjs` covers what those can't: dc.js, the bindings and
the page in a real browser. Run it after changing the page.

## Scripted checks

```js
import { launchStats, waitForStats } from './scripts/stats-docs/launch.mjs';
const { browser, page, pageErrors } = await launchStats({ now: '2026-10-15T15:30:00+11:00', verbose: true });
await waitForStats(page);
// window.statsVM is the page's view model, e.g. statsVM.filteredCount()
await browser.close();
```

`launchStats` options: `headless`, `viewport`, `now`, `hq` (HQ ids, default all
four, `[]` for all of NSW), `hours` (launch range, default 72), `dark`, `env`
(`'production'`, `'trainbeacon'` or `'devbeacon'`: which Beacon the page thinks
it was opened from, for the header colour),
`failSearch` (HTTP status to fail `Jobs/Search` with), `pageDelayMs` /
`firstPageDelayMs` (slow down `Jobs/Search` pages to watch the loading ring), `watermark` (keep the
Development build watermark, off by default so screenshots don't carry it),
`verbose`, `scale`.

## Data rules

As for `scripts/lad-docs`: `scenario.mjs` follows the **structure** of Beacon's
`Jobs/Search` (ViewModelType 6) results, and every **value** is invented. Never
copy values from `build/lad-samples/` into it.
