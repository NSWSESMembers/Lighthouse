/*
  Renders a computed sitrep report as plain, copy/print-friendly text
  following the NSW SES situation-report format (see sitrepSections.js for
  where the section list/headings come from). Kept separate from the view
  model so it's testable without Knockout/DOM.
*/

import { formatSydney, formatReportingPeriod, formatSydneyHrs } from './sydneyTime.js';
import { SITREP_SECTIONS } from './sitrepSections.js';

/** "Situation Officer, Jane Smith" -- just the name (or role) when only one is given */
export function roleAndName(role, name) {
  return [role, name].map((v) => (v || '').trim()).filter(Boolean).join(', ');
}

export const FOOTER = 'Produced by Lighthouse Sitrep Generator';

/**
 * @param {object} args
 * @param {{eventNumber?: string, eventName?: string, location?: string, sitrepNumber?: string, sitrepTime?: Date|null}} [args.header]
 * @param {Array<{id: string|number, name: string}>} args.units
 * @param {Date|null} [args.windowStart]
 * @param {Date|null} [args.windowEnd]
 * @param {Date|null} [args.generatedAt]
 * @param {Record<string, string>} [args.sectionCommentary]  {sectionKey: text} -- see sitrepSections.js
 * @param {string} [args.sectorLabel]
 * @param {string} [args.eventLabel]
 * @param {{option: 'scheduled'|'none', time?: Date|null}} [args.nextReport]
 * @param {{preparedBy?: string, preparedByRole?: string, approvedBy?: string, approvedByRole?: string}} [args.authorisation]
 * @returns {string}
 */
export function buildSitrepPreviewText({
  header = {},
  units,
  windowStart = null,
  windowEnd = null,
  generatedAt = null,
  sectionCommentary = {},
  sectorLabel = '',
  eventLabel = '',
  nextReport = { option: 'scheduled', time: null },
  authorisation = {},
}) {
  const lines = [];
  const number = (header.sitrepNumber || '').toString().trim();
  lines.push(number ? `SITUATION REPORT #${number}` : 'SITUATION REPORT');
  lines.push(`Sitrep Date: ${header.sitrepTime ? formatSydneyHrs(header.sitrepTime) : ''}`);
  lines.push(`Event: ${[header.eventNumber, header.eventName].map((v) => (v || '').trim()).filter(Boolean).join(' ')}`);
  lines.push(`Location: ${(header.location || '').trim()}`);
  lines.push(`Reporting Period: ${windowStart && windowEnd ? formatReportingPeriod(windowStart, windowEnd) : ''}`);

  SITREP_SECTIONS.forEach((section) => {
    lines.push('');
    lines.push(section.heading.toUpperCase());
    const text = (sectionCommentary[section.key] || '').trim();
    lines.push(text || '(no commentary entered)');
  });

  lines.push('');
  if (nextReport.option === 'none') {
    lines.push('No further situation reports will be issued for this event.');
  } else if (nextReport.time) {
    lines.push(`Unless there is a significant change, the next situation report will be issued at ${formatSydney(nextReport.time)}.`);
  } else {
    lines.push('Unless there is a significant change, the next situation report will be issued at TBC.');
  }

  lines.push('');
  lines.push('AUTHORISATION');
  lines.push(`Prepared By: ${roleAndName(authorisation.preparedByRole, authorisation.preparedBy)}`);
  lines.push(`Approved By: ${roleAndName(authorisation.approvedByRole, authorisation.approvedBy)}`);

  lines.push('');
  lines.push(FOOTER);

  // how the report was scoped and when it was produced, below the footer
  lines.push('');
  lines.push(`- Scope: ${units.map((u) => u.name).join(', ') || 'Unknown'}`);
  if (sectorLabel) lines.push(`- Sector filter: ${sectorLabel}`);
  if (eventLabel) lines.push(`- Event filter: ${eventLabel}`);
  lines.push(`- Generated: ${generatedAt ? formatSydney(generatedAt) : ''}`);

  return lines.join('\n');
}
