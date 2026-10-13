---
title: Common Functions (moved)
sitemap: false
---

# This page has moved

The topics that were on this page now have their own pages:

- [Spotlight](spotlight.md): the Spotlight menu and the `task`, `radio`, `log` and `find` commands
- [Logs & Messages](logs-and-messages.md): New Radio Log, New Ops Log and Send SMS
- [Tasking Teams](tasking.md): Instant Task, suggestions and drag & drop tasking
- [Interface Overview](interface.md): starring, listing only what's in the map view, and keyboard shortcuts

<script>
	// Old links pointed at sections of this page. Send them to the section's new home.
	(function () {
		var moved = {
			'dialog-controls': 'interface.html#keyboard-shortcuts',
			'spotlight-menu': 'spotlight.html#spotlight-menu',
			'spotlight-commands': 'spotlight.html#spotlight-commands',
			'task-team-command--task': 'spotlight.html#task-team-command--task',
			'radio-log-command--radio': 'spotlight.html#radio-log-command--radio',
			'ops-log-command--log': 'spotlight.html#ops-log-command--log',
			'find-asset-command--find': 'spotlight.html#find-asset-command--find',
			'starring-incidents-and-teams': 'interface.html#starring-incidents-and-teams',
			'listing-only-whats-in-the-map-view': 'interface.html#listing-only-whats-in-the-map-view',
			'new-radio-log': 'logs-and-messages.html#new-radio-log',
			'send-sms': 'logs-and-messages.html#send-sms',
			'sending-sms-for-an-incident': 'logs-and-messages.html#sending-sms-for-an-incident',
			'adding-additional-recipients': 'logs-and-messages.html#adding-additional-recipients',
			'new-ops-log': 'logs-and-messages.html#new-ops-log',
			'tasking-teams-instant-task': 'tasking.html#instant-task',
			'instant-task-suggestions': 'tasking.html#instant-task-suggestions',
			'tasking-the-team': 'tasking.html#tasking-the-team',
			'drag--drop-team-tasking': 'tasking.html#drag--drop-team-tasking'
		};
		var to = moved[decodeURIComponent(location.hash.slice(1))];
		if (to) location.replace(to);
	})();
</script>
