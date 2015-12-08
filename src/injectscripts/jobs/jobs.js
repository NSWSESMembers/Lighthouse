function finallselected(words,beaconStringDate) { // Never ever use the following function for any purpose.
  if( !confirm( "WARNING - Never ever use the following function for any purpose!\nAre you absolutely sure you want to proceed?" ) ){
    return false;
  }
  console.log("Man will someone be cranky with you!");
  contentViewModel.selectedJobs.peek().forEach(function(d){
    contentViewModel.JobManager.FinaliseJob(d,words,beaconStringDate,(function(d){console.log("OK")}),(function(d){console.log("Fail")}),(function(d){console.log("always")}));
  });
}


$("#lighthouseSummaryButton").mouseenter(function(ev){
  summary();
});

document.getElementById("lighthouseSummaryButton").onclick = function() {
  summary();
}


function summary() {
    var exports = JSON.parse(filterDataForExport());
    if (exports.hasOwnProperty("Hq")) {
      $("#lighthouseSummaryButton").attr("href",lighthouseUrl+"pages/summary.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    } else {
      $("#lighthouseSummaryButton").attr("href",lighthouseUrl+"pages/summary.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    }
}

$("#lighthouseStatsButton").mouseenter(function(ev){
  stats();
});

document.getElementById("lighthouseStatsButton").onclick = function() {
  stats();
}


function stats(){
    var exports = JSON.parse(filterDataForExport());
    if (exports.hasOwnProperty("Hq")){
      $("#lighthouseStatsButton").attr("href",lighthouseUrl+"pages/stats.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    } else {
      $("#lighthouseStatsButton").attr("href",lighthouseUrl+"pages/stats.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    }
}


$("#lighthousExportButton").mouseenter(function(ev){
  advexport();
});

document.getElementById("lighthousExportButton").onclick = function() {
  summary();
}


function advexport() {
    var exports = JSON.parse(filterDataForExport());
    if (exports.hasOwnProperty("Hq")){
      $("#lighthousExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
    } else {
      $("#lighthousExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
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
if( saved != selected ){
  console.log("Fixing page size difference");
  contentViewModel.selectedPageSizeChoice(saved);
}

initializeDateTimePicker(filterViewModel.startDate.peek(),filterViewModel.endDate.peek());


function initializeDateTimePicker(n, t) {
  $("#reportrange").daterangepicker({
    startDate: moment(n),
    endDate: moment(t),
    minDate: utility.minDate,
    showDropdowns: !0,
    showWeekNumbers: !0,
    timePicker: !0,
    timePickerIncrement: 1,
    timePicker12Hour: !1,
    ranges: {
      Today: [utility.dateRanges.Today.StartDate(), utility.dateRanges.Today.EndDate()],
      Yesterday: [utility.dateRanges.Yesterday.StartDate(), utility.dateRanges.Yesterday.EndDate()],
      "Last 7 Days": [utility.dateRanges.Last7Days.StartDate(), utility.dateRanges.Last7Days.EndDate()],
      "Last 30 Days": [utility.dateRanges.Last30Days.StartDate(), utility.dateRanges.Last30Days.EndDate()],
      "This Month": [utility.dateRanges.ThisMonth.StartDate(), utility.dateRanges.ThisMonth.EndDate()],
      "Last Month": [utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()],
      "This Calendar Year": [moment().startOf('year'), moment().endOf('year')],
      "All": [utility.minDate, moment().endOf('year')]
    },
    opens: "left",
    buttonClasses: ["btn btn-default"],
    applyClass: "btn-small btn-primary",
    cancelClass: "btn-small",
    format: "DD/MM/YYYY",
    separator: " to ",
    locale: {
      applyLabel: "Submit",
      fromLabel: "From",
      toLabel: "To",
      customRangeLabel: "Custom Range",
      daysOfWeek: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      firstDay: 1
    }
  }, function(n, t, i) {
    filterViewModel.dateRangeType(i), filterViewModel.startDate(moment(n)), filterViewModel.endDate(moment(t)), $("#reportrange span").html(n.format("MMMM  D, YYYY H:mm") + " - " + t.format("MMMM D, YYYY H:mm"))
  });
  $("#reportrange span").html(moment(n).format("MMMM D, YYYY H:mm") + " - " + moment(t).format("MMMM D, YYYY H:mm"));
}
