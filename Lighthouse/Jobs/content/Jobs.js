$("#lighthouseSummaryButton").mouseenter(function(ev){
	      summary();
});


document.getElementById("lighthouseSummaryButton").onclick = function() {

summary();

}


function summary() {


var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{
	$("#lighthouseSummaryButton").attr("href",summaryUrl+"summary.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	$("#lighthouseSummaryButton").attr("href",summaryUrl+"summary.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
}

}

$("#lighthouseStatsButton").mouseenter(function(ev){
	      summary();
});

document.getElementById("lighthouseStatsButton").onclick = function() {

stats();


}




function stats()
{


var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{
    $("#lighthouseStatsButton").attr("href",summaryUrl+"stats.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    //window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
   $("#lighthouseStatsButton").attr("href",summaryUrl+"stats.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
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
if (saved != selected)
{
console.log("Fixing page size difference");
contentViewModel.selectedPageSizeChoice(saved);
}


