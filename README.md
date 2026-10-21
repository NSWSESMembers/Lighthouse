# Lighthouse

(Formerly "*Beacon Enhancement Suite*", "*BES*".)

## Requirements

- [Google Chrome](https://www.google.com/chrome/ "Download Google Chrome")
- NSW SES Beacon account

## Purpose

Lighthouse is intended to augment the functionality provided by Beacon. It streamlines some common workflows, such as closing a job or tasking a job to a team, it also provides customised displays for use on screens in an Operations Room, including the LAD (tasking) page.

Lighthouse also provides an opportunity to test functionality or fixes before those changes are put to the Beacon development team for incorporation into the core system.

User guides and release notes are on the [Lighthouse website](https://lighthouse.ses.nsw.gov.au).

## Operation

Lighthouse runs within the Chrome web browser and talks to Beacon as the signed-in user. It is bound by existing Beacon management systems, such as user permissions, security checks and logging of actions within Beacon for auditing purposes.

Lighthouse simply interfaces with the same information and functionality as normal Beacon, just in a different (and hopefully more effective and efficient) way.

Some features use a small Lighthouse backend (AWS Lambda, source in [`lambda/`](lambda/)) for things Beacon doesn't provide: address geocoding, driving routes, map layers and tiles, and shared LAD configuration.

## Usage

A compiled stable version of Lighthouse is available through the [Chrome Web Store](https://chromewebstore.google.com/detail/lighthouse/eheijalihofgiaoeanmnjceefmcpajnb "Lighthouse in the Chrome Web Store").

This version is updated when the development branch is released, and/or it is convenient and safe to distribute an updated version.

A compiled development version is available through the [Chrome Web Store](https://chromewebstore.google.com/detail/lighthouse-development-pr/jcmiinngebdojjbcjlpjpdhiankmjbda "Lighthouse Development Preview in the Chrome Web Store").

This version is updated as changes are merged on GitHub, and/or there is something in the pipeline that we want to test on a wider audience.

## Development

Install:

- Node and npm (current LTS, e.g. Node 24) `brew install node`
- `cd Lighthouse`
- `npm install`

Build for development:

- `npm start` (or `npm run dev` for a one-off build)
- The extension is built into `dist/`. Load this into Chrome via `chrome://extensions` with Developer mode turned on.
- `npm start` rebuilds as you make changes, but some changes won't take effect in Chrome until you reload the extension.

Check your changes:

- `npm run lint` — ESLint, zero warnings allowed
- `npm test` — Vitest unit tests (`*.test.js` next to the source)
- `npm run lad:demo` — runs the built LAD page against a mock Beacon with fake data, no login needed. See [`scripts/lad-docs/README.md`](scripts/lad-docs/README.md).

Contributing:

- Branch from `master-dev` and open pull requests against `master-dev`. `master` is the release branch.
- For user-visible changes, update the matching user guide page in [`docs/`](docs/README.md) and add a What's New entry in the same PR.

Pull requests are welcome!

## Known Limitations

- All summary, statistics and export screens will only follow HQ and time/date filters, eg if you filter by job type then generate a summary it will be everything not just that job type.
- Lighthouse menu - If you are a region user it will only show your region, not all units within your region. You need to generate these screens from the Job Register to get around this.
