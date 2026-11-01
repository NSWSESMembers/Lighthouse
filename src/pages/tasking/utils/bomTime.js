// WMS TIME values for BOM layers with an hourly time dimension (the
// ACCESS-G wind and MSLP forecasts). Their default time moves on at the top
// of each hour, so tiles fetched either side of it mixed forecast hours;
// sending one explicit time keeps every tile on the same hour.

/**
 * The start of the UTC hour containing `date`, as BOM writes WMS times
 * (e.g. 2026-11-01T06:00:00Z).
 * @param {Date} [date]
 * @returns {string}
 */
export function utcHourIso(date = new Date()) {
    const d = new Date(date);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
