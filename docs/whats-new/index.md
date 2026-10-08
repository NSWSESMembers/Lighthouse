---
title: What's New
description: New features and fixes in each Lighthouse release.
---

# What's New

Changes to Lighthouse that you'll notice, newest first. The full developer release notes are on [GitHub](https://github.com/NSWSESMembers/Lighthouse/releases).

<!--
Add an entry in the same PR as any user-facing change. Edits go live on the
website when master-dev is released to master.

Format: one `##` heading per release (a short title), then a line with the
date and the release tag, then one bullet per change. Use `###` sub-headings
when a release touches more than one area. Link LAD changes to the matching
section of the LAD guide with a full https://lighthouse.ses.nsw.gov.au/guides/lad/... URL.
The home page shows the first three `##` entries, so keep the title short.
-->

## LAD overlapping asset markers

*Unreleased*

- **Overlapping asset markers spread out.** When zoomed in to street level, asset markers that would sit on top of each other swing around the vehicle's position so each one can be seen and clicked. Where there isn't room, a marker moves out on a line back to a dot where the vehicle is. See [Overlapping Asset Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#overlapping-asset-markers).
- The asset marker whose popup is open is drawn on top and highlighted, and its popup opens over the marker rather than beside it.
- The **Map markers** settings are grouped into **Incident markers**, **Asset markers** and **All markers** sections. Under **Asset markers** you can turn the spreading off, choose the zoom level it starts at, and stop markers moving out on lines. See [Asset Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#asset-markers).
- Panning the map stays smooth with many asset markers shown, including after zooming out and back in.
- Asset markers now point exactly at the vehicle's position (they sat a few pixels low).
- The section arrows in the Configuration tabs are visible in dark mode.

## LAD satellite trackers and asset library

*7 October 2026 · [v2026.10.07.1](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.07.1)*

- **Satellite-tracked assets.** Assets located by a satellite tracker show a satellite icon next to their last-seen time, crossed out if the tracker isn't active. The asset popup and the Trackable Assets Library show the tracker's class, status and battery. See [Satellite-Tracked Assets](https://lighthouse.ses.nsw.gov.au/guides/lad/interface.html#satellite-tracked-assets).
- **Show an asset on the map from the Trackable Assets Library.** Each entry has a **Show on map** button that focuses the map on the asset and opens its popup, turning on the asset layer it needs. See [Showing an Asset on the Map](https://lighthouse.ses.nsw.gov.au/guides/lad/interface.html#showing-an-asset-on-the-map).
- The Trackable Assets Library can be filtered by **Type** and by location **Source** (satellite tracker or PSN radio), and searched by satellite ID.
- The Trackable Assets Library can also be opened from the bottom of the [Configuration](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html) tabs.

## LAD "In map view" filter and a user guide

*6 October 2026 · [v2026.10.06](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.06)*

- **In map view filter.** The Team and Incident registers have a new **Toggle In Map View** button that lists only the teams or incidents inside the area you're looking at on the map. The register header shows how many are in view out of the total. See [Listing Only What's in the Map View](https://lighthouse.ses.nsw.gov.au/guides/lad/common-functions.html#listing-only-whats-in-the-map-view).
- **The LAD user guide is online** at [lighthouse.ses.nsw.gov.au/guides/lad](https://lighthouse.ses.nsw.gov.au/guides/lad/). It's based on the v1.6 Learner Guide and can be printed or saved as a PDF. Open it from the new **User guide** link at the bottom of the [Configuration](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html) tabs.
- The **Resolve** and job status buttons stay greyed out until you've entered the required text, so you can't submit an empty note by mistake.
- Tidier ops log cards on the timeline. The Important and Action Required flags and the Resolve button now sit together on one row.
- The rain radar legend and playback controls are readable in dark mode.

## LAD action-required tags on load

*1 October 2026 · [v2026.10.01](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.01)*

- Action-required badges now show as soon as the page loads, rather than only after you expand an incident.

## LAD hover popups show more at a glance

*25–26 September 2026 · [v2026.09.25.1](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.09.25.1), [v2026.09.26](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.09.26)*

- The incident hover popup on the map adds the situation on scene, every ICEMS agency involved (with its status) and any outstanding action-required tags. See [Hovering over an Incident](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#hovering-over-an-incident).
- Incidents with outstanding *action required* notes show a thumbtack with a count under the incident ID, in the register and in the map popup. Repeated action tags are grouped with a count, e.g. *Further Action Required ×2*. See [Incident Register](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html).
- The Team filters in Configuration are now ordered Status, Type, Tasking Status.
- Fixed the HQ search list on the Data tab opening behind other controls.

## A reworked LAD

*24 September 2026 · [v2026.09.24](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.09.24)*

### LAD

- **Configuration has been reorganised** into sections down the left, starting on a new **Data** tab. See [Configuration](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html).
- **Light, Dark or Auto theme** in the Appearance tab.
- **Incident markers show the job status**, and hovering over a marker shows a summary popup. See [Incident status on markers](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#incident-status-on-markers).
- **Reworked incident photo viewer** with thumbnails, zoom to actual size, pan, rotate, download and open in a new tab. See [Incident Photos](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html#incident-photos).
- **Resolve action-required notes** from the incident timeline, and the action-required alert bars jump to the matching timeline entry. See [Resolving notes](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html#action-required-tags--resolving-notes).
- With Live Updates on, each register's **Refresh Data** button flashes when Beacon pushes a change. See [Register Controls](https://lighthouse.ses.nsw.gov.au/guides/lad/interface.html#register-controls).
- If there's no Beacon remote tab to open a page in, LAD explains why and offers to open it in a new window. See [Opening pages in the Remote Tab](https://lighthouse.ses.nsw.gov.au/guides/lad/getting-started.html#opening-pages-in-the-remote-tab).
- New team type filter, and a configurable hotkey for Spotlight Search.
- Fixes: the map slowing down over long sessions, map popups not panning into view, the Assigned Sector dropdown, and a cramped call-off reason popup.

### Teams

- The **Recent Activations** panel is on the Team Edit page too, and its load button is easier to find.

## Recent myAvailability activations on Create Team

*1 September 2026 · [v2026.09.01](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.09.01)*

- The Create Team page has a **Recent myAvailability Activation Requests** panel. It lists recent activations for the team's unit so you can add responders straight from them.
- myAvailability wording is now consistent across Lighthouse.

## myAvailability on the job page and live updates in LAD

*22 August 2026 · [v2026.08.22](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.08.22)*

- **myAvailability gems on the job page.** Colour-coded counts (Activation Accepted, Available, Conditional, Unavailable, Unset) appear under the Incident Details header. A **Create Team** action builds a team from the responders.
- **LAD live updates.** LAD now updates as soon as Beacon reports a change, instead of waiting for the next refresh. See [Live Updates](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#live-updates).
- LAD highlights FR-1 incidents, and rows slide in and out as teams and incidents change.

## Collaborative map layers in LAD

*11 August 2026 · [v2026.08.11.1](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.08.11.1)*

- **Collaborative map layers.** Create a shared layer for an HQ or event, drop markers on it and comment on them. Owners and moderators control who can edit, delete or comment. See [Collaborative Map Layer](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#collaborative-map-layer).
- Fixed map popups appearing behind markers, SMS recipients from contact groups, and the BMB unit's HQ location.
- Security updates to third-party libraries.

## LAD maintenance

*June – July 2026 · [v2026.06.26](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.06.26) to [v2026.07.13](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.07.13)*

- Fixed the sort order of incident types and the width of the alerts overlay.
- Moved the Copmanhurst unit to its new location.
- Small UI fixes and security updates.

## LAD layout presets

*24 April – 11 May 2026 · [v2026.04.24](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.04.24), [v2026.05.11.02](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.05.11.02)*

- **Layout presets.** Pick a screen layout for LAD, switch between them, and LAD remembers your choice. See [Layout](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#layout).
- A map settings button, and improvements to the minimap and basemap.
- Hover over a team member to see their capabilities.

## Instant Task suggestions and ICEMS agency status

*March 2026 · [v2026.03.06](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.03.06) to [v2026.03.26](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.03.26)*

- **Instant Task suggestions** suggest a team when you task an incident, based on distance and current tasking count. See [Instant Task Suggestions](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#instant-task-suggestions).
- **ICEMS** messages are handled in LAD, with each agency's status shown. See [ICEMS](https://lighthouse.ses.nsw.gov.au/guides/lad/icems.html).
- **Dark mode**, incident marker clustering, distance tools and **Create Incident at Location** on the map.
- About 30 new map layers, including NSW Declared Dams.
- The alerts panel can be collapsed, and incident cards show how long ago they were refreshed.
- Much faster loading and refreshing when there are lots of incidents.

## LAD Spotlight, map tools and new layers

*February 2026 · [v2026.02.03](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.02.03) to [v2026.02.14](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.02.14)*

- **Spotlight search** (with commands) and new map tools in LAD. See [Spotlight Menu](https://lighthouse.ses.nsw.gov.au/guides/lad/common-functions.html#spotlight-menu).
- New map layers: BOM warnings, rain radar, WaterNSW areas and EPA sites, and power network boundaries.
- The Trackable Assets Library is sorted alphabetically, and asset matching prefers vehicles over portable radios.
- Lighthouse location services moved to Amazon Location Service.
- The asbestos register check has been removed because the register is being shut down.

## LAD is here

*January 2026 · [v2026.01.02.01](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.01.02.01) to [v2026.01.22.01](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.01.22.01)*

- **Lighthouse Aided Dispatch (LAD)** is a tasking dashboard for tracking and coordinating teams and incidents during events of any size. Open it from the Lighthouse menu in Beacon. See the [LAD user guide](https://lighthouse.ses.nsw.gov.au/guides/lad/).
- Incident photos in LAD, and left/right arrow keys in the job photo carousel.
- New power and aircraft layers on the situational awareness map, and updated cluster boundaries.

## 2025

- **22 September** — Fixed the Blue Mountains cluster.
- **1 August** — Fixed the activated status in myAvailability report downloads.
- **29 July** — Removed the postcode lookup now that Beacon shows postcodes itself.
- **1 July** — myAvailability *activate with changes*. Fixed radio locations not loading, and Team Summary not loading in Edge.
- **19 June** — New myAvailability reports, member downloads for out-of-area activation requests, and the nearest HQ by road when creating an incident.
- **9 March** — Fixed zones showing as State on the Job Statistics page.
- **23 January** — Hotkey to open the radio log.

## 2024

- **11 December** — Removed T+ from messages, now that Beacon does it.
- **14 November** — Updated unit codes and clusters for units that changed.
- **23 February** — Fixed the NITC export for events with a `#` in the name.
- **9 February** — Added the Blue Mountains East and West units.
- **29 January** — Added missing rescue tags to the Job Summary.

## 2023

- **December** — myAvailability support.
- **August** — Vehicle telematics data, dynamic banners, and progress shown while Instant Task runs.
- **13 July** — Forward a message from the job page, a nearest-rescue-unit display for every rescue job type when creating a job, and groundwork for message templates.
- **11 May** — Fixes to the situational awareness map, the Create Team page and the NITC export.

## 2022

- **16 March** — An *HQ Filtered Asset Locations* layer on the situational awareness map. Markers are coloured by asset type (blue command, red rescue, orange storm, yellow bus, brown state pool, purple general purpose) and follow the map's HQ filter. Also an updated LHQ location dataset.
- **1 March** — Rescue categories on the Job Advanced Export and Job Statistics pages.
- **February** — **Asset Locations** on the job page: the nearest vehicles to a job with distance, bearing, talkgroup and last update, plus driving routes you can drag to re-route. Three map modes (*All*, *Active Only* and *Filtered Only*), a refresh button and a centre-on-job button.
