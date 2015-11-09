function BESOpenSummaryScreen() {

var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{

	window.location.href = summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
} else {
		console.log(summaryUrl+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
		window.location.href = summaryUrl+"?&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);

}
}