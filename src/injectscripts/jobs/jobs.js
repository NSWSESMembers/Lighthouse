window.FinaliseSelected = function FinaliseSelected(words,beaconStringDate) { // Never ever use the following function for any purpose.
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


$("#lighthouseExportButton").mouseenter(function(ev){
  advexport();
});

document.getElementById("lighthouseExportButton").onclick = function() {
  summary();
}


function advexport() {
  var exports = JSON.parse(filterDataForExport());
  if (exports.hasOwnProperty("Hq")){
    $("#lighthouseExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+location.hostname+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
  } else {
    $("#lighthouseExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+location.hostname+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate));
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

DoTour()

function DoTour() {
  require('bootstrap-tour')

    // Instance the tour
    var tour = new Tour({
      name: "LHJobs",
      smartPlacement: true,
      placement: "right",
      debug: true,
      steps: [
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Lighthouse Welcome",
        content: "Lighthouse has made some changes to this page. would you like a tour?"
      },
      {
        element: "#lighthouseSummaryButton",
        title: "Lighthouse Summary",
        placement: "bottom",
        backdrop: false,
        content: "Lighthouse Summary provides a simple to read screen that gives a summary of all jobs. It will only follow Headquarter and Date filters.",
      },
      {
        element: "#lighthouseStatsButton",
        title: "Lighthouse Statistics",
        placement: "bottom",
        backdrop: false,
        content: "Lighthouse Statistics provides a simple statistics (pie charts and bar graphs) breakdown for all jobs. It will only follow Headquarter and Date filters.",
      },
      {
        element: "#lighthouseExportButton",
        title: "Lighthouse Export",
        placement: "bottom",
        backdrop: false,
        onNext: function (tour) {
          $('#lhquickfilter > ul').show();
        },
        content: "Lighthouse Advanced Export allows you to export jobs and includes almost all the available data for the job - 31 data fields in total.",
      },
      {
        element: "#lhquickfilter",
        title: "Lighthouse Quickfilters",
        placement: "right",
        backdrop: false,
        onNext: function (tour) {
          $('#lhquickfilter > ul').hide();
        },
        content: "Lighthouse adds a new filter menu that groups together common filters.eg 'Rescue Jobs' covers RCR, Flood, and VR.",
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Questions?",
        content: "Thats about it. If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
      },
      ]
    })

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
}


