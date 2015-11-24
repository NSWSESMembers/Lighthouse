$("#lighthouseTeamSummaryButton").mouseenter(function(ev){
	      summary();
});




document.getElementById("lighthouseTeamSummaryButton").onclick = function() {

summary();

}


function summary()
{

var hqs = filterViewModel.selectedEntities.peek();
var start = filterViewModel.startDate.peek()._d;
var end = filterViewModel.endDate.peek()._d;
//var exports = JSON.parse(filterDataForExport());

var hq = hqs.map(function(d){
	return d.Id;
})


if (hq.length !== 0) 
{
	$("#lighthouseTeamSummaryButton").attr("href",summaryUrl+"teamsummary.html?host="+location.hostname+"&hq="+hq+"&start="+encodeURIComponent(start)+"&end="+encodeURIComponent(end));
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	$("#lighthouseTeamSummaryButton").attr("href",summaryUrl+"teamsummary.html?host="+location.hostname+"&start="+encodeURIComponent(start)+"&end="+encodeURIComponent(end));
}


}