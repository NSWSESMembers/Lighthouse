# User guides

`docs/lad/` is the source for the LAD user guide published at
<https://lighthouse.ses.nsw.gov.au/guides/lad/>.

## How it gets published

When a change to `docs/lad/` lands on `master`, the
[Sync LAD Guide](../.github/workflows/sync_lad_guide.yml) workflow copies the folder
into `guides/lad/` in
[NSWSESMembers/lighthouse.ses.nsw.gov.au](https://github.com/NSWSESMembers/lighthouse.ses.nsw.gov.au).
GitHub Pages then builds it with Jekyll. The page layout and sidebar live in the
website repo (`_layouts/lad.html`), not here.

Edits merged to `master-dev` are not published until the next release, so the guide
only describes features users actually have.

Each sync also writes `_data/lad_guide.yml` on the website with the Lighthouse build
(e.g. `2026.10.06 build 3352a9f`, the same format as the extension's `version_name` in
chrome://extensions). The guide shows it as "Written for Lighthouse …", meaning the
guide was last updated for that release.

The workflow needs a `WEBSITE_SYNC_TOKEN` repo secret: a fine-grained PAT (or GitHub
App token) with **Contents: read & write** on the website repo only. You can also
run it manually from the Actions tab.

## Updating the guide

Update the guide in the **same PR** as any user-facing LAD change:

1. Edit the relevant page in `docs/lad/`, or add a new one.
2. Add a dated bullet to [`whats-new.md`](lad/whats-new.md).
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
- Don't add a `README.md` inside `docs/lad/`. Jekyll would publish it as a page.

## Previewing locally

Check out the website repo next to this one, then:

```sh
rsync -a --delete docs/lad/ ../lighthouse.ses.nsw.gov.au/guides/lad/
cd ../lighthouse.ses.nsw.gov.au
bundle exec jekyll serve   # needs the github-pages gem
# → http://localhost:4000/guides/lad/
```
