/*
  What might be missing from a sitrep about to be copied, printed or filed --
  shown to the operator as a "may not be complete" warning (they can still
  carry on).
*/

// a snippet's fill-in-the-blank, e.g. "[location]" or "[minor/moderate/major]"
const PLACEHOLDER = /\[[^\]\n]+\]/;

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
  const unfilled = sections.filter((s) => PLACEHOLDER.test(s.text)).map((s) => s.heading);
  if (unfilled.length > 0) warnings.push(`Unfilled [placeholder] text in: ${unfilled.join(', ')}`);
  if (nextReportOption === 'scheduled' && !nextReportTime) warnings.push('The next sitrep time has not been selected');
  return warnings;
}
