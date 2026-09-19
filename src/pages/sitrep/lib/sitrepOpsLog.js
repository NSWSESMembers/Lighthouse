/*
  Adding the finished sitrep to Beacon's Operations Log. Same payload shape
  as the radio console / tasking Ops Log modal (OpsLogModalVM.toPayload), with
  the tags every sitrep entry carries: Contact Types = SES, and Entry Purpose =
  Information + Update (two separate Entry Purpose tags in Beacon, ids 4 and
  5; SES is id 15). Tag group ids as in tasking.html's Ops Log modal:
  2 = Contact Types, 4 = Entry Purpose.
*/

export const CONTACT_TYPES_GROUP_ID = 2;
export const ENTRY_PURPOSE_GROUP_ID = 4;
export const ACTION_ITEMS_GROUP_ID = 27;

// The tag groups the tasking Ops Log modal offers, in its order
export const OPS_LOG_TAG_GROUPS = [
  { id: 2, title: 'Contact Types' },
  { id: 3, title: 'Contact Methods' },
  { id: 4, title: 'Entry Purpose' },
  { id: 27, title: 'Action Items' },
];

export const SUBJECT_LIMIT = 50; // the tasking modal's own subject maxlength
export const TEXT_LIMIT = 4000; // ...and its text maxlength

const norm = (name) => (name || '').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim().toLowerCase();

// Pre-selected for every sitrep entry (ids for reference: SES 15, Information 4, Update 5)
const DEFAULT_TAGS = { 2: ['ses'], 4: ['information', 'update'] };

/** @returns {boolean} whether this tag is one every sitrep Ops Log entry starts with */
export function isDefaultSitrepTag(groupId, tagName) {
  return (DEFAULT_TAGS[groupId] || []).includes(norm(tagName));
}

/**
 * The default tags (group -> name) not present in the loaded tag lists, so
 * the modal can say so rather than silently opening without them.
 *
 * @param {Record<number, Array<{Name: string}>>} tagsByGroup
 * @returns {string[]}
 */
export function missingDefaultTags(tagsByGroup) {
  const missing = [];
  Object.entries(DEFAULT_TAGS).forEach(([groupId, names]) => {
    names.forEach((name) => {
      if (!(tagsByGroup[groupId] || []).some((t) => norm(t.Name) === name)) missing.push(name);
    });
  });
  return missing;
}

/**
 * @param {object} args
 * @param {string|number} args.entityId  the HQ the entry is logged against
 * @param {string} args.subject
 * @param {string} args.text  the sitrep
 * @param {number[]} args.tagIds
 * @param {string|number|null} [args.eventId]
 */
export function buildSitrepOpsLogPayload({ entityId, subject, text, tagIds, eventId = null }) {
  return {
    EntityId: entityId,
    JobId: null,
    EventId: eventId,
    TalkgroupId: null,
    TalkgroupRequestId: null,

    Subject: subject,
    Text: text,
    Position: null,
    PersonFromId: null,
    PersonTold: null,

    Important: false,
    Restricted: false,
    ActionRequired: false,
    ActionReminder: null,

    TagIds: tagIds,
    TimeLogged: null,
  };
}

/**
 * @param {{eventName?: string, sitrepNumber?: string}} header
 * @returns {string}  e.g. "Sitrep #3 - Flooding - New England", cut to the Ops Log subject limit
 */
export function sitrepOpsLogSubject({ eventName, sitrepNumber }) {
  return ['Sitrep' + (sitrepNumber ? ` #${sitrepNumber}` : ''), eventName].filter(Boolean).join(' - ').slice(0, SUBJECT_LIMIT);
}
