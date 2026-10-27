/*
  The columns Incident Export offers, and how each one's value comes out of
  a Beacon Jobs/Search result (ViewModelType 6).

  `key` is the CSV header, kept as the Beacon field path the old page wrote
  ("JobReceived", "Address.Street") so spreadsheets built on its exports
  still line up. `label` is what the page shows. Most values are read
  straight off the incident by path; the rest have a `value` function.

  Pure: no DOM, no Beacon calls (the ICEMS update counts are fetched by
  icemsUpdates.js and passed in).
*/

import { isoDateTime } from './dates.js';

/** Status history entries named `name`, oldest first. */
function statusTimes(job, name) {
  return (job.JobStatusTypeHistory || [])
    .filter((h) => h && h.Name === name && h.Timelogged)
    .map((h) => h.Timelogged)
    .sort();
}

const firstTime = (name) => (job) => isoDateTime(statusTimes(job, name)[0]);
const lastTime = (name) => (job) => isoDateTime(statusTimes(job, name).at(-1));
const names = (list) => (list || []).map((x) => x && x.Name).filter(Boolean).join(',');

/**
 * @typedef {object} Field
 * @property {string} key      CSV header and saved-choice id
 * @property {string} label
 * @property {boolean} [default]  ticked when nothing has been saved
 * @property {(job: object, extra: {icemsUpdates?: Map}) => any} [value]
 * @property {boolean} [needsIcemsUpdates]  needs the Ops Log counts (icemsUpdates.js)
 */

/** @type {Array<{title: string, fields: Field[]}>} */
export const FIELD_GROUPS = [
  {
    title: 'Incident details',
    fields: [
      { key: 'Identifier', label: 'Id', default: true },
      { key: 'ICEMSIncidentIdentifier', label: 'ICEMS Id' },
      { key: 'ReferringAgency', label: 'ICEMS Originator' },
      { key: 'JobReceived', label: 'Received', default: true, value: (j) => isoDateTime(j.JobReceived) },
      // When it was first acknowledged; completed and finalised as last
      // recorded, so a reopened incident shows when it was closed again.
      { key: 'JobAcknowledged', label: 'Acknowledged', value: firstTime('Active') },
      { key: 'JobCompleted', label: 'Completed', value: lastTime('Complete') },
      { key: 'JobFinalised', label: 'Finalised', value: lastTime('Finalised') },
      { key: 'JobPriorityType.Name', label: 'Priority', default: true },
      { key: 'JobType.Name', label: 'Type', default: true },
      { key: 'JobStatusType.Name', label: 'Status', default: true },
      { key: 'Categories', label: 'Categories', value: (j) => names(j.Categories) },
      { key: 'Reconnoitered', label: 'Reconned' },
      { key: 'SituationOnScene', label: 'Situation On Scene', default: true },
      { key: 'Tags', label: 'Tags', default: true, value: (j) => names(j.Tags) },
      { key: 'EntityAssignedTo.Code', label: 'HQ', default: true },
      { key: 'LGA', label: 'LGA' },
      { key: 'EntityAssignedTo.ParentEntity.Code', label: 'Region' },
      { key: 'Event.Identifier', label: 'Event' },
      { key: 'Sector.Name', label: 'Sector' },
    ],
  },
  {
    title: 'Address details',
    fields: [
      { key: 'Address.Level', label: 'Level', default: true },
      { key: 'Address.StreetNumber', label: 'Street Number', default: true },
      { key: 'Address.Street', label: 'Street Name', default: true },
      { key: 'Address.Locality', label: 'Locality', default: true },
      { key: 'Address.PostCode', label: 'Postcode', default: true },
      { key: 'Address.PrettyAddress', label: 'Pretty Address' },
      { key: 'Address.AdditionalAddressInfo', label: 'Additional Address Info', default: true },
      { key: 'Address.Latitude', label: 'Latitude' },
      { key: 'Address.Longitude', label: 'Longitude' },
      { key: 'PermissionToEnterPremises', label: 'Premises Access - Permission Given' },
      // The old page asked for "howToEnterPremises", which Beacon doesn't
      // send, so this column was always empty. Same header, now filled in.
      { key: 'howToEnterPremises', label: 'Premises Access - Info', value: (j) => j.HowToEnterPremises },
    ],
  },
  {
    title: 'Caller / resident details',
    fields: [
      { key: 'CallerFirstName', label: 'Caller - First Name', default: true },
      { key: 'CallerLastName', label: 'Caller - Last Name', default: true },
      { key: 'CallerPhoneNumber', label: 'Caller - Phone Number', default: true },
      { key: 'ContactFirstName', label: 'Incident Contact - First Name', default: true },
      { key: 'ContactLastName', label: 'Incident Contact - Last Name', default: true },
      { key: 'ContactPhoneNumber', label: 'Incident Contact - Phone Number', default: true },
    ],
  },
  {
    title: 'Special',
    fields: [
      {
        key: 'ICEMSIUMTransactions',
        label: 'ICEMS - Number Of IUM Transactions',
        needsIcemsUpdates: true,
        value: (j, { icemsUpdates } = {}) => (icemsUpdates && icemsUpdates.has(j.Id) ? icemsUpdates.get(j.Id) : ''),
      },
      // Beacon's flood rescue category ids run on from 8, so the first
      // category's id less 8 is the category number (as the old page did).
      {
        key: 'FloodRescueCategories',
        label: 'Flood Rescue Categories',
        value: (j) => (j.Categories && j.Categories.length && Number.isFinite(j.Categories[0].Id) ? j.Categories[0].Id - 8 : ''),
      },
    ],
  },
];

export const FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export const DEFAULT_KEYS = FIELDS.filter((f) => f.default).map((f) => f.key);

export function fieldFor(key) {
  return BY_KEY.get(key) || null;
}

/** Follows a dotted path ("Address.Street"); undefined part way gives undefined. */
export function readPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * One cell. Missing values, and anything that isn't a plain value (an
 * object where Beacon left a field nested), come out empty rather than as
 * "undefined" or "[object Object]".
 *
 * @param {object} job
 * @param {string} key
 * @param {{icemsUpdates?: Map<number, number>}} [extra]
 * @returns {string|number|boolean}
 */
export function cellValue(job, key, extra = {}) {
  const field = fieldFor(key);
  if (!field) return '';
  const v = field.value ? field.value(job, extra) : readPath(job, key);
  if (v == null || typeof v === 'object' || typeof v === 'function') return '';
  if (typeof v === 'number' && !Number.isFinite(v)) return '';
  return v;
}

/** Rows of cells for `keys`, in that order (orderedKeys gives the page's order). */
export function buildRows(jobs, keys, extra = {}) {
  return jobs.map((job) => keys.map((key) => cellValue(job, key, extra)));
}

/** The chosen keys in the order the page lists them (and the CSV has them). */
export function orderedKeys(keys) {
  const chosen = new Set(keys);
  return FIELDS.filter((f) => chosen.has(f.key)).map((f) => f.key);
}
