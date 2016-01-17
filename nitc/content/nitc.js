$("#lighthouseExportButton").mouseenter(function(ev){
  nitcexport();
});

document.getElementById("lighthouseExportButton").onclick = function() {
  nitcexport();
}


function nitcexport() {
    var exports = JSON.parse(filterDataForExport());
    var href = lighthouseUrl + "lighthouse/nitcexport.html?host=" + location.hostname + 
        "&start=" + encodeURIComponent(exports.StartDate) + "&end=" + encodeURIComponent(exports.EndDate);
    if (exports.hasOwnProperty("EntityIds"))
        href += "&EntityIds=" + exports.EntityIds;
    if (exports.hasOwnProperty("NonIncidentTypeIds"))
        href += "&NonIncidentTypeIds=" + exports.NonIncidentTypeIds;
    if (exports.hasOwnProperty("TagIds"))
        href += "&TagIds=" + exports.TagIds;
    if (exports.hasOwnProperty("IncludeCompleted"))
        href += "&IncludeCompleted=" + exports.IncludeCompleted;
    $("#lighthouseExportButton").attr("href",href);
}


function filterDataForExport() {
    var n=contentViewModel.lastReceivedFilterData;
    return n.PageIndex=1,n.PageSize=contentViewModel.totalNonIncidents(),
        n.SortField=contentViewModel.sortColumn(),
        n.SortOrder=contentViewModel.sortDirection(),
        JSON.stringify(n)
}
