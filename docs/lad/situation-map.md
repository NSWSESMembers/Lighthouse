---
title: Situation Map
nav_order: 4
---

# Situation Map

The Situation Map is on the right of the screen (by default, see [Layout](configuration.md#layout)). It displays all filtered incidents and matched teams, giving you a visual picture to support tasking and decision making.

The different kinds of map content (incidents, collaborative layer markers, assets, overlay icons and overlay polygons) are stacked in a set order, with higher layers drawn over lower ones. The order is set under [Marker Layer Order](configuration.md#marker-layer-order); by default incident markers are always drawn on top.

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

## Layers

Layers control what is shown on the map. Open the Layers menu with the layer button <img class="icon" src="images/icon-layers.png" alt="Layers" height="20"> in the top left of the map.

### Basemap

The basemap is the underlying street or imagery map. The default is **Esri Topographic**; basemaps are available from Esri, Spatial NSW and SIX Maps, covering both street and satellite imagery.

Not all basemaps have data at every zoom level. If you zoom in beyond what the selected basemap supports, Esri Topographic is shown until you zoom back out.

To change basemap, open the **Layers** menu, open the basemap dropdown and pick one.

![Basemap selector](images/basemap.png)

### Overlays

Overlays sit on top of the basemap to add information. Toggle them on and off in the Layers menu, or use the search bar at the top to find a layer.

![Overlay layers](images/overlays.png)

#### Clickable Overlay Markers

Some overlays drop their own markers on the map. Click one to open a popup with more detail.

![Overlay markers on the map: an SES unit HQ, a traffic incident, a HazardWatch warning and a traffic camera](images/overlay-markers.png)

| Overlay | Marker | Click it to see |
| --- | --- | --- |
| **Transport NSW Incidents** | Live Traffic icon (crash, hazard, breakdown, traffic lights out, changed conditions) | What happened, where, traffic advice, speed limit, start/end time and who is managing it |
| **Transport NSW Cameras** | Camera icon | What the camera faces and its latest image (click the image to enlarge it) |
| **HazardWatch Active Warnings** | Warning icon in the middle of each warning area | The full published warning. Clicking anywhere in the area also works |
| **SES Units** | SES logo at each unit headquarters | The unit's status (Monitoring, Not Monitoring or Unavailable), its active teams and incidents, SRB accreditations and contacts |
| **EPA Contamination Sites** | Red dot | Site name, address, activity type and management class |
| **NSW Declared Dams** | Blue dot | Dam name, place, owner and declared status |

![Popup from clicking a traffic incident marker](images/overlay-marker-popup.png)

Some area overlays also open a popup when you click inside an area: **BOM Land Warnings** (warning type, severity and times) and **WaterNSW Special & Controlled Areas** (area name and class). Other overlays, such as boundaries, radar and BOM observations, are pictures only and don't respond to clicks.

Overlay markers are drawn under incidents by default. If one is hidden behind an incident, change the [Marker Layer Order](configuration.md#marker-layer-order).

#### Overlay Notes

Most layers are described by their name. Those that need more explanation:

**Visibility**

- **Incidents**: shows or hides every incident marker, along with their [status indicators](#incident-status-on-markers). Focusing an incident from an [alert](interface.md#alerts), the Incident Register or [Spotlight](spotlight.md) turns the layer back on.

**Assets**

- **Matched against Teams** and **Unmatched against Teams**: radios and satellite trackers, split by whether they're matched to a team. See [Asset Layers](assets.md#asset-layers).

**NSW SES Geoservices**

- **Filtered Unit Boundaries**: a pink outline around your filtered headquarters.
- **NSW SES Zone Boundaries**: SES zone boundaries.
- **Unit/Zone Boundaries Hybrid**: SES zone and unit boundaries.
- **SES Units**: the location of every SES unit headquarters.
- **Active FRAOs**: active FRAO declarations, from the Beacon FRAO register.

**HazardWatch**

- **HazardWatch Active Warnings**: flood, tsunami, severe weather, coastal erosion and snow warnings. Click a warning to see the published product details. Refer to the Public Information Manual for more on warnings.

**Collaborative layers** you've subscribed to are also listed here. See [Collaborative Map Layers](#collaborative-map-layers).

## Legend

The legend is in the bottom left of the map and explains the icons shown: incident shapes and priority colours, flood rescue categories, job status indicators, overlays and asset types. Each asset type is listed with its marker colour and its [capability code](assets.md#capability-codes). It can be hidden and re-opened at any time.

![Map legend](images/legend.png)

## Incidents on the Map

All filtered incidents are shown on the map, with shape and colour depending on incident type and priority (see the [Legend](#legend)). Incidents without a geocoded address aren't shown, and are listed in the *Incidents missing geolocation* [alert](interface.md#alerts).

### Incident Popup

Clicking an incident opens its popup and selects it in the Incident Register. The popup shows:

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

An incident popup can also be dragged onto a team in the Team Register to [task that team](tasking.md#drag--drop-team-tasking).

### Incident Popup Actions

**Incident details section**

![Incident popup action buttons](images/incident-popup-actions.png)

- **Task Team**: opens [Instant Task](tasking.md#instant-task).
- **Incident Timeline**: opens the [Incident Timeline](incident-register.md#incident-timeline).
- **New Ops Log Entry**: opens [New Ops Log](logs-and-messages.md#new-ops-log).
- **Open Incident in Remote Tab**: opens the incident in the Beacon [remote tab](getting-started.md#remote-beacon-tab).
- **Refresh Incident**: reloads the incident's details, including tasked teams and their statuses.

**Incident taskings section**

![Incident popup taskings](images/incident-popup-taskings.png)

- **Team row**: click to zoom to the team's location (if available).
- **Team status**: click to [change the tasking status](tasking.md#tasking-status).
- **Route to Asset** (left button): shows a road route from the team's current location to the incident with an approximate ETA.
- **Fit Bounds** (right button): zooms in as far as possible while keeping both the team and incident in view.

### Hovering over an Incident

Hover over an incident marker to see a quick summary without opening its popup:

- Incident ID, priority and type (including the flood rescue category, e.g. `FR-1`)
- Address
- Situation on scene
- Status and assigned HQ
- ICEMS agencies involved, each with a coloured dot for its status. Hover over an agency to see its status in words.
- Outstanding *action required* tags: the first tag, plus how many more (e.g. *Call Made +1*)

![Incident hover popup](images/incident-hover.png)

| Dot colour | Agency status |
| --- | --- |
| Green | On scene / responded |
| Blue | En route |
| Teal | Acknowledged / will attend |
| Amber | Requested / sent |
| Grey | Left scene / closed |
| Red | Will not attend / timed out |

> **Note:** ICEMS agencies appear once LAD has loaded them for that incident, which happens when you expand the incident in the register or when Beacon pushes an ICEMS update.

### Incident Status on Markers

When enabled under [Map Markers](configuration.md#incident-status-on-markers) (on by default), extra indicators are drawn on incident markers:

| Indicator | Meaning |
| --- | --- |
| <img class="icon" src="images/marker-unacknowledged.png" alt="" height="28"> <img class="icon" src="images/marker-unacknowledged-cluster.png" alt="" height="28"> | **Unacknowledged**: a pulsing yellow circle. Also shown on a cluster that contains an unacknowledged incident. |
| <img class="icon" src="images/marker-active.png" alt="" height="28"> | **Active** (not tasked): a moving purple dotted ring that follows the marker's shape. |
| — | **Tasked**: no extra indicator. |
| <img class="icon" src="images/marker-complete.png" alt="" height="28"> | **Referred, Complete or Finalised**: a black diagonal line through the icon. |
| <img class="icon" src="images/marker-cancelled.png" alt="" height="28"> | **Cancelled or Rejected**: a black cross through the icon. |
| <img class="icon" src="images/marker-action-required.png" alt="" height="28"> | **Action Required**: a red exclamation mark when the incident has an outstanding action required tag, whatever its status. |

### Incident Clustering

Incidents can be clustered to make them easier to access and to deal with overlapping addresses. Clustering is enabled by default and happens in two situations:

- **Incidents at the same address / GPS location**: stops incidents being missed when they're stacked on top of each other. The cluster shows how many incidents are at the location.
- **Incidents close together**: as you zoom out, incidents within a set distance of each other are grouped to keep the map readable.

![Incident cluster](images/marker-cluster.png)

Clusters display as a hexagon. The number inside is the number of incidents in the cluster; a **red** number means at least one is a rescue incident.

The border works like a pie chart of incident priorities, using the same colours as the [Legend](#legend). For example, a cluster of 20 incidents with a border that is half green, a quarter blue and a quarter yellow contains 10 general, 5 immediate and 5 priority incidents.

Clustering settings are under [Incident Marker Clustering](configuration.md#incident-marker-clustering).

## Teams on the Map

Teams are shown at the position reported by their matched radio or satellite tracker. Click a team's marker to see the asset's details, the team it's matched to and that team's taskings. Assets have their own page, covering [radio matching](assets.md#setting-up-a-team-for-radio-tracking), the [asset popup](assets.md#asset-popup), [capability codes](assets.md#capability-codes), [overlapping markers](assets.md#overlapping-asset-markers) and [breadcrumb trails](assets.md#asset-breadcrumb-trails).

## Address Search

Open Address Search by right-clicking the map and choosing **Address Search**, or with the search tool <img class="icon" src="images/icon-map-search.png" alt="Search" height="20"> in the map controls.

![Address Search in the map context menu](images/map-context-address-search.png)

Type an address and results appear automatically. Select a result or press <kbd>Enter</kbd> to go to that address.

![Address search results](images/address-search.png)

## Creating Incidents from the Map

You can create an incident from a map location using reverse geocoding.

1. Right-click the location and choose **Geocode here**.

   ![Geocode here in the map context menu](images/map-context-geocode.png)

2. The map shows the nearest mappable addresses. Your selected location is a **red** pin and the found addresses are **blue** pins. Clicking anywhere else on the map cancels the search.

   ![Geocode results on the map](images/geocode-pins.jpg)

3. Click a blue pin to see the address, its distance from your red pin, the address type (e.g. *PointAddress* or *Street*), the area and the GPS coordinates.

   ![Geocode result details](images/geocode-result.png)

4. Click **Create Incident** to open Beacon's *Create New Incident* page in your [remote tab](getting-started.md#remote-beacon-tab) with the address pre-filled, then create the incident as normal.

## Collaborative Map Layers

Collaborative map layers let users place markers on the map that other users can see. You can create, view and edit multiple collaborative layers at once. Layers are managed on the **Collaborative layers** tab of the [Configuration](configuration.md) screen, and shown or hidden from the map's **Layers** menu.

![Collaborative Layers settings](images/config-collab-layers.png)

### Subscribing to a Layer

1. In Configuration, open the **Collaborative layers** tab and click **Find a layer**. You'll see all layers for the selected headquarters. Click the **X** to remove the headquarters and choose a different one, or leave it blank to search all headquarters.
2. Click **Subscribe** next to the layer you want.

![Subscribe button next to a layer](images/config-collab-subscribe.png)

### Creating a New Layer

On the **Collaborative layers** tab, click **New layer**, enter a layer name and select the headquarters the layer belongs to.

Expand **Advanced options** for more settings:

- **Attach to event**: attach the layer to a specific event.
- **Marker permissions**: who can add, modify and delete markers on the layer.
- **Delete permissions**: who can delete the layer.
- **Comment permissions**: who can comment on markers on the layer.

If any setting gives permissions to moderators, a **Moderators** box appears. Add moderators by searching for their name or member number.

![New layer form with advanced options](images/config-collab-new-layer.png)

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
