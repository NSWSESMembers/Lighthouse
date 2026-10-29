---
title: Privacy Policy
description: What data the Lighthouse browser extension uses, where it goes, and why.
---

_Last updated: 29 October 2026_

This policy covers the **Lighthouse** and **Lighthouse Development Preview**
extensions for Google Chrome ("Lighthouse"). Lighthouse is built and maintained
by NSW SES volunteers. It adds tools to Beacon, the NSW State Emergency
Service's incident management system, and to the NSW SES MyAvailability system.

The short version: Lighthouse works with the Beacon data you can already see,
mostly inside your own browser. It does not track your browsing or show you
ads. It does not sell your data or share it with anyone for advertising or
profiling.

## Who can use Lighthouse

Lighthouse only does anything on Beacon and MyAvailability pages, and its
features only work once you're signed in to Beacon. Your access is whatever
your Beacon account allows. Lighthouse never gets around Beacon's own
permissions.

## What Lighthouse uses, and why

### Your Beacon sign-in token

While you're signed in to Beacon, Lighthouse reads your Beacon access token so
its pages can load Beacon data for you, the same way Beacon's own pages do.

- The token is stored in your browser's extension storage (`chrome.storage.local`),
  on your computer only. It is replaced each time Beacon issues a new one, stops
  working when it expires, and is removed when you remove Lighthouse.
- It is only ever sent to Beacon itself, to load data you're allowed to see, and
  to the Lighthouse backend (below), so it can check you're a signed-in Beacon user.
- Lighthouse never sees or stores your Beacon password.

### Beacon data shown on the page

Lighthouse reads Beacon data (incidents, teams, members, assets, messages and
NITCs) to show its maps, tables, statistics and exports. This happens in your
browser. Exports such as CSV files are created on your computer and saved
wherever you choose. Lighthouse doesn't upload them anywhere.

### Settings saved in your browser

Lighthouse remembers your choices, such as map layers, filters, layout, dark
mode, panel positions and page preferences. These are kept in your browser's
local storage and extension storage. Some page preferences use Chrome sync
storage (`chrome.storage.sync`), so they follow you to other computers where
you're signed in to Chrome with sync turned on. These settings contain no
Beacon incident data.

## The Lighthouse backend

Some features need a small server. These run on Amazon Web Services in the
Sydney region (`ap-southeast-2`) at `lambda.lighthouse-extension.com`. Every
request must carry a valid Beacon token. The backend checks that token and
then throws it away. It doesn't keep the token.

| Feature | What is sent | What is kept |
| --- | --- | --- |
| Address search and "what's here?" lookups | The search text, or a map coordinate | Nothing. The lookup is passed to Amazon Location Service and the result returned. |
| Driving routes and travel times | The start and end coordinates (for example a team's vehicle and an incident) | Nothing. Passed to Amazon Location Service. |
| Sharing a LAD configuration | Your LAD settings and filters (for example selected HQs, filters, pinned teams and incidents) | The settings, under a share key, so others with the key can load them. |
| Default assets for teams | A team id and the asset id chosen for it | The pairing, so other users see the same default. Old entries expire automatically. |
| Collaborative map layers | Layer names, markers and comments you add, the HQ or event a layer is attached to, the moderators you choose, and your Beacon member id as the author | The layer and its markers, so other users at your organisation can see them. Deleted layers and markers are hidden but kept, so they can be recovered. |
| MyAvailability activation summaries | An activation id or unit name | Nothing. The backend reads the response counts and member names from MyAvailability and returns them. |

For security and troubleshooting, the backend logs which feature was used, when,
and the Beacon member id of the person using it. These logs are kept in Amazon
CloudWatch for 90 days and are only seen by the Lighthouse
maintainers.

Lighthouse also downloads files that contain no personal data from
`static.lighthouse-extension.com` and `map.lighthouse-extension.com`, such as
notice banners, message templates and SES unit and zone boundary maps.

## Other services Lighthouse connects to

To show public information on its maps, Lighthouse downloads data from:

- NSW Rural Fire Service and Fires Near Me (fire incidents)
- Transport for NSW and Live Traffic NSW (traffic incidents and cameras)
- Ausgrid, Endeavour Energy and Essential Energy (power outages)
- Hazard Watch (NSW SES warnings)
- Bureau of Meteorology (via Esri ArcGIS), RainViewer and WaterNSW (weather, radar, rivers and dams)
- NSW Spatial Services and Esri ArcGIS (base maps, imagery and boundaries)
- adsb.lol and the OpenSky Network (aircraft positions)

These requests only download public data. Lighthouse doesn't send them your
Beacon token or any Beacon data. As with any web request, those services can
see your IP address and browser type. Their own privacy policies apply.

## What Lighthouse doesn't do

- It doesn't collect your browsing history or run on websites other than the
  Beacon, MyAvailability and data-feed sites listed in its permissions.
- It doesn't use analytics, tracking, advertising or crash-reporting services.
- It doesn't use your device's location.
- It doesn't sell or transfer your data to third parties, except to provide the
  features described above.
- It doesn't use your data for anything unrelated to those features, or to work
  out creditworthiness or for lending.

Lighthouse's use of data complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies),
including its Limited Use requirements.

## Browser permissions

| Permission | Why Lighthouse needs it |
| --- | --- |
| Access to Beacon, MyAvailability and the data-feed sites | To add tools to Beacon pages and to load the data shown on Lighthouse's maps |
| `storage` | To save your settings and your Beacon token in your browser |
| `notifications` | To show alerts you've turned on, such as Radio Console alerts |
| `scripting` and `webNavigation` | To add Lighthouse's tools to Beacon pages as they load |

## Your choices

- **Clear your settings and token:** remove Lighthouse from Chrome. This deletes
  everything it has stored in your browser.
- **Shared settings and map layers:** you can delete map layers and markers you
  created in LAD. To have shared settings or map-layer content removed
  completely, contact us (below).
- **Not using a feature** means its data is never sent. For example, if you
  never share a configuration, nothing is stored for it.

## Changes to this policy

If Lighthouse starts using data in a new way, we'll update this page and the
date at the top, and mention it in [What's New](https://lighthouse.ses.nsw.gov.au/whats-new/).

## Contact

Questions or requests about this policy: [lighthouse@ses.nsw.gov.au](mailto:lighthouse@ses.nsw.gov.au), or the
[Lighthouse Facebook group](https://www.facebook.com/groups/LighthouseExtension/).
