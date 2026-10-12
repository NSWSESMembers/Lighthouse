# Website docs

These folders are published to <https://lighthouse.ses.nsw.gov.au>:

| Folder | Published at |
| --- | --- |
| `docs/lad/` | [/guides/lad/](https://lighthouse.ses.nsw.gov.au/guides/lad/), the LAD user guide |
| `docs/whats-new/` | [/whats-new/](https://lighthouse.ses.nsw.gov.au/whats-new/), changes in each release (the home page shows the latest three) |

There are two copies of each, one per release channel:

| Branch | Extension | Published at |
| --- | --- | --- |
| `master` | Lighthouse (Chrome Web Store release) | `/guides/lad/`, `/whats-new/` |
| `master-dev` | Lighthouse Development Preview | `/preview/guides/lad/`, `/preview/whats-new/` |

Both copies come from the same files, so you only ever write the docs once. A
change shows up in the preview copy when it merges to `master-dev`, and in the
stable copy when `master-dev` is released to `master`, the same as the code.
Preview pages have a banner linking to the stable page, and aren't indexed by
search engines.

The extension's guide links follow the build: the Development Preview build opens
the preview copy, and the production build opens the stable one. The stable URLs
never change, so links in older releases keep working.

## How it gets published

When a change to either folder lands on `master` or `master-dev`, the
[Sync Docs to Website](../.github/workflows/sync_website_docs.yml) workflow copies it
into
[NSWSESMembers/lighthouse.ses.nsw.gov.au](https://github.com/NSWSESMembers/lighthouse.ses.nsw.gov.au):
`master` into `guides/lad/` and `whats-new/`, `master-dev` into `preview/guides/lad/`
and `preview/whats-new/`. GitHub Pages then builds it with Jekyll. The page layouts
and styles live in the website repo (`_layouts/`, `assets/site.css`), not here.

So the stable guide only describes features users of the release actually have,
while Development Preview users can read about what's coming.

Write links to other pages as full `https://lighthouse.ses.nsw.gov.au/guides/lad/...`
or `.../whats-new/` URLs as usual. The `master-dev` sync rewrites them to the
`/preview/` pages.

Each sync also writes a version stamp on the website with the Lighthouse build
(e.g. `2026.10.06 build 3352a9f`, the same format as the extension's `version_name` in
chrome://extensions): `_data/lad_guide.yml` for `master`, `_data/lad_guide_preview.yml`
for `master-dev`. The guide shows it as "Written for Lighthouse …", meaning the
guide was last updated for that build.

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
# or, to preview the Development Preview copy, sync into preview/guides/lad/ and
# preview/whats-new/ instead and add a _data/lad_guide_preview.yml stamp
cd ../lighthouse.ses.nsw.gov.au
bundle exec jekyll serve   # needs the github-pages gem
# → http://localhost:4000/
```
