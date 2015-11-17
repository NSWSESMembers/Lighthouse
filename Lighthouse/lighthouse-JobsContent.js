document.getElementById("lighthouseSummaryButton").onclick = function() {

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

document.getElementById("lighthouseStatsButton").onclick = function() {

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


//More pageination choices!

contentViewModel.pageSizeChoices.push(200);
contentViewModel.pageSizeChoices.push(500);
contentViewModel.pageSizeChoices.push(1000);

var saved = utility.getPrimitiveFromLocalStorage(contentViewModel.localStorageKeys.PageSize);
var selected = contentViewModel.selectedPageSizeChoice.peek();


console.log("saved:"+saved);
console.log("selected:"+selected);
if (saved !== selected)
{
console.log("Fixing page size difference");
contentViewModel.selectedPageSizeChoice(saved);
}