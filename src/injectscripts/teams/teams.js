$("#lighthouseTeamSummaryButton").mouseenter(function(ev) {
  summary();
});

document.getElementById("lighthouseTeamSummaryButton").onclick = function() {
  summary();
}

function summary(){
  var hqs = filterViewModel.selectedEntities.peek();
  var start = new Date(filterViewModel.startDate.peek()._d);
  var end = new Date(filterViewModel.endDate.peek()._d);

  var hq = hqs.map(function(d){
    return d.Id;
  })

  if (hq.length !== 0) {
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"pages/teamsummary.html?host="+urls.Base+"&source="+location.origin+"&hq="+hq+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString())+ "&token=" + encodeURIComponent(user.accessToken)+ "&tokenexp="+encodeURIComponent(user.expiresAt));
  } else {
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"pages/teamsummary.html?host="+urls.Base+"&source="+location.origin+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString())+ "&token=" + encodeURIComponent(user.accessToken)+ "&tokenexp="+encodeURIComponent(user.expiresAt));
  }
}
