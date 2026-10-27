/*
  Turns Beacon job search results (ViewModelType 6) into flat "facts" for
  crossfilter. Pure: no DOM, no network; the cluster table is passed in.
*/

// JobStatusType ids (see tasking/utils/enum.js).
const STATUS_ACTIVE = 2;
const STATUS_COMPLETE = 6;
const STATUS_CANCELLED = 7;
const STATUS_FINALISED = 8;
const CLOSED_STATUSES = new Set([STATUS_COMPLETE, STATUS_CANCELLED, STATUS_FINALISED]);

// Beacon's statewide entity: a unit whose parent is this sits directly under State.
const STATE_ENTITY_ID = 1;

// Tag groups that feed the tag charts.
const HAZARD_TAG_GROUPS = new Set([7, 8, 9]);
const PROPERTY_TAG_GROUPS = new Set([10, 11, 13]);

// "Storm Damage Aggregate": which storm-damage kinds a job's tags cover.
const STORM_DAMAGE_KINDS = {
  Damage: ['Roof Damage', 'Ceiling Damage', 'Door Damage', 'Wall Damage', 'Window Damage', 'Threat of Collapse'],
  Leak: ['Leaking Roof'],
  Tree: ['Tree Down', 'Branch Down', 'Tree Threatening', 'Branch Threatening'],
};

export const NOT_APPLICABLE = 'N/A';
export const FROM_ICEMS = 'ICEMS';
export const NOT_ICEMS = 'Not ICEMS';
export const UNASSIGNED = 'Unassigned';

/**
 * @param {string[]} tagNames
 * @returns {string}  e.g. "Damage+Tree", or "N/A" when none apply
 */
export function stormDamageAggregate(tagNames) {
  const names = new Set(tagNames);
  const kinds = Object.keys(STORM_DAMAGE_KINDS)
    .filter((kind) => STORM_DAMAGE_KINDS[kind].some((n) => names.has(n)))
    .sort();
  return kinds.length ? kinds.join('+') : NOT_APPLICABLE;
}

/**
 * Received, closed and time-to-complete from the status history.
 *
 * `closed` is the first Complete/Cancelled/Finalised entry (null while
 * open). `durationMs` runs from the first Active to the first Complete, and
 * is 0 when the job never went through both (those jobs are left out of
 * the completion-time figures).
 *
 * @param {Array<{Type: number, Timelogged: string}>} history
 */
export function statusTimes(history = []) {
  let firstActive = null;
  let firstComplete = null;
  let closed = null;
  for (const h of history) {
    const at = new Date(h.Timelogged);
    if (h.Type === STATUS_ACTIVE && !firstActive) firstActive = at;
    if (h.Type === STATUS_COMPLETE && !firstComplete) firstComplete = at;
    if (CLOSED_STATUSES.has(h.Type) && !closed) closed = at;
  }
  const durationMs = firstActive && firstComplete ? Math.max(0, firstComplete - firstActive) : 0;
  return { closed, durationMs };
}

/** Zone name for the assigned entity (a zone is its own zone). */
export function zoneName(entity) {
  if (!entity) return NOT_APPLICABLE;
  if (!entity.ParentEntity) return entity.Name; // State itself
  return entity.ParentEntity.Id === STATE_ENTITY_ID ? entity.Name : entity.ParentEntity.Name;
}

/** ReferringAgency is usually a plain string; tolerate an {Name} object. */
export function agencyName(agency) {
  if (!agency) return NOT_APPLICABLE;
  if (typeof agency === 'object') return agency.Name || agency.Code || NOT_APPLICABLE;
  return String(agency);
}

/**
 * unitClusters.json is keyed by unit name with "Name-Name" rather than
 * Beacon's "Name - Name".
 */
export function clusterName(unitName, clusters) {
  const entry = clusters?.[String(unitName || '').replace(' - ', '-')];
  return entry ? entry.clusterName : 'Unknown';
}

/**
 * @param {object} job  Beacon job (ViewModelType 6)
 * @param {{clusters?: object}} [opts]
 * @returns {object} fact
 */
export function prepareJob(job, { clusters = null } = {}) {
  const tags = job.Tags || [];
  const { closed, durationMs } = statusTimes(job.JobStatusTypeHistory);
  const unit = job.EntityAssignedTo || {};
  return {
    id: job.Id,
    identifier: job.Identifier,
    received: new Date(job.JobReceived),
    closed,
    durationMs,
    status: job.JobStatusType?.Name || NOT_APPLICABLE,
    type: job.Type || job.JobType?.Name || NOT_APPLICABLE,
    priority: job.JobPriorityType?.Name || NOT_APPLICABLE,
    agency: agencyName(job.ReferringAgency),
    event: job.Event?.Identifier || NOT_APPLICABLE,
    unit: unit.Name || NOT_APPLICABLE,
    cluster: clusterName(unit.Name, clusters),
    zone: zoneName(job.EntityAssignedTo),
    sector: job.Sector?.Name || UNASSIGNED,
    category: job.Categories?.[0]?.Name || UNASSIGNED,
    locality: job.Address?.Locality || NOT_APPLICABLE,
    lga: job.LGA || NOT_APPLICABLE,
    // Came in from another agency through ICEMS (has an ICEMS incident id).
    icems: job.ICEMSIncidentIdentifier ? FROM_ICEMS : NOT_ICEMS,
    address: job.Address?.PrettyAddress || '',
    situation: job.SituationOnScene || '',
    stormDamage: stormDamageAggregate(tags.map((t) => t.Name)),
    hazardTags: tags.filter((t) => HAZARD_TAG_GROUPS.has(t.TagGroupId)).map((t) => t.Name),
    propertyTags: tags.filter((t) => PROPERTY_TAG_GROUPS.has(t.TagGroupId)).map((t) => t.Name),
  };
}

export function prepareJobs(jobs, opts) {
  return jobs.map((j) => prepareJob(j, opts));
}

/**
 * Distinct events across the jobs, as "IDENT - Name", in first-seen order.
 * @returns {string[]}
 */
export function eventLabels(jobs) {
  const seen = new Set();
  for (const j of jobs) {
    if (j.Event) seen.add(`${j.Event.Identifier} - ${j.Event.Name}`);
  }
  return [...seen];
}
