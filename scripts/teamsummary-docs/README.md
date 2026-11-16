# Team Summary harness

Runs the built Team Summary page (`dist/pages/teamsummary.html`, source in
`src/pages/teamsummary/`) outside the extension, in your installed Google
Chrome, against a mock Beacon serving **entirely fake data**. Built on the
shared harness in [`scripts/page-docs`](../page-docs/README.md).

```sh
npm run dev                        # build dist/ first
npm run teamsummary:check          # end-to-end checks in headless Chrome (exit 1 on failure)
npm run teamsummary:demo           # visible Chrome window with the demo data (--dark for dark mode)
npm run teamsummary:shots          # headless screenshots -> build/teamsummary-screenshots/
npm run teamsummary:shots -- --only overview,dark --out docs/teams/images
```

Add `--verbose` to any of them to log mock traffic and page errors.

| File | What it does |
| --- | --- |
| `scenario.mjs` | The fake world: twelve teams across the four demo units (field and operations; Activated, Standby, On Alert, Rest), members, resources, sectors, the incidents they're on and each team's history. Seeded. `setStatus()` and `addMembers()` change a team mid-run. History rows follow the shape the old page read, as no real `Teams/{id}/History` sample was captured. |
| `launch.mjs` | `launchTeamSummary()`: answers `Entities/{id}`, `Teams/Search` (filtered by `AssignedToId` and `StatusTypeId`), `Teams/{id}/History` and `Jobs/{id}`, and records every request in `requests`. `launch: 'today'` opens with today's range, as Beacon's menu does. `waitForTeams()` waits for the teams and the shown teams' history, then closes the Team Filter that opens on load (`{ keepDialog: true }` leaves it open). |
| `check.mjs` | End-to-end checks: the Team Filter opening on load (as on the old page), the teams shown at first and the counts, HQ titles and search parameters, the Team Filter buttons and options, a team becoming Activated on refresh, the incident popup, hidden rows, grid width and colours (remembered), heading colour per Beacon, dark mode, phone width, range buttons, Beacon errors and retries, a failed history, the slow-Beacon ring, the guide link. |
| `capture.mjs` | The shot list. Add a shot by adding an entry to `SHOTS`. |
| `demo.mjs` | Headed launcher. |

`launchTeamSummary` options: those of `launchPage` (`headless`, `viewport`, `dark`,
`env`, `watermark`, `verbose`, `scale`, `hours`, `range`) plus `now`, `hq`,
`launch: 'today'`, `failSearch` (HTTP status for `Teams/Search`),
`failSearchTimes` (fail the first N searches with a 503), `searchDelayMs` (to
watch the ring), `failHistory` (HTTP status for `Teams/{id}/History`),
`storage` (localStorage to start with, e.g.
`{ LighthouseTeamSummarySettings: '{"autoShow":false}' }`).
