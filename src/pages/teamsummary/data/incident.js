/*
  The incident details shown when an incident in a team's history is
  clicked, from Beacon's Jobs/{id} (job.get).
*/

/** Beacon's API takes the incident number without its dash. */
export function incidentId(number) {
  return String(number).replace('-', '');
}

// Priority -> popup header colour (teamsummary.css), as on the old page.
const PRIORITIES = {
  Rescue: 'rescue',
  'Life Threatening': 'rescue',
  'Priority Response': 'priority',
  'Immediate Response': 'immediate',
};

const pad = (n) => String(n).padStart(2, '0');

/** "08:32:00 15/11/2026", as the old popup showed it. */
function receivedText(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * @param {object} job  a Jobs/{id} response
 * @param {string} source  the Beacon origin, for the link
 * @returns {{
 *   number: string, typeName: string, statusName: string, priority: string, priorityKey: string,
 *   address: string, situation: string, tags: string, received: string, hq: string, beaconUrl: string,
 * }}
 */
export function incidentFromBeacon(job, source) {
  const priority = job.JobPriorityType?.Description || job.JobPriorityType?.Name || '';
  const entity = job.EntityAssignedTo;
  const received = job.JobReceived ? new Date(job.JobReceived) : null;
  return {
    number: job.Identifier || '',
    typeName: job.JobType?.Name || '',
    statusName: job.JobStatusType?.Name || '',
    priority,
    priorityKey: PRIORITIES[priority] || 'general',
    address: job.Address?.PrettyAddress || '',
    situation: job.SituationOnScene || '',
    tags: (job.Tags || []).map((t) => t.Name).filter(Boolean).join(', '),
    received: received && !isNaN(received) ? receivedText(received) : '',
    hq: entity ? (entity.ParentEntity?.Code ? `${entity.Code} - ${entity.ParentEntity.Code}` : entity.Code || '') : '',
    beaconUrl: `${source}/Jobs/${job.Id}`,
  };
}

/** The address without the state, for the card's last-seen line (as the old page did). */
export function shortAddress(address) {
  return String(address || '').replace(', NSW', '');
}
