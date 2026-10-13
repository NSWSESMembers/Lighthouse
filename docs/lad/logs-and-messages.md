---
title: Logs & Messages
nav_order: 9
---

# Logs & Messages

LAD can create radio logs and ops log entries, and send SMS to team members, without opening Beacon. The buttons are on team rows and taskings in both registers, in the [register controls](interface.md#register-controls), and in incident popups on the map. The Spotlight [`radio`](spotlight.md#radio-log-command--radio) and [`log`](spotlight.md#ops-log-command--log) commands open the same dialogs from the keyboard.

## New Radio Log

Clicking a **Radio Log** button opens the New Radio Log dialog. The title shows the team's callsign, plus the incident ID if opened against an incident.

- Clicking Radio Log against a **team on an incident** creates the log against that incident.
- Clicking Radio Log against the **team** itself does not associate it with an incident.

![New Radio Log dialog](images/radio-log-dialog.png)

Clicking **Submit** creates a new ops log entry. The subject is the team's Beacon name followed by your message, and the entry has the *Radio* tag applied. If created against an incident, it is visible in that incident's *Notes* / *Ops Log Entries*.

![Resulting radio log entry](images/radio-log-entry.png)

## New Ops Log

Clicking an **Ops Log** button opens the New Ops Log dialog. It works the same way as Beacon notes: select tags, enter a subject and text. If opened from an incident it is automatically attached to that incident. You can also enter a team to pre-fill the subject with the team's name.

You must select at least one tag and enter text before clicking **Submit**.

![New Ops Log dialog](images/new-ops-log.png)

Ops log entries for an incident are shown in its [Incident Timeline](incident-register.md#incident-timeline).

## Send SMS

Clicking an **SMS** button opens the Send SMS dialog, listing every team member and their SMS number from their Beacon contact details.

Choose recipients with the checkbox next to each member, then click **Send**. Setting **Operational** to *Yes* marks it as an operational SMS in the Beacon message register.

![Send SMS dialog](images/send-sms.png)

### Sending SMS for an Incident

If you click Send SMS against a team tasked to an incident, the message is pre-filled with the incident ID and address. Messages sent against an incident also appear in that incident's *Messages* section.

![Send SMS pre-filled for an incident](images/send-sms-incident.png)

**Task & SMS Details** in [Instant Task](tasking.md#tasking-the-team) opens the same dialog after tasking the team.

### Adding Additional Recipients

Add recipients by searching in the **Add recipient** field: individual members by name or member number, or contact groups by group name. The search covers all members and contact groups statewide.

![Adding a contact group recipient](images/send-sms-add-recipient.png)
