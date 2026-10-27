/*
  The CSV file Incident Export downloads, written the way the old page
  wrote it: every field quoted, quotes doubled, line breaks inside a field
  turned into spaces (so a Situation On Scene stays on one row in Excel).
*/

export function csvField(value) {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

/**
 * @param {string[]} header
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
export function toCsv(header, rows) {
  const line = (cells) => cells.map(csvField).join(',') + '\n';
  return line(header) + rows.map(line).join('');
}

/**
 * "Incident export - Demo City - 2026-10-27 1015.csv". Characters Windows
 * won't have in a file name become "-".
 *
 * @param {string} scope  e.g. "Demo City", "4 DMZ units", "NSW"
 * @param {string} stamp  dates.js fileStamp()
 */
export function fileName(scope, stamp) {
  const safe = `Incident export - ${scope} - ${stamp}`.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${safe}.csv`;
}
