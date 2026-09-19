/*
  The Beacon-derived figures the generator writes into the narrative
  textareas (so the operator can reword or extend them like any other text),
  plus the merge that keeps a re-generate from duplicating or clobbering
  what they've typed around them.
*/

import { formatDuration } from './incidentStats.js';

const MOST_IMPACTED_SUBURBS = 5;

function listTally(label, tallies) {
  if (tallies.length === 0) return `${label}: none`;
  return `${label}: ${tallies.map((t) => `${t.label} (${t.count})`).join(', ')}`;
}

/**
 * @param {ReturnType<import('./computeSitrepReport.js').computeSitrepReport>} report
 * @returns {{impact: string, execution: string, resources: string}}  {sectionKey: generated lines} -- the incident counts
 *          lead the Impact block; Situation is left entirely to the operator
 */
export function buildGeneratedBlocks(report) {
  const stats = report.incidentStats;

  const counts = [
    `${stats.received} Incidents Received`,
    `${stats.outstanding} Incidents Outstanding`,
    `${stats.referred} Incidents Referred`,
    `${stats.complete} Incidents Complete`,
  ];
  if (stats.other > 0) counts.push(`${stats.other} Incidents Other status`);

  // "N/A" isn't a suburb -- left out of the most-impacted list
  const suburbs = stats.localities.filter((l) => l.label !== 'N/A').slice(0, MOST_IMPACTED_SUBURBS);
  const impact = [
    counts.join(', '),
    listTally('Incident types', stats.jobTypes),
    listTally('Job priorities', stats.priorities),
    listTally('Most impacted suburbs', suburbs),
  ];
  const execution =
    stats.averageMs == null
      ? 'Average completion time: not available (no incidents with both an Active and a Complete time)'
      : `Average completion time: ${formatDuration(stats.averageMs)} (${stats.sampleSize} incident${stats.sampleSize === 1 ? '' : 's'})`;

  const p = report.personnelInvolved;
  // "6 Total (3 Field / 2 Operations / 1 Aviation / 1 Other)" -- by person id; a
  // breakdown entry only when it has someone in it, and Other is anyone who could
  // not be matched to a person id at all
  const breakdown = [
    [p.field, 'Field'],
    [p.operations, 'Operations'],
    [p.aviation, 'Aviation'],
    [p.other, 'Other'],
  ]
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`);
  const personnel = `${p.total} Total${breakdown.length ? ` (${breakdown.join(' / ')})` : ''}`;
  const resources = [
    `Teams Currently Active: ${report.currentlyActivatedTeamIds.size}`,
    `Teams operational during reporting period: ${report.teamsActivated}`,
    `Personnel involved: ${personnel}`,
  ];

  return {
    impact: impact.join('\n'),
    execution,
    resources: resources.join('\n'),
  };
}

/**
 * Puts `newBlock` into `text`: replaces `previousBlock` where it still appears
 * verbatim (a re-generate), otherwise goes on top of whatever the operator
 * has written, leaving their text intact. An empty `newBlock` removes
 * `previousBlock` (a figure that used to be generated into this section and no longer is).
 *
 * @param {string} text
 * @param {string} previousBlock  what the last generate wrote ('' if none)
 * @param {string} newBlock
 * @returns {string}
 */
export function mergeGeneratedBlock(text, previousBlock, newBlock) {
  if (!newBlock) {
    return previousBlock && text.includes(previousBlock) ? text.replace(previousBlock, '').replace(/^\s*\n/, '').replace(/\n\s*\n/g, '\n').trim() : text;
  }
  if (previousBlock && text.includes(previousBlock)) return text.replace(previousBlock, () => newBlock);
  const rest = text.trim();
  return rest ? `${newBlock}\n${rest}` : newBlock;
}
