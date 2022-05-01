/* global $, lighthouseUrl, urls, user, contentViewModel */
$("#lighthouseExportButton").on('click mouseenter', function() {
  var exports = JSON.parse(filterDataForExport());
  var href = lighthouseUrl + "pages/nitcexport.html?host=" + urls.Base +
      "&start=" + encodeURIComponent(exports.StartDate) + "&token="+user.accessToken + "&tokenexp="+encodeURIComponent(user.expiresAt) +"&end=" +
      encodeURIComponent(exports.EndDate);
  if (Object.prototype.hasOwnProperty.call(exports, "EntityIds"))
      href += "&EntityIds=" + exports.EntityIds;
  if (Object.prototype.hasOwnProperty.call(exports, "NonIncidentTypeIds"))
      href += "&NonIncidentTypeIds=" + exports.NonIncidentTypeIds;
  if (Object.prototype.hasOwnProperty.call(exports, "TagIds"))
      href += "&TagIds=" + exports.TagIds;
  if (Object.prototype.hasOwnProperty.call(exports, "IncludeCompleted"))
      href += "&IncludeCompleted=" + exports.IncludeCompleted;
  $(this).attr("href", href);
});

function filterDataForExport() {
  var n=contentViewModel.lastReceivedFilterData;
  return n.PageIndex=1,n.PageSize=contentViewModel.totalNonIncidents(),
      n.SortField=contentViewModel.sortColumn(),
      n.SortOrder=contentViewModel.sortDirection(),
      JSON.stringify(n)
}
