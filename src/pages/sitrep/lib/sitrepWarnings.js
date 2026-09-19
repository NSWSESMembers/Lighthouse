/*
  What might be missing from a sitrep about to be copied, printed or filed --
  shown to the operator as a "may not be complete" warning (they can still
  carry on).
*/

/**
 * @param {object} args
 * @param {Array<{heading: string, text: string}>} args.sections  the body sections
 * @param {'scheduled'|'none'} args.nextReportOption
 * @param {Date|null} args.nextReportTime
 * @returns {string[]}  empty when nothing looks missing
 */
export function sitrepWarnings({ sections, nextReportOption, nextReportTime }) {
  const warnings = [];
  const blank = sections.filter((s) => !s.text.trim()).map((s) => s.heading);
  if (blank.length > 0) warnings.push(`Blank body section${blank.length === 1 ? '' : 's'}: ${blank.join(', ')}`);
  if (nextReportOption === 'scheduled' && !nextReportTime) warnings.push('The next sitrep time has not been selected');
  return warnings;
}
