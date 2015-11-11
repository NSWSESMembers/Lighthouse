document.getElementById("BESSummaryButton").onclick = function() {

var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{
	this.href =	summaryUrl+"summary.html?hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	this.href = summaryUrl+"summary.html?&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
}
}

document.getElementById("BESStatsButton").onclick = function() {

var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{
    this.href = summaryUrl+"stats.html?hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
    //window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
    this.href = summaryUrl+"stats.html?&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
}

}


console.log("Changing page size");
JobTaskingFilterViewModel.pageSizeChoices=ko.observableArray([20,50,75,100,200,500,1000]);