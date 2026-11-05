/*
  The CSV files Incident Export and NITC Export download, written the way
  the old pages wrote them: every field quoted, quotes doubled, line breaks
  inside a field turned into spaces (so a Situation On Scene stays on one
  row in Excel).
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
 * @param {string} what  e.g. "Incident export", "NITC activities"
 * @param {string} scope  e.g. "Demo City", "4 DMZ units", "NSW"
 * @param {string} stamp  dates.js fileStamp()
 */
export function fileName(what, scope, stamp) {
  const safe = `${what} - ${scope} - ${stamp}`.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${safe}.csv`;
}

/**
 * Hands a CSV to the browser as a download (extension pages only: uses the DOM).
 *
 * @param {string} name
 * @param {string} text
 */
export function saveCsv(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download in Chrome; give it a minute.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
