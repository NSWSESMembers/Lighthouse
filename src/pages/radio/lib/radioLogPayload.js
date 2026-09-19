/*
  Pure payload/validation logic for a Radio Ops Console entry -- same field
  shape as RadioLogModalVM.js's toPayload()/validate() (src/pages/tasking/
  viewmodels/RadioLogModalVM.js), extracted so it's usable and testable
  without Knockout or a parent tasking view model.
*/

/**
 * @param {object} args
 * @param {string|number|null} args.entityId  HQ/unit this entry is logged against
 * @param {string} args.callsign  used as the entry's Subject
 * @param {string} args.message
 * @param {Array<string|number>} args.tagIds
 * @param {string|number|null} [args.jobId]
 * @param {string|number|null} [args.eventId]
 * @param {string|null} [args.timeLogged]  ISO string; null lets Beacon default to "now"
 * @param {string|number|null} [args.talkgroupId]  resolved via a Talkgroup lookup (see talkgroups.js) --
 *        preferred over the free-text fallback below whenever a lookup match was found
 * @param {string|null} [args.talkgroupFreeText]  used only when no talkgroupId was resolved
 *        (lookup failed, or the typed text didn't match any known talkgroup) --
 *        prepended to the message as "Talkgroup: X" so it's still genuinely
 *        captured rather than silently dropped
 * @param {boolean} [args.important]
 * @param {boolean} [args.restricted]
 * @param {boolean} [args.actionRequired]
 * @param {string|null} [args.actionReminder]  ISO string
 * @returns {object}  Beacon OperationsLog create payload (PascalCase, form-encoded by the caller)
 */
export function buildRadioLogPayload({
  entityId,
  callsign,
  message,
  tagIds,
  jobId = null,
  eventId = null,
  timeLogged = null,
  talkgroupId = null,
  talkgroupFreeText = null,
  important = false,
  restricted = false,
  actionRequired = false,
  actionReminder = null,
}) {
  // `talkgroupId == null` (not a truthy check) -- a resolved talkgroup id of
  // 0 must still count as resolved, so the free-text fallback below doesn't
  // get prepended on top of an already-correct TalkgroupId: 0.
  const text = talkgroupId == null && talkgroupFreeText && talkgroupFreeText.trim() ? `Talkgroup: ${talkgroupFreeText.trim()}\n${message}` : message;
  return {
    EntityId: entityId ?? null,
    JobId: jobId,
    EventId: eventId,
    TalkgroupId: talkgroupId,
    TalkgroupRequestId: null,

    Subject: callsign,
    Text: text,
    Position: null,
    PersonFromId: null,
    PersonTold: null,

    Important: important,
    Restricted: restricted,
    ActionRequired: actionRequired,
    ActionReminder: actionReminder,

    TagIds: tagIds,
    TimeLogged: timeLogged,
  };
}

/**
 * @param {{callsign: string, message: string, tagIds: Array<string|number>}} draft
 * @returns {string[]}  validation errors; empty when the draft can be submitted
 */
export function validateRadioLogDraft({ callsign, message, tagIds }) {
  const errors = [];
  if (!callsign || !callsign.trim()) {
    errors.push('Callsign is required.');
  }
  if (!message || !message.trim()) {
    errors.push('Message text is required.');
  }
  if (!tagIds || tagIds.length === 0) {
    errors.push('At least one tag must be selected.');
  }
  return errors;
}
