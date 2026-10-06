---
title: Interface Overview
nav_order: 3
---

# Interface Overview

The LAD interface has two core components: the **side draw** and the **situation map**. The divider between them can be resized, and the side draw can be hidden completely for a full-screen map by clicking the **<<** button on the map.

![LAD interface overview](images/interface-overview.jpg)

**Side draw**

- **Team Register** (top) — lists all filtered teams and their taskings, with actions against those teams. See [Team Register](team-register.md).
- **Incident Register** (bottom) — lists all filtered incidents and their details, with actions against those incidents. See [Incident Register](incident-register.md).

**Situation Map**

- Displays all filtered incidents and teams, and allows actions to be taken against them. Layers are available to display additional map information. See [Situation Map](situation-map.md).

## Register Controls

The Team and Incident registers share a common set of controls:

- **Toggle Starred** — switches the register between all filtered incidents/teams and only [starred](common-functions.md#starring-incidents-and-teams) ones.
- **New Ops Log Entry** — opens the [New Ops Log](common-functions.md#new-ops-log) dialog. The entry is not automatically attached to an incident.
- **New Radio Log Entry** — opens the [New Radio Log](common-functions.md#new-radio-log) dialog. The entry is not automatically attached to a team or incident.
- **Filter Settings** — opens the filters relevant to that register (Teams or Incidents).
  - The Team Register filter dropdown also opens the [Trackable Assets Library](#trackable-assets-library).
- **Refresh Data** — refreshes the data for that register.
- **Page Configuration** (right) — opens the [Page Configuration](getting-started.md#page-configuration--filters) screen.

Each register also has a **collapse all** button that collapses every team or incident in that register.

<!-- TODO: screenshot of the register control buttons -->

## Alerts

Alerts display in the top right corner of LAD under certain conditions:

- **Unacknowledged Incidents** — all filtered incidents in the *New* status.
- **Untasked Incidents** — all filtered incidents in the *Active* status that have no taskings.
- **Unacknowledged ICEMS** — all filtered incidents with an unacknowledged ICEMS message. See [ICEMS](icems.md).
- **Incidents Pending Completion** — incidents where all teams have completed but the incident is still active. This flags incidents that can potentially be closed if no further action is required.
- **Incidents missing geolocation** — incidents created without a geocoded (GPS) address. These are not displayed on the map.

![Unacknowledged incidents alert](images/alert-unacknowledged.png)

### Managing Alerts

Minimise an alert by clicking the cross on its right. It can be re-opened at any time, and minimising does not dismiss the underlying alerts. The alert automatically re-appears if another incident meets its condition, e.g. a new unacknowledged ICEMS message.

### Selecting Alerts

Click the incident text in an alert to select that incident in the Incident Register and focus the Situation Map on it.

## Trackable Assets Library

The Trackable Assets Library is opened from the filter dropdown in the Team Register. It lists all SES PSN radios and can be used to confirm radio details — most commonly, finding the programmed radio name (for [team tracking](getting-started.md#setting-up-a-team-for-radio-tracking)) by searching for the PSN ID.

Each radio entry displays:

- Radio asset callsign (the name programmed into the radio)
- Assigned HQ
- Capability
- Radio type
- Current talkgroup
- PSN radio ID
- Time last seen
- Vehicle registration (where applicable)

Search by callsign, unit or zone name, or PSN ID using the field at the top.

![Trackable Assets Library](images/trackable-assets-library.png)
