---
title: Logs & Messages
nav_order: 9
---

# Logs & Messages

LAD can create radio logs and ops log entries, and send SMS to team members, without opening Beacon. The buttons are on team rows and taskings in both registers, in the [register controls](interface.md#register-controls), and in incident popups on the map. The Spotlight [`radio`](spotlight.md#radio-log-command--radio) and [`log`](spotlight.md#ops-log-command--log) commands open the same dialogs from the keyboard.

## New Radio Log

Clicking a **Radio Log** button opens the New Radio Log dialog. It is the same dialog as [New Ops Log](#new-ops-log), with the *Radio* contact method already selected. The title shows the team's callsign, plus the incident ID if opened against an incident.

- Clicking Radio Log on a **tasking** (a team on an incident) fills in the **Incident** and **Team** fields, and the subject is the team's callsign. The log is created against that incident, and you can [change the team's status](#changing-the-teams-status) at the same time.
- Clicking Radio Log on a **team** fills in the **Team** field and the subject, but does not associate the log with an incident.
- Clicking Radio Log in the [register controls](interface.md#register-controls) opens the dialog with nothing filled in.

![New Radio Log dialog](images/radio-log-dialog.png)

Add any other tags you need, enter your message in **Text**, then click **Submit**. The entry is created with the tags you selected. If created against an incident, it is visible in that incident's *Notes* / *Ops Log Entries*.

![Resulting radio log entry](images/radio-log-entry.png)

The Spotlight [`radio`](spotlight.md#radio-log-command--radio) command opens a simpler version of the dialog with only a text box. The *Radio* tag and the subject are set for you.

### Changing the Team's Status

When New Radio Log is opened from a tasking, the bottom of the dialog shows the team's current status for that incident, followed by **update to** and a status menu. The menu starts at **No change** and lists the same statuses as [Tasking Status](tasking.md#tasking-status). Statuses the team can't change to from its current status are greyed out.

![Status change in New Radio Log](images/radio-log-status-change.png)

- Picking a status does not change anything straight away. The change is made when you click **Submit**, and the button shows the status, for example **Submit & On site**.
- If the status needs more information (a time, ETA, ETC or reason), a **Status change** box appears at the bottom of the dialog, and the dialog scrolls down to it. It works the same way as in the tasking status dropdown.
- **Complete** opens Beacon's *Team Completion* dialog in the remote tab after the log entry is saved.
- If you change the **Incident** or **Team** field to something else, the status menu is hidden and the status is not changed.

When you click **Submit**, LAD changes the status first and only saves the log entry if that worked:

- If the status change fails, the dialog shows why and stays open. Nothing is logged, so you can fix it or pick **No change** and submit again.
- If the team's status changed while the dialog was open (for example, someone else set it in Beacon) and the status you picked is no longer available, the dialog says so and nothing is submitted.
- If the status changes but the log entry fails to save, the dialog tells you. Submitting again only retries the log entry; the status is not sent twice.

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
