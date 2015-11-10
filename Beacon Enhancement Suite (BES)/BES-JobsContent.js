document.getElementById("BESSummaryButton").onclick = function() {



var exports = JSON.parse(filterDataForExport());

console.log(exports);

if (exports.hasOwnProperty("Hq")) 
{
	this.href =	summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);
	//window.open(summaryUrl+"?hq="+exports.Hq[0]+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
} else {
	this.href = summaryUrl+"?&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate);

}


}


$(document).ready (function () {
    $('#changeMe'). click (function (e) {
        var goLucky = Math.floor(Math.random()*12);
        if (goLucky % 2 == 0) {
            this.href = "http://www.google.com";
        } else {
            this.href = "http://www.hotmail.com";
        }
    });
});
