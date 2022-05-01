/* global $, user, urls, lighthouseUrl, filterViewModel */
$("#lighthouseTeamSummaryButton").on("click", function() {
  summary();
})

function summary() {
  var hqs = filterViewModel.selectedEntities.peek();
  var start = new Date(filterViewModel.startDate.peek()._d);
  var end = new Date(filterViewModel.endDate.peek()._d);

  var hq = hqs.map(function(d) {
    return d.Id;
  })

  window.postMessage({
    type: "FROM_PAGE_UPDATE_API_TOKEN",
    host: urls.Base,
    token: user.accessToken,
    tokenexp: user.expiresAt,
  }, "*");

  $("#lighthouseTeamSummaryButton").attr('target', "_blank");
  if (hq.length !== 0) {
    $("#lighthouseTeamSummaryButton").attr("href", lighthouseUrl + "pages/teamsummary.html?userId=" + user.Id + "&host=" + urls.Base + "&source=" + location.origin + "&hq=" + hq + "&start=" + encodeURIComponent(start.toISOString()) + "&end=" + encodeURIComponent(end.toISOString()));
  } else {
    $("#lighthouseTeamSummaryButton").attr("href", lighthouseUrl + "pages/teamsummary.html?userId="+ user.Id + "&host=" + urls.Base + "&source=" + location.origin + "&start=" + encodeURIComponent(start.toISOString()) + "&end=" + encodeURIComponent(end.toISOString()));
  }
}
