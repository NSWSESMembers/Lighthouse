import ko from 'knockout';

/**
 * tableSort.js
 *
 * Comparator functions behind the sortable Teams/Jobs table headers.
 * Extracted from main.js's VM(); the ko.pureComputed memoization wrappers
 * (sortedTeams/sortedJobs) stay in main.js and just call these.
 */

export const JOB_STATUS_ORDER = [
    'New',
    'Active',
    'Tasked',
    'Referred',
    'Complete',
    'Cancelled',
    'Rejected',
    'Finalised',
];

export const JOB_STATUS_RANK = JOB_STATUS_ORDER.reduce((m, s, i) => {
    m[s] = i;
    return m;
}, Object.create(null));

/**
 * @param {object} a
 * @param {object} b
 * @param {string} key  a (possibly dotted, e.g. "entityAssignedTo.code") property path
 * @param {boolean} asc
 * @returns {number}
 */
export function compareByKey(a, b, key, asc) {
    // Support nested keys like "entityAssignedTo.code"
    var av = key.includes('.')
        ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), a)
        : ko.unwrap(a[key]);

    var bv = key.includes('.')
        ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), b)
        : ko.unwrap(b[key]);

    var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
    var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
    var cmp = (an && bn) ? (Number(av) - Number(bv))
        : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
    return asc ? cmp : -cmp;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} key
 * @param {boolean} asc
 * @returns {number}
 */
export function compareJobsByKey(a, b, key, asc) {
    // Support nested keys like "entityAssignedTo.code"
    var av = key.includes('.')
        ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), a)
        : ko.unwrap(a[key]);

    var bv = key.includes('.')
        ? key.split('.').reduce((obj, k) => ko.unwrap(obj?.[k]), b)
        : ko.unwrap(b[key]);

    // Type column displays `typeShort + categoriesNameNumberDash` (e.g. FR-1),
    // so sort using the same rendered token.
    if (key === 'type') {
        av = `${ko.unwrap(a.typeShort) || ''}${ko.unwrap(a.categoriesNameNumberDash) || ''}`;
        bv = `${ko.unwrap(b.typeShort) || ''}${ko.unwrap(b.categoriesNameNumberDash) || ''}`;
    }

    // --- custom status order ---
    if (key === 'statusName') {
        var ar = JOB_STATUS_RANK[av] ?? Number.MAX_SAFE_INTEGER;
        var br = JOB_STATUS_RANK[bv] ?? Number.MAX_SAFE_INTEGER;
        return asc ? (ar - br) : (br - ar);
    }

    // --- default behaviour ---
    var an = typeof av === 'number' || /^\d+(\.\d+)?$/.test(av);
    var bn = typeof bv === 'number' || /^\d+(\.\d+)?$/.test(bv);
    var cmp = (an && bn)
        ? (Number(av) - Number(bv))
        : String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });

    return asc ? cmp : -cmp;
}
