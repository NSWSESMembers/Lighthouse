// Beacon's IIS front end rejects query strings over 4096 chars -- with a 404,
// not a 413 -- so searches over a list of ids are split to stay under this.
const MAX_QUERY_LENGTH = 3800;

// requestPaginated appends this to every request.
export const PAGING_PARAMS_LENGTH = '&PageIndex=9999&PageSize=100'.length;

/**
 * Group query string parts so that each group, added to the fixed part of the
 * query, stays under MAX_QUERY_LENGTH. Always returns at least one group.
 *
 * @param {string[]} parts  one per id, e.g. `JobIds=123&`
 * @param {number} fixedLength  length of the rest of the query string
 * @returns {string[][]}
 */
export function splitQueryParts(parts, fixedLength) {
  const batches = [];
  let batch = [];
  let length = fixedLength;
  for (const part of parts) {
    if (batch.length && length + part.length > MAX_QUERY_LENGTH) {
      batches.push(batch);
      batch = [];
      length = fixedLength;
    }
    batch.push(part);
    length += part.length;
  }
  batches.push(batch);
  return batches;
}
