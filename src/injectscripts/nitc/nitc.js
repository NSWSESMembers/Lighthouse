/* global $, lighthouseUrl, urls, user, contentViewModel */
// "Export (Filtered)" on Beacon's NITC screen: opens NITC Export
// (src/pages/nitcexport/) with the screen's filters. The page gets its
// Beacon sign-in from the extension (passed on here, as the Jobs screen's
// buttons do), not the URL.
$("#lighthouseExportButton").on('click mouseenter', function(e) {
  if (e.type === 'click') {
    window.postMessage({
      type: "FROM_PAGE_UPDATE_API_TOKEN",
      host: urls.Base,
      token: user.accessToken,
      tokenexp: user.expiresAt,
    }, "*");
  }
  // A copy, as plain JSON: the filters as Beacon would send them.
  var exports = JSON.parse(JSON.stringify(contentViewModel.lastReceivedFilterData));
  var params = new URLSearchParams({
    host: urls.Base,
    source: location.origin,
    userId: user.Id,
    start: exports.StartDate,
    end: exports.EndDate,
  });
  ['EntityIds', 'NonIncidentTypeIds', 'TagIds', 'IncludeCompleted'].forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(exports, key) && exports[key] != null) {
      params.set(key === 'EntityIds' ? 'hq' : key, String(exports[key]));
    }
  });
  $(this).attr("href", lighthouseUrl + "pages/nitcexport.html?" + params.toString());
  $(this).attr("target", "_blank");
});
