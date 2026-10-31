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

## New Statistics, Summary and Export pages

*27 October 2026*

### Incident Statistics

- **Job Statistics is now Incident Statistics, rebuilt.** It has the same charts, with a cleaner layout that fits any window size and follows your computer's light or dark mode. It's in the Lighthouse menu in Beacon as **Incident Statistics**. See the [Incident Statistics guide](https://lighthouse.ses.nsw.gov.au/guides/stats/).
- **Sleeker, easier-to-read charts.** The pie charts are now donuts with a legend that lists each slice's count and percentage. Hover over a slice or a legend row to highlight both and see the details in the middle. No two slices in a chart share a colour. See [Breakdown](https://lighthouse.ses.nsw.gov.au/guides/stats/#breakdown).
- **Two new charts:** **LGA** (the incident's local government area) and **ICEMS** (how many incidents came in from other agencies through ICEMS). See [Breakdown](https://lighthouse.ses.nsw.gov.au/guides/stats/#breakdown).
- **Charts are grouped and arrangeable.** The breakdown charts are in three groups (Incident, Location, Damage and tags). Drag a chart by its title to move it, or its corner to resize it. Your layout is remembered, and **Reset layout** puts it back. See [Arranging the Charts](https://lighthouse.ses.nsw.gov.au/guides/stats/#arranging-the-charts).
- **The header is coloured by Beacon, as in LAD:** orange for Beacon, green for Train Beacon and blue for Dev Beacon, so you can tell at a glance which one you're looking at.
- **Pick the time range from the toolbar:** as opened, the last 24, 48 or 72 hours, or the last 7 days.
- **Every chart has a reset link** while it's filtered, and **Clear all filters** removes them all. The toolbar shows how many incidents match your filters.
- **The word cloud follows your filters**, like the other charts. Before, it always showed every incident.
- The **25% / 50% / 75% of incidents completed within** figures were swapped, so *25%* showed the time three quarters of incidents were completed within. They're now the right way round.
- The latest incidents table shows each incident's status, and an incident that isn't closed yet shows a dash instead of a blank.
- **See how far a load has got.** While incidents load, a ring counts them as they arrive (e.g. *9,200 of 20,316 incidents*), with the page it's on and the time left. If Beacon is slow to answer, it says so and offers to load the last 24 hours instead. See [Loading](https://lighthouse.ses.nsw.gov.au/guides/stats/#loading).
- If Beacon can't be reached, the page now says why and offers **Try again**, instead of a red progress bar. It also keeps trying by itself, so a screen left showing the statistics recovers when Beacon comes back.

### Incident Summary

- **Job Summary is now Incident Summary, refreshed.** Same layout and colours, with numbers that fit the window, from a phone to a wall screen. The text is now Atkinson Hyperlegible, a typeface designed to keep look-alike characters (1, l and I; 0 and O) apart, so it's easier to read from across the room. It's in the Lighthouse menu in Beacon as **Incident Summary**. See the [Incident Summary guide](https://lighthouse.ses.nsw.gov.au/guides/summary/).
- **The boxes are coloured by Beacon, as in LAD:** orange for Beacon, green for Train Beacon and blue for Dev Beacon.
- **New incidents light up.** When a refresh finds more New incidents, the New number is highlighted for a few seconds, as well as playing your alert sound. See [New Incidents](https://lighthouse.ses.nsw.gov.au/guides/summary/#new-incidents).
- **Pick the time range from the footer:** as opened, the last 24, 48 or 72 hours, or the last 7 days.
- **Simpler colour settings:** follow your computer's light or dark mode, or keep it Light or Dark. Your old theme carries over. The sound setting now has a **Test** button. See [Settings](https://lighthouse.ses.nsw.gov.au/guides/summary/#settings).
- If Beacon is slow or can't be reached, the page now says so and offers **Try again**, instead of a red progress bar. It also keeps trying by itself, so a wall screen recovers when Beacon comes back. A failed refresh keeps the last numbers on screen.
- The page no longer stops loading when Beacon's report leaves out an incident type.

### Incident Export

- **Job Export is now Incident Export, rebuilt.** Same column groups, with a cleaner layout that follows your computer's light or dark mode, and a header coloured by Beacon as in LAD. It's in the Lighthouse menu in Beacon as **Incident Export**. See the [Incident Export guide](https://lighthouse.ses.nsw.gov.au/guides/export/).
- **Preview before you download.** The page shows the newest 10 incidents and how many there are, with the columns you've ticked, changing as you tick. **Download CSV** then fetches every incident, with a ring counting them and a **Cancel** button. See [Preview](https://lighthouse.ses.nsw.gov.au/guides/export/#preview) and [Downloading](https://lighthouse.ses.nsw.gov.au/guides/export/#downloading).
- **Your columns are remembered**, and each group has **All** and **None**. **Reset to the default columns** goes back to the usual set. See [Choosing Columns](https://lighthouse.ses.nsw.gov.au/guides/export/#choosing-columns).
- **Times are in ISO 8601 format** (e.g. *2026-10-15T09:41:00+11:00*), instead of the long *Thu Oct 15 2026 09:41:00 GMT+1100 (…)* text that spreadsheets couldn't sort. See [Downloading](https://lighthouse.ses.nsw.gov.au/guides/export/#downloading).
- **ICEMS update counts are about four times faster**, with a progress bar, and they now include the last incident (the old export always missed it). The preview shows them for its 10 incidents as soon as you tick the column.
- **Premises Access - Info** is filled in. It was always empty before.
- **Acknowledged** is when the incident first went Active, and **Completed** and **Finalised** are the last time it reached that status. Before, ticking Acknowledged could change which Completed and Finalised times you got.
- If Beacon can't be reached, the page says why and offers **Try again**. The page also says so if you tick no columns, and no longer sits on *Loading* when it has no Beacon login.

### NITC Export

- **NITC Export, rebuilt.** The **Export (Filtered)** button on Beacon's NITC screen opens it in a new tab with the screen's filters. Same two reports, Activity List and Member List, with a cleaner layout that follows your computer's light or dark mode, and a header coloured by Beacon as in LAD. See the [NITC Export guide](https://lighthouse.ses.nsw.gov.au/guides/nitc/).
- **Preview before you download.** The page shows the report for the newest 10 tasks and how many tasks match. **Download CSV** then fetches every task, with a ring counting them and a **Cancel** button. Your report choice is remembered. See [Preview](https://lighthouse.ses.nsw.gov.au/guides/nitc/#preview).
- **Participants are written with their hours in square brackets and separated by semicolons**, e.g. *Alex Sample[2.5]; Sam Example[3]*, so a name with round brackets in it can't be mistaken for hours, and a spreadsheet can split the list on *;*. If a spreadsheet or Power Query step reads the old *Alex Sample(2.5) Sam Example(3)* format, it needs updating. See [Activity List columns](https://lighthouse.ses.nsw.gov.au/guides/nitc/#activity-list-columns).
- **The Member List has a TotalHours column**, puts hours from untagged tasks under **No tag** (they were left out before), lists the tags A to Z, and gives two members with the same name a row each (they were added together before). See [Member List columns](https://lighthouse.ses.nsw.gov.au/guides/nitc/#member-list-columns).
- **Times are right, in ISO 8601 format** (e.g. *2026-10-15T09:41:00+11:00*). The old export's times were 11 hours early in daylight saving (10 hours outside it), and in the long *Thu Oct 15 2026 09:41:00 GMT+1100 (…)* text. See [Hours and times](https://lighthouse.ses.nsw.gov.au/guides/nitc/#hours-and-times).
- Task names keep any *#* in them (it used to be removed), and a member with no sign-off time gets the task's end time instead of a nonsense number of hours.
- If Beacon can't be reached, or no tasks match, the page now says so, instead of doing nothing.

### CADence Simulated Exercise

- **Show simulated teams from a CADence training exercise.** On Train Beacon and Test Beacon, the Lighthouse menu has a new **CADence Simulated Exercise** page under **Community Projects**. Choose a running exercise there and its simulated vehicles and vessels take the place of real radio positions in every Lighthouse tab on that Beacon, until you switch back, the exercise ends or you close Chrome. In a group exercise, pick your headquarters: only teams assigned to it get its positions, so a team with the same callsign at another headquarters doesn't take them. See [Choosing an Exercise](https://lighthouse.ses.nsw.gov.au/guides/lad/simulated-exercises.html#choosing-an-exercise).
- **Exercise radio:** the page also has a link and a QR code for CADence's radio join page, so you can join the exercise radio from your phone and talk to the simulated teams. See [Exercise Radio](https://lighthouse.ses.nsw.gov.au/guides/lad/simulated-exercises.html#exercise-radio).
- **In LAD**, the simulated teams move on the map, match their Beacon teams and appear in Instant Task suggestions. A map alert shows while they're on, with a quick way back to real positions. When the exercise ends, LAD switches back to live asset locations and shows a banner with a link to choose another exercise. See [In LAD](https://lighthouse.ses.nsw.gov.au/guides/lad/simulated-exercises.html#in-lad).
- **On Beacon's own maps**, the Nearest Asset Locations map on a job shows the exercise's vehicles and vessels for the job's own headquarters, with a note under the map, and the situational awareness map gets a **Simulated Exercise Assets** layer. See [On Beacon's Job and Situational Awareness Pages](https://lighthouse.ses.nsw.gov.au/guides/lad/simulated-exercises.html#on-beacons-job-and-situational-awareness-pages).
- **A reminder in Beacon:** while an exercise is chosen, a **Simulated locations** pill next to the **Lighthouse** menu on every Beacon page says the locations Lighthouse shows aren't live. Click it to change or stop the exercise. See [Choosing an Exercise](https://lighthouse.ses.nsw.gov.au/guides/lad/simulated-exercises.html#choosing-an-exercise).
- The [privacy policy](https://lighthouse.ses.nsw.gov.au/privacy/#the-cadence-exercise-service) now covers the CADence exercise service: what Lighthouse sends to it, and what it keeps.

### LAD

- **Reorder and fade any map layer.** The new **Map layers** tab of the **Configuration** screen lists every map layer, each overlay on its own, instead of the five fixed groups that were under **Map markers**. Drag a layer or use the arrows to move it, use the slider to make it see-through (BOM Rain Radar Still now starts at 50%, so roads and boundaries show through), and turn it on or off with its switch. Search the list, or show only the layers on the map. Layers showing now are marked **On map**. To get there from the map, use the new button next to the search bar in the **Layers** menu. See [Map Layers](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#map-layers).
- **The RainViewer radar playback bar no longer covers the map.** It's now a small **Radar** bar above the Legend showing play/pause, the frame time and how far behind the latest frame it is. Click it to open the slider, step buttons, speed and colour scale. Its opacity slider has moved to the **Map layers** tab (still 60% to start). See [Overlay Notes](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#overlay-notes).
- **The Layers menu fits smaller screens.** Instead of every group side by side, it has a list of sections down the left: **Basemap**, **On the map** and each group of overlays, with a count of how many layers are on in each. It sizes itself to the map, so it no longer runs off the edge or under the Legend, and on a narrow map the sections become a row of buttons. Basemaps are now pictures to pick from in the **Basemap** section, and search finds basemaps as well as overlays. See [Layers](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#layers).
- **Performance improvements** for LAD left open for a long time.
- **The pulsing ring on New incidents and the marching ring on Active incidents now move with their marker.** They used to stay behind for a moment when markers gathered into a cluster or spread out of one, and could go missing until the next zoom. See [Incident Clustering](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#incident-clustering).
- With clustering turned off, an incident that drops off the list now disappears from the map too.
- **BOM Thunderstorm Tracking is now drawn above BOM Rain Radar Still** by default, so storm cells and their tracks aren't hidden under the rain. If you've already arranged your layers, use **Reset** on the Map layers tab to get the new order. See [Map Layers](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#map-layers).

## LAD arrival times, overlay status and street zoom

*26 October 2026 · [v2026.10.26](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.26)*

### Arrival times and the status menu

- **See when teams will arrive and finish.** When a team is En-Route with an ETA, or On-Site with an ETC, LAD counts down to it in the Team Register, the Incident Register, expanded teams and incidents, the map popups and the incident hover tooltip. Blue is on track, amber is due within 5 minutes and red is overdue. Hover over a countdown to see the clock time. See [Arrival and Completion Times](https://lighthouse.ses.nsw.gov.au/guides/lad/tasking.html#arrival-and-completion-times).
- **New alert: Teams overdue on ETA/ETC.** Lists teams that are 5 minutes or more past their ETA or ETC. Click a team to jump to it. See [Alerts](https://lighthouse.ses.nsw.gov.au/guides/lad/interface.html#alerts).
- A team's ETA and ETC now update in LAD when they're changed in Beacon. Before, LAD kept showing the time from when the tasking first loaded.
- **A clearer status menu.** A tasking's status menu now shows its progress, leads with the next step, and lists skip-aheads (including Complete) and Call off / Remove tasking separately. See [Tasking Status](https://lighthouse.ses.nsw.gov.au/guides/lad/tasking.html#tasking-status).
- **Change a team's ETA or ETC without changing its status.** Click **Change** next to the ETA or ETC in the status menu, add time with the +5 to +60 buttons (each click adds on) or type a time, and save. The team's En route or On site time stays the same. See [Changing the ETA or ETC](https://lighthouse.ses.nsw.gov.au/guides/lad/tasking.html#changing-the-eta-or-etc).
- **Correct an earlier status on purpose.** Setting a tasking back, e.g. On site to En route, is now under **Correct an earlier status…**, shows which status times Beacon will clear, and needs a tick to confirm. See [Correcting an Earlier Status](https://lighthouse.ses.nsw.gov.au/guides/lad/tasking.html#correcting-an-earlier-status).
- **Call off is only offered when Beacon will accept it.** LAD now uses the same rule as Beacon's own screens, so it no longer offers Call off for a team that has been on site (unless corrected back to En route) or Off site. If Beacon still refuses a status change, call off or remove, LAD now shows Beacon's reason instead of failing silently.

### Map

- The Layers menu now shows whether each overlay loaded. A spinner shows while it loads, then the number of items it put on the map, *Nothing to show right now* if it loaded empty, or **failed** with the reason and a **Retry** link. Before, an overlay that failed looked the same as one with nothing to show. See [Overlay Loading Status](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#overlay-loading-status).
- If an overlay loaded but a later refresh fails, it keeps showing what it last loaded and is marked **stale** with the time of that data.
- The Layers button shows a spinner while overlays load and a red number when any have failed, so you can see problems with the menu closed, including overlays switched on from your last session.
- **BOM Land Warnings now shows thunderstorm warnings.** Their areas were never drawn before, because LAD asked the BOM service for details it doesn't have.
- **Double-click an incident's address to zoom in to street level.** A single click still focuses the map on the incident and opens its popup. A double-click goes on to street level, so you can see the exact location. This also works on the zoom button in an expanded team's taskings. See [Incident Register](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html).
- The **Transport NSW Incidents** overlay now also shows road closures and hazards reported by local councils, such as regional road closures and flooded causeways. Their popups are titled *Council Report*. The separate **Transport NSW Council Reports** overlay has been folded into it. See [Clickable Overlay Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#clickable-overlay-markers).
- Transport NSW incident markers use the same icons as Live Traffic NSW, so flooding, fire, bad weather, and snow and ice each have their own icon instead of the general hazard icon.
- Closed or affected stretches of road are drawn on the map as coloured lines, and affected areas as shaded areas, as on Live Traffic NSW. Click one for the incident's details.
- Transport NSW incident popups no longer show *Speed Limit: -1 km/h* or a list of *Unknown* fields. They show only the details the report includes, the way Live Traffic NSW does, and the speed limit appears in the advice only when it has been reduced. Popups also say who reported the incident, and council reports include the council's contact details.
- If you use a basemap other than Esri Topographic, the map no longer loads Esri Topographic underneath it as well. Panning and zooming download fewer map tiles, so the map is quicker on slow connections. If you use Esri Topographic, nothing changes.
- You can still zoom in as far as before on Esri Dark.
- Panning back and forth over the same area shows fewer grey squares, because the map keeps more of the surrounding map tiles loaded.
- Dragging the map onto new ground shows fewer grey squares too, because the map loads a row of tiles just past each edge before you get there. This is turned off on slow connections and when Chrome's data saving is on, so it doesn't use extra data there. It doesn't apply to the NSW Vector basemap.

### Incidents and teams

- The photo icon on incident rows shows again for every incident with photos. A Beacon change meant it only appeared on incidents that had a team tasked, and not always then.
- The photo icon now turns blue when you hover over it, so it's clear you can click it to view the photos.
- LAD makes fewer requests to Beacon each time it refreshes incidents.
- Spotlight no longer matches incidents by sector name.
- Clicking a tasked team in an incident's popup now opens that team in the Team Register even if it has no tracked vehicle or radio. Before, nothing happened. See [Incident Popup Actions](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#incident-popup-actions).

### Radio logs and exports

- If Beacon returns an error when a radio or ops log changes a team's status or tasks a team, LAD now checks whether the change went through anyway. If it did, the log entry is saved as normal. Before, the dialog reported a failure and didn't save the log, and submitting again was refused by Beacon. See [Changing the Team's Status](https://lighthouse.ses.nsw.gov.au/guides/lad/logs-and-messages.html#changing-the-teams-status).
- When a status change or tasking from a log does fail, the dialog shows Beacon's reason followed by *Try again*.
- NITC Export and Advanced Export CSV files no longer break when a field contains quotation marks or line breaks, so they open correctly in Excel and import into ArcGIS. Line breaks within a field become spaces.

## LAD radio log status changes and Spotlight commands

*21 October 2026 · [v2026.10.20](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.20)*

### Radio and ops logs

- **Change a team's status from a radio log.** When a radio or ops log's **Incident** and **Team** fields point at a team tasked to that incident (straight away when you open **Radio Log** from a tasking, or once you fill them in), the bottom of the dialog shows the team's current status with an **update to** menu. The new status is only set when you click **Submit**, and the log entry is only saved if the status change worked. If it doesn't, the dialog explains why and nothing is logged. See [Changing the Team's Status](https://lighthouse.ses.nsw.gov.au/guides/lad/logs-and-messages.html#changing-the-teams-status).
- **Task a team from a radio or ops log.** If the team in the log isn't tasked to the incident, choose **Task Team** or **Task Team & SMS** at the bottom of the dialog. The team is tasked when you click **Submit**, before the log entry is saved, and **Task Team & SMS** opens Send SMS once the dialog closes. See [Tasking the Team from a Log](https://lighthouse.ses.nsw.gov.au/guides/lad/logs-and-messages.html#tasking-the-team-from-a-log).
- **Radio Log on teams and taskings, and the Spotlight `radio` command, open the full dialog.** It now uses the same dialog as New Ops Log, with the *Radio* tag already selected, so you can add other tags. The incident, team and subject are filled in for you. See [New Radio Log](https://lighthouse.ses.nsw.gov.au/guides/lad/logs-and-messages.html#new-radio-log).
- If a log entry fails to save, the **Submit** button no longer stays stuck on *Submitting…*.
- In dark mode, selected tags in the New Ops Log and New Radio Log dialogs are readable.

### Spotlight

- **SMS a team from Spotlight.** Type `msg` and a team's callsign, then press Enter to open the Send SMS dialog for that team. See [SMS Team command](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html#sms-team-command--msg).
- **Call off a team from Spotlight.** Type `calloff` with a team and an incident, in either order, then press Enter and give a reason. Only taskings that can be called off are offered. See [Call Off command](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html#call-off-command--calloff).
- **Spotlight help.** Click the **?** button in Spotlight, or type `?`, to see all the commands, what you can search for and the keyboard shortcuts. Click a command to start it. See [Spotlight](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html).
- The Spotlight `radio` command now lists teams when you type the incident before the team.

### Map

- The *SES Unit Locations* overlay is now called *SES Units*, and its popup has a cleaner layout. Long contact details no longer spill out of the popup, and the unit's status now shows correctly: it always said *Not Monitoring* before. Units with a hyphen in their name, such as Waverley-Woollahra, now load their details. See [Overlays](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#overlays).

## LAD map and dark mode fixes

*15 October 2026 · [v2026.10.14](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.14)*

- **Clicking an incident in an alert works when the Incidents layer is hidden.** The map turns the layer back on, zooms to the incident and opens its popup. This also applies to Spotlight. See [Overlays](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#overlays).
- Hiding the **Incidents** layer now also hides the unacknowledged and Active rings, and rescue markers when they aren't clustered. Before, these stayed on the map.
- The Active ring follows the shape of the incident marker (square, diamond, triangle and so on) instead of always being a circle. See [Incident Status on Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#incident-status-on-markers).
- **Incidents with no GPS location can't be zoomed to.** The address in the Incident Register is shown in italics and can't be clicked, and a tasking's **Focus on map** button is greyed out. Hover over either to see why. Incidents with no address or GPS location show *No location* instead of "null, null". See [Incident Register](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html).
- In dark mode, statuses that a tasking or incident can't change to are greyed out in the status menus, the **En route** and **On site** tasking statuses are readable, and boundary and FRAO labels on the map are dark again.

## LAD user guide reorganised, with search

*14 October 2026*

- **The LAD user guide has been reorganised** so it follows the order you'd use LAD: getting started, the interface, the map and registers, then tasking, logs and messages. Configuration is now a reference page at the end. See the [LAD User Guide](https://lighthouse.ses.nsw.gov.au/guides/lad/).
- Topics that were split across pages now have one page each: [Assets & Radio Tracking](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html), [Tasking Teams](https://lighthouse.ses.nsw.gov.au/guides/lad/tasking.html), [Logs & Messages](https://lighthouse.ses.nsw.gov.au/guides/lad/logs-and-messages.html) and [Spotlight](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html). ICEMS is now part of the [Incident Register](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html#icems) page. Old links still take you to the right section.
- **Search the guide.** Type in the search box at the top of the guide's sidebar (or press <kbd>/</kbd>) and matching sections are listed as you type. Pick one to jump to it, with your search words highlighted.

## LAD capability codes, marker spreading and trails

*12 October 2026 · [v2026.10.12](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.12)*

- **Capability codes on asset markers.** Every asset marker shows a short code for its capability, such as HRV (Heavy Rescue), MSV (Medium Storm) or CFR, so capabilities with similar colours can be told apart. Vessels show their class: VC1 to VC4, or VES if the class isn't known. The map legend lists every code, and you can turn the codes off under **Asset markers**. See [Capability Codes](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#capability-codes).
- More capabilities have their own colour and code, including High Clearance, Support, Cell on Wheels, General Land Rescue and Corporate Command. Vessels whose capability is their class now show as vessels, and assets with an unknown capability are grey instead of Command blue.
- **Find any asset from Spotlight.** Type `find` and part of a callsign, PSN ID or satellite ID to list matching assets, then press Enter to zoom to one. See [Spotlight Commands](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html#spotlight-commands).
- The Trackable Assets Library can be filtered by **Capability**. See [Trackable Assets Library](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#trackable-assets-library).
- **Breadcrumb trails.** While an asset's popup is open, a fading line through its recent positions shows where it has come from. Change the trail length (30 minutes by default) or turn it off under **Asset markers**. See [Asset Breadcrumb Trails](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#asset-breadcrumb-trails).
- **Overlapping asset markers spread out.** When zoomed in to street level, asset markers that would sit on top of each other swing around the vehicle's position so each one can be seen and clicked. Where there isn't room, a marker moves out on a line back to a dot where the vehicle is. See [Overlapping Asset Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#overlapping-asset-markers).
- The asset marker whose popup is open is drawn on top and highlighted, and its popup opens over the marker rather than beside it.
- The **Map markers** settings are grouped into **Incident markers**, **Asset markers** and **All markers** sections. Under **Asset markers** you can turn the spreading off, choose the zoom level it starts at, and stop markers moving out on lines. See [Asset Markers](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html#asset-markers).
- Panning the map stays smooth with many asset markers shown, including after zooming out and back in.
- Asset markers now point exactly at the vehicle's position (they sat a few pixels low).
- A marker that has to move aside keeps its side when you zoom a step, and swings round the far side of a parked vehicle instead of over it.
- The asset icons in the map legend are all the same pin shape again.
- The section arrows in the Configuration tabs are visible in dark mode.

## LAD satellite trackers and asset library

*7 October 2026 · [v2026.10.07.1](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.07.1)*

- **Satellite-tracked assets.** Assets located by a satellite tracker show a satellite icon next to their last-seen time, crossed out if the tracker isn't active. The asset popup and the Trackable Assets Library show the tracker's class, status and battery. See [Satellite-Tracked Assets](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#satellite-tracked-assets).
- **Show an asset on the map from the Trackable Assets Library.** Each entry has a **Show on map** button that focuses the map on the asset and opens its popup, turning on the asset layer it needs. See [Showing an Asset on the Map](https://lighthouse.ses.nsw.gov.au/guides/lad/assets.html#showing-an-asset-on-the-map).
- The Trackable Assets Library can be filtered by **Type** and by location **Source** (satellite tracker or PSN radio), and searched by satellite ID.
- The Trackable Assets Library can also be opened from the bottom of the [Configuration](https://lighthouse.ses.nsw.gov.au/guides/lad/configuration.html) tabs.

## LAD "In map view" filter and a user guide

*6 October 2026 · [v2026.10.06](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.10.06)*

- **In map view filter.** The Team and Incident registers have a new **Toggle In Map View** button that lists only the teams or incidents inside the area you're looking at on the map. The register header shows how many are in view out of the total. See [Listing Only What's in the Map View](https://lighthouse.ses.nsw.gov.au/guides/lad/interface.html#listing-only-whats-in-the-map-view).
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

- **Collaborative map layers.** Create a shared layer for an HQ or event, drop markers on it and comment on them. Owners and moderators control who can edit, delete or comment. See [Collaborative Map Layer](https://lighthouse.ses.nsw.gov.au/guides/lad/situation-map.html#collaborative-map-layers).
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
- **ICEMS** messages are handled in LAD, with each agency's status shown. See [ICEMS](https://lighthouse.ses.nsw.gov.au/guides/lad/incident-register.html#icems).
- **Dark mode**, incident marker clustering, distance tools and **Create Incident at Location** on the map.
- About 30 new map layers, including NSW Declared Dams.
- The alerts panel can be collapsed, and incident cards show how long ago they were refreshed.
- Much faster loading and refreshing when there are lots of incidents.

## LAD Spotlight, map tools and new layers

*February 2026 · [v2026.02.03](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.02.03) to [v2026.02.14](https://github.com/NSWSESMembers/Lighthouse/releases/tag/v2026.02.14)*

- **Spotlight search** (with commands) and new map tools in LAD. See [Spotlight Menu](https://lighthouse.ses.nsw.gov.au/guides/lad/spotlight.html#spotlight-menu).
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
