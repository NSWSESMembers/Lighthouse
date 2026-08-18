// Confirmed hub method names, taken directly from Beacon's own frontend
// source (its connection.on(...) registrations against this same hub).
// SignalR's JS client matches method names case-insensitively, so casing
// here doesn't matter for dispatch -- kept matching Beacon's own casing
// for clarity when comparing against their source.
//
// Payload shapes, per Beacon's own handlers:
//   jobCreated(vm)   -- full job view-model object
//   jobUpdated(vm)   -- full job view-model object
//   jobRejected(vm)  -- also a full job view-model object (Id, JobId, Entity,
//                        JobPriorityTypeId, JobStatusTypeId, JobIdentifier,
//                        Latitude, Longitude, JobAddress, ...), same shape
//                        family as jobCreated/jobUpdated
//   teamCreated(message) -- confirmed live: a genuinely full Team object
//     (Id, Callsign, AssignedTo/CreatedAt, TeamStatusType: {Id,Name,
//     Description}, Sector, Members (with nested Person + capability tags),
//     TeamType, TaskedJobCount, TeamStatusStartDate, ...) -- matches (or
//     exceeds) what Team.js reads, unlike the job events, so no separate
//     REST fetch is needed to backfill it.
//   teamUpdated(message) -- same shape as teamCreated
//   taskingUpdated(message) -- { Id, JobId, TeamId, EntityId, CurrentStatusId, Sequence, ... }
//   opsLogUpdated(message) -- full OpsLog entry object: { Id, JobId,
//     JobLabel, Entity, Subject, Text, Tags, CreatedOn, CreatedBy, ... }
//   NotificationAcknowledged/IUMReceived/UrgentIUMReceived(message) -- same
//   Notification-record family as jobCreated/jobUpdated/jobRejected (Id =
//   the notification's own id, JobId = the actual job) -- unconfirmed field
//   list beyond JobId, but that's all refreshUnacceptedNotifications needs.
//   rsuReceived/iuaReceived/isuReceived(message) -- assumed same family,
//   JobId = the actual job. Only used to refresh ICEMS agency data.
//
// taskingCreated is NOT confirmed -- Beacon registers created/updated pairs
// for jobs and teams, but only taskingUpdated showed up in the handlers
// seen so far. Registered speculatively on the assumption the pairing is
// symmetric; harmless no-op if the server never actually sends it.
//
// jobRejected was found commented-out in Beacon's own source, using the
// older SignalR v2 client pattern ($.connection.jobHub.client.X) rather than
// the modern connection.on(...) the rest of these use -- it may be dead code
// on a legacy hub rather than something this connection (hub=beacon) will
// ever actually send. Registered anyway since an unmatched guess is a
// harmless no-op.
//
// Any additional method the server sends that isn't listed here is a
// silent no-op now that connection.js logs at Error level -- bump that
// back down to Information temporarily to surface "No client method with
// the name 'X' found" warnings if hunting for further real event names.
export const KNOWN_EVENTS = [
    'jobCreated',
    'jobUpdated',
    'jobRejected',
    'teamCreated',
    'teamUpdated',
    'taskingUpdated',
    'taskingCreated',
    'opsLogUpdated',
    'NotificationAcknowledged',
    'IUMReceived',
    'UrgentIUMReceived',
    'rsuReceived',
    'iuaReceived',
    'isuReceived',
];
