console.info('Lighthouse: Teams/content/Teams.js');

$("#lighthouseTeamSummaryButton").mouseenter(function(ev){
	      summary();
});




document.getElementById("lighthouseTeamSummaryButton").onclick = function() {

summary();

}


function summary()
{

var hqs = filterViewModel.selectedEntities.peek();
var start = new Date(filterViewModel.startDate.peek()._d);
//start = new Date(start.getTime() + ( start.getTimezoneOffset() * 60000 ));

var end = new Date(filterViewModel.endDate.peek()._d);
//end = new Date(end.getTime() + ( end.getTimezoneOffset() * 60000 ));
//var exports = JSON.parse(filterDataForExport());

var hq = hqs.map(function(d){
	return d.Id;
})


if (hq.length !== 0) 
{
	$("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"lighthouse/teamsummary.html?host="+location.hostname+"&hq="+hq+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	$("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"lighthouse/teamsummary.html?host="+location.hostname+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
}


}