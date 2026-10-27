# Shared page harness

The pieces every new-tab page harness uses (`scripts/summary-docs`, and
`scripts/stats-docs` once it moves over). Each page's folder adds only its fake
Beacon answers, its checks and its shot list.

| File | What it does |
| --- | --- |
| `launchPage.mjs` | `launchPage()`: launches a built page from `dist/pages/` in the installed Google Chrome, stubs `chrome.*` with a fake token, passes the URL params Beacon's menu would, serves `dist/` from a fake origin and hands every request to the fake Beacon host to the page's mock. Also `settle()`, `json()`, `arg()`. |
| `runners.mjs` | `runChecks()` (✓/✗ per check, exit 1 on failure), `runShots()` (`--out`, `--only`), `assert()`. |
| `units.mjs` | The four fake HQs in one fake zone, and a seeded PRNG. |

Same data rules as `scripts/lad-docs`: real Beacon *structure*, invented *values*.
