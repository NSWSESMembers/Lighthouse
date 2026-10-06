# Website docs

These folders are published to <https://lighthouse.ses.nsw.gov.au>:

| Folder | Published at |
| --- | --- |
| `docs/lad/` | [/guides/lad/](https://lighthouse.ses.nsw.gov.au/guides/lad/), the LAD user guide |
| `docs/whats-new/` | [/whats-new/](https://lighthouse.ses.nsw.gov.au/whats-new/), changes in each release (the home page shows the latest three) |

## How it gets published

When a change to either folder lands on `master`, the
[Sync Docs to Website](../.github/workflows/sync_website_docs.yml) workflow copies it
into
[NSWSESMembers/lighthouse.ses.nsw.gov.au](https://github.com/NSWSESMembers/lighthouse.ses.nsw.gov.au).
GitHub Pages then builds it with Jekyll. The page layouts and styles live in the
website repo (`_layouts/`, `assets/site.css`), not here.

Edits merged to `master-dev` are not published until the next release, so the site
only describes features users actually have.

Each sync also writes `_data/lad_guide.yml` on the website with the Lighthouse build
(e.g. `2026.10.06 build 3352a9f`, the same format as the extension's `version_name` in
chrome://extensions). The guide shows it as "Written for Lighthouse …", meaning the
guide was last updated for that release.

The workflow needs a `WEBSITE_SYNC_TOKEN` repo secret: a fine-grained PAT (or GitHub
App token) with **Contents: read & write** on the website repo only. You can also
run it manually from the Actions tab.

## Updating What's New

Add to [`whats-new/index.md`](whats-new/index.md) in the **same PR** as any
user-facing change, LAD or otherwise. Add bullets under a heading at the top for the
upcoming release (a short title, then an italic line with the date and release tag).
The comment at the top of the file has the full format.

## Updating the guide

Update the guide in the **same PR** as any user-facing LAD change:

1. Edit the relevant page in `docs/lad/`, or add a new one.
2. Add a bullet to [What's New](whats-new/index.md), linking to the guide section.
3. Put screenshots in `docs/lad/images/` and use kebab-case names
   (`team-expanded.png`). Crop them to the relevant part of the UI, and blur or
   avoid real phone numbers.

## Conventions

- Every page starts with front matter:

  ```yaml
  ---
  title: Team Register    # used in the sidebar and the browser tab
  nav_order: 5            # position in the sidebar
  ---
  ```

- Link between pages with relative `.md` links, e.g.
  `[Tasking Status](team-register.md#tasking-status)`. These work when browsing on
  GitHub, and Pages rewrites them to `.html`.
- Mark a missing or outdated screenshot with `<!-- TODO: screenshot of ... -->` so
  it's easy to find with grep.
- Don't add a `README.md` inside `docs/lad/` or `docs/whats-new/`. Jekyll would
  publish it as a page.

## Previewing locally

Check out the website repo next to this one, then:

```sh
rsync -a --delete docs/lad/ ../lighthouse.ses.nsw.gov.au/guides/lad/
rsync -a --delete docs/whats-new/ ../lighthouse.ses.nsw.gov.au/whats-new/
cd ../lighthouse.ses.nsw.gov.au
bundle exec jekyll serve   # needs the github-pages gem
# → http://localhost:4000/
```
