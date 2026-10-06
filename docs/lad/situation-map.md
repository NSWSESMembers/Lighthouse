---
title: Situation Map
nav_order: 9
---

# Situation Map

The Situation Map is on the right of the screen (by default — see [Layout](configuration.md#layout)). It displays all filtered incidents and matched teams, giving you a visual picture to support tasking and decision making.

The different kinds of map content — incidents, collaborative layer markers, assets (radios), overlay icons and overlay polygons (areas) — are stacked in a set order, with higher layers drawn over lower ones. The order is set under [Marker Layer Order](configuration.md#marker-layer-order); by default incident markers are always drawn on top.

## Incident Clustering

Incidents can be clustered to make them easier to access and to deal with overlapping addresses. Clustering is enabled by default and happens in two situations:

- **Incidents at the same address / GPS location** — stops incidents being missed when they're stacked on top of each other. The cluster shows how many incidents are at the location.
- **Incidents close together** — as you zoom out, incidents within a set distance of each other are grouped to keep the map readable.

![Incident cluster](images/marker-cluster.png)

Clusters display as a hexagon. The number inside is the number of incidents in the cluster; a **red** number means at least one is a rescue incident.

The border works like a pie chart of incident priorities, using the same colours as the [Legend](#legend). For example, a cluster of 20 incidents with a border that is half green, a quarter blue and a quarter yellow contains 10 general, 5 immediate and 5 priority incidents.

Clustering settings are under [Incident Marker Clustering](configuration.md#incident-marker-clustering).

## Incident Status on Markers

When enabled under [Map Markers](configuration.md#incident-status-on-markers) (on by default), extra indicators are drawn on incident markers:

| Indicator | Meaning |
| --- | --- |
| <img class="icon" src="images/marker-unacknowledged.png" alt="" height="28"> <img class="icon" src="images/marker-unacknowledged-cluster.png" alt="" height="28"> | **Unacknowledged** — a pulsing yellow circle. Also shown on a cluster that contains an unacknowledged incident. |
| <img class="icon" src="images/marker-active.png" alt="" height="28"> | **Active** (not tasked) — a rotating purple dotted ring. |
| — | **Tasked** — no extra indicator. |
| <img class="icon" src="images/marker-complete.png" alt="" height="28"> | **Referred, Complete or Finalised** — a black diagonal line through the icon. |
| <img class="icon" src="images/marker-cancelled.png" alt="" height="28"> | **Cancelled or Rejected** — a black cross through the icon. |
| <img class="icon" src="images/marker-action-required.png" alt="" height="28"> | **Action Required** — a red exclamation mark when the incident has an outstanding action required tag, whatever its status. |

## Map Control

### Zoom

Use the **+** and **−** buttons in the top left, or the mouse wheel.

### Panning

Click and hold the left or middle mouse button and drag.

### Minimap

The minimap in the bottom right shows the current view in context of the wider area, and can be dragged to move the map. Hide or expand it with the arrow in its bottom right corner.

### Hiding All Popups

Hold <kbd>Space</kbd> to temporarily hide all popups; release to bring them back.

### Measuring Tool

Measure distances between multiple points. Several separate measurements can be on the map at once.

1. Click the ruler icon on the left of the map.
2. Click two or more points. The distance between each pair of markers is shown in green, and the total in blue.

- <kbd>Shift</kbd> + click a marker to delete it.
- Press <kbd>Esc</kbd> to start a new set of markers.
- Click the ruler icon again, or press <kbd>Esc</kbd> twice, to turn the tool off.
- The **X** icon under the ruler clears all measurements.

### Address Search

Open Address Search by right-clicking the map and choosing **Address Search**, or with the search tool <img class="icon" src="images/icon-map-search.png" alt="Search" height="20"> in the map controls.

![Address Search in the map context menu](images/map-context-address-search.png)

Type an address and results appear automatically. Select a result or press <kbd>Enter</kbd> to go to that address.

![Address search results](images/address-search.png)

### Creating Incidents from the Map

You can create an incident from a map location using reverse geocoding.

1. Right-click the location and choose **Geocode here**.

   ![Geocode here in the map context menu](images/map-context-geocode.png)

2. The map shows the nearest mappable addresses. Your selected location is a **red** pin and the found addresses are **blue** pins. Clicking anywhere else on the map cancels the search.

   ![Geocode results on the map](images/geocode-pins.jpg)

3. Click a blue pin to see the address, its distance from your red pin, the address type (e.g. *PointAddress* or *Street*), the area and the GPS coordinates.

   ![Geocode result details](images/geocode-result.png)

4. Click **Create Incident** to open Beacon's *Create New Incident* page in your [remote tab](getting-started.md#remote-beacon-tab) with the address pre-filled, then create the incident as normal.

## Layers

Layers control what is shown on the map. Open the Layers menu with the layer button <img class="icon" src="images/icon-layers.png" alt="Layers" height="20"> in the top left of the map.

### Basemap

The basemap is the underlying street or imagery map. The default is **Esri Topographic**; basemaps are available from Esri, Spatial NSW and SIX Maps, covering both street and satellite imagery.

Not all basemaps have data at every zoom level. If you zoom in beyond what the selected basemap supports, Esri Topographic is shown until you zoom back out.

To change basemap, open the **Layers** menu, open the basemap dropdown and pick one.

![Basemap selector](images/basemap.png)

### Overlays

Overlays sit on top of the basemap to add information. Toggle them on and off in the Layers menu, or use the search bar at the top to find a layer. Many overlay features show more detail when clicked — e.g. clicking a HazardWatch warning shows the full warning.

![Overlay layers](images/overlays.png)

Most layers are described by their name. Those that need more explanation:

**Assets**

- **Matched against Teams** — radio assets matched to a team. Only radios that have reported a location in the last 24 hours are shown.
- **Unmatched against Teams** — radio assets not matched to a team, shown with grey text. Icons are faded if the radio hasn't reported in the last hour.
  - This layer can slow LAD down and shouldn't be left on.

**NSW SES Geoservices**

- **Filtered Unit Boundaries** — a pink outline around your filtered headquarters.
- **NSW SES Zone Boundaries** — SES zone boundaries.
- **Unit/Zone Boundaries Hybrid** — SES zone and unit boundaries.
- **SES Unit Locations** — the location of every SES unit headquarters.
- **Active FRAOs** — active FRAO declarations, from the Beacon FRAO register.

**HazardWatch**

- **HazardWatch Active Warnings** — flood, tsunami, severe weather, coastal erosion and snow warnings. Click a warning to see the published product details. Refer to the Public Information Manual for more on warnings.

## Legend

The legend is in the bottom left of the map and explains the icons shown — incident shapes and priority colours, flood rescue categories, job status indicators, overlays and asset types. It can be hidden and re-opened at any time.

![Map legend](images/legend.jpg)

## Collaborative Map Layer

Collaborative map layers let users place markers on the map that other users can see. Create or subscribe to a layer under [Collaborative Layers](configuration.md#collaborative-layers) in the Configuration screen, then make it visible from the **Layers** menu.

### Adding a Marker

1. Right-click the map and choose **Add marker to collaborative layer**.

   ![Add marker to collaborative layer in the map context menu](images/map-context-collab-marker.png)

2. If you're subscribed to more than one layer, choose the layer to add the marker to.

   ![Choose a layer](images/collab-choose-layer.png)

3. Choose the marker icon and colour, enter a title and description, and click **Save**. Actions on markers are logged to the Ops Log.

   ![New marker form](images/collab-new-marker.jpg)

### Viewing and Changing a Marker

Click a marker to open it and see its details and comments.

- Use **Edit** or **Delete** to change or remove the marker.
- To comment, type in the comment field and click **Comment**.

![Collaborative marker popup](images/collab-marker-view.jpg)

## Incidents

All filtered incidents are shown on the map, with shape and colour depending on incident type and priority. Clicking an incident opens its popup and selects it in the Incident Register.

The popup shows:

- Incident ID
- Type and status
- Priority
- Outstanding *Action Required* tags, grouped with a count when the same tag appears more than once (e.g. *Further Action Required ×2*). Click a tag to open the incident's timeline.
- Address
- Situation
- Incident tags
- Tasked teams
- Date and time received
- Assigned HQ

Close the popup with the cross in its top right, or by clicking elsewhere on the map. When your mouse moves off the popup it becomes slightly transparent so you can see the map behind it.

![Incident popup](images/incident-popup.jpg)

### Hovering over an Incident

Hover over an incident marker to see a summary popup with the address, situation on scene and any outstanding action items.

![Incident hover popup](images/incident-hover.jpg)

### Incident Popup Actions

**Incident details section**

![Incident popup action buttons](images/incident-popup-actions.png)

- **Task Team** — opens [Instant Task](common-functions.md#tasking-teams-instant-task).
- **Incident Timeline** — opens the [Incident Timeline](incident-register.md#incident-timeline).
- **New Ops Log Entry** — opens [New Ops Log](common-functions.md#new-ops-log).
- **Open Incident in Remote Tab** — opens the incident in the Beacon remote tab.
- **Refresh Incident** — reloads the incident's details, including tasked teams and their statuses.

**Incident taskings section**

![Incident popup taskings](images/incident-popup-taskings.png)

- **Team row** — click to zoom to the team's location (if available).
- **Team status** — click to change the tasking status, as in the [registers](team-register.md#tasking-status).
- **Route to Asset** (left button) — shows a road route from the team's current location to the incident with an approximate ETA.
- **Fit Bounds** (right button) — zooms in as far as possible while keeping both the team and incident in view.

## Teams

The map shows team locations using GPS from the team's matched radio(s). This only works for SES-issued radios. The register *focus* buttons can only zoom to teams that are on the map.

Click a radio asset marker to see the radio's details — such as when it was last seen — the team it's matched to, and that team's taskings. Each tasking has two buttons:

- **Route to Asset** (left) — shows a road route from the team's current location to the incident with an approximate ETA.
- **Open Incident in Remote Tab** — opens the incident in the Beacon remote tab.

![Radio asset popup](images/asset-popup.png)
