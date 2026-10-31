---
title: Simulated Exercises
nav_order: 12
---

# Simulated Exercises

*Train Beacon and Test Beacon only.*

During a training exercise run with CADence, the simulated teams' vehicles and vessels can be shown in place of real radio positions: in LAD, on the **Nearest Asset Locations** map of a job, and on the situational awareness map. Satellite trackers still show as normal.

## Choosing an Exercise

The exercise is chosen on the **CADence Simulated Exercise** page. Open it from the **Lighthouse** menu in Beacon, under **Community Projects**. It's only in the menu on Train Beacon and Test Beacon.

1. The page lists the exercises running on that Beacon.
2. Pick the exercise, then your headquarters under **Your headquarters**. In a group exercise each headquarters has its own copy of the teams, with the same callsigns, so pick the one you're working from. The page picks it for you when your Beacon headquarters is one of them. An individual exercise has one headquarters, which is shown but can't be changed.
3. Click **Show simulated assets**.

The choice applies to every Lighthouse tab on that Beacon, including LAD tabs that are already open. It lasts until you click **Show real radio positions**, the exercise ends, or you close Chrome. To follow another headquarters or exercise, pick it and click **Switch to this exercise**.

While it's on, every Beacon page on that Beacon shows a **Simulated locations** pill next to the **Lighthouse** menu, as a reminder that the locations Lighthouse shows aren't live. Hover over it for the exercise's name, or click it to open the CADence Simulated Exercise page.

The exercise list and positions come from the CADence exercise service, which checks your Beacon sign-in. Nothing is sent to it until you open the page. See [the CADence exercise service](https://lighthouse.ses.nsw.gov.au/privacy/#the-cadence-exercise-service) in the privacy policy.

## Exercise Radio

The CADence Simulated Exercise page also has an **Exercise radio** section, with a link and a QR code for CADence's radio join page. Join the exercise radio there to talk to the simulated teams. It's best to join from a phone: scan the QR code with your phone's camera.

To join, you need the exercise's join code. For an individual exercise it's shown in CADence. For a group exercise, your facilitator gives it to you.

## In LAD

The simulated vehicles and vessels move on the [Situation Map](situation-map.md), match their Beacon teams the same way radios do (see [Setting up a Team for Radio Tracking](assets.md#setting-up-a-team-for-radio-tracking)) and appear in [Instant Task suggestions](tasking.md#instant-task-suggestions).

LAD only reads the positions for the headquarters you picked, and only gives them to teams assigned to that headquarters. A team with the same callsign at another headquarters shows no simulated position, rather than one that belongs to a different copy of the exercise.

While simulated assets are shown, a **Simulated exercise assets** [alert](interface.md#alerts) on the map counts the simulated positions. Open it to change exercise, which opens the CADence Simulated Exercise page, or to stop and show real radio positions again everywhere.

When the exercise ends, LAD goes back to live asset locations and puts up a banner at the top right of the map saying the exercise has ended, with a **Choose another exercise** link to the CADence Simulated Exercise page. The banner stays until you close it or choose another exercise. LAD does the same if the CADence exercise service stops accepting your Beacon sign-in.

## On Beacon's Job and Situational Awareness Pages

These maps show where each simulated vehicle and vessel is. They don't match them to teams.

- **Job page:** the **Nearest Asset Locations** map and table show the exercise's vehicles and vessels in place of radio positions, and a note under the map names the exercise. They come from the copy for the job's own headquarters, which in a group exercise may not be the one you picked. A job at a headquarters with no copy in the exercise shows real radio positions. Satellite trackers still show as normal.
- **Situational awareness map:** a **Simulated Exercise Assets** layer appears under **Lighthouse > NSW SES**, next to **Filtered Asset Locations**, which keeps showing real positions. Turn it on to see the exercise's vehicles and vessels. It updates every 30 seconds and stays on for the next exercise until you turn it off.

When no exercise is chosen, these pages show real positions and the layer's button goes away.
