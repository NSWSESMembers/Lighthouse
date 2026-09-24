/**
 * Parses a "key=value&key2=value2"-style query string (without the leading
 * "?") into a plain object.
 * @param {string} prmstr
 * @returns {Record<string, string>}
 */
export function parseSearchParams(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = decodeURIComponent(tmparr[1]);
    }
    return params;
}
