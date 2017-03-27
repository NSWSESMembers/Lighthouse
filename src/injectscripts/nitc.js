
$("#lighthouseExportButton").on('click mouseenter', function() {
  var exports = JSON.parse(filterDataForExport());
  var href = lighthouseUrl + "pages/nitcexport.html?host=" + urls.Base + 
      "&start=" + encodeURIComponent(exports.StartDate) + "&token="+user.accessToken +"&end=" +
      encodeURIComponent(exports.EndDate);
  if (exports.hasOwnProperty("EntityIds"))
      href += "&EntityIds=" + exports.EntityIds;
  if (exports.hasOwnProperty("NonIncidentTypeIds"))
      href += "&NonIncidentTypeIds=" + exports.NonIncidentTypeIds;
  if (exports.hasOwnProperty("TagIds"))
      href += "&TagIds=" + exports.TagIds;
  if (exports.hasOwnProperty("IncludeCompleted"))
      href += "&IncludeCompleted=" + exports.IncludeCompleted;
  $(this).attr("href", href);
});

$("#lighthouseStatsButton").on('click mouseenter', function() {
  var exports = JSON.parse(filterDataForExport());
  var href = lighthouseUrl + "pages/nitcstats.html?host=" + location.hostname +
      "&start=" + encodeURIComponent(exports.StartDate) + "&end=" +
      encodeURIComponent(exports.EndDate);
  if (exports.hasOwnProperty("EntityIds"))
      href += "&EntityIds=" + exports.EntityIds;
  if (exports.hasOwnProperty("NonIncidentTypeIds"))
      href += "&NonIncidentTypeIds=" + exports.NonIncidentTypeIds;
  if (exports.hasOwnProperty("TagIds"))
      href += "&TagIds=" + exports.TagIds;
  if (exports.hasOwnProperty("IncludeCompleted"))
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
