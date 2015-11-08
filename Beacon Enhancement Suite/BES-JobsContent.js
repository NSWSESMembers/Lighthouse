function BESOpenSummaryScreen() {

var exports = JSON.parse(filterDataForExport());

console.log(exports);

	window.location.replace(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
}