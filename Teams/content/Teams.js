$("#lighthouseTeamSummaryButton").mouseenter(function(ev){
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
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"lighthouse/teamsummary.html?host="+location.hostname+"&hq="+hq+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
  } else {
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"lighthouse/teamsummary.html?host="+location.hostname+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
  }

}
