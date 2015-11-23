document.getElementById("lighthouseTeamSummaryButton").onclick = function() {

var hqs = filterViewModel.selectedEntities.peek();
var start = filterViewModel.startDate.peek()._d;
var end = filterViewModel.endDate.peek()._d;
//var exports = JSON.parse(filterDataForExport());

var hq = hqs.map(function(d){
	return d.Id;
})

console.log(hq);

if (hq.length !== 0) 
{
	this.href =	summaryUrl+"teamsummary.html?host="+location.hostname+"&hq="+hq+"&start="+encodeURIComponent(start)+"&end="+encodeURIComponent(end);
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	this.href = summaryUrl+"teamsummary.html?host="+location.hostname+"&start="+encodeURIComponent(start)+"&end="+encodeURIComponent(end);
}
}