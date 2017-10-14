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
    $("#lighthouseSummaryButton").attr("href",lighthouseUrl+"pages/summary.html?host="+urls.Base+"&source="+location.origin+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
  } else {
    $("#lighthouseSummaryButton").attr("href",lighthouseUrl+"pages/summary.html?host="+urls.Base+"&source="+location.origin+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
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
    $("#lighthouseStatsButton").attr("href",lighthouseUrl+"pages/stats.html?host="+urls.Base+"&source="+location.origin+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
  } else {
    $("#lighthouseStatsButton").attr("href",lighthouseUrl+"pages/stats.html?host="+urls.Base+"&source="+location.origin+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
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
    $("#lighthouseExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+urls.Base+"&hq="+exports.Hq+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
  } else {
    $("#lighthouseExportButton").attr("href",lighthouseUrl+"pages/advexport.html?host="+urls.Base+"&start="+encodeURIComponent(exports.StartDate)+"&end="+encodeURIComponent(exports.EndDate)+ "&token=" + encodeURIComponent(user.accessToken));
  }
}


//More pageination choices! --currently broken due to beacon not returning more than 250 per page--
// contentViewModel.pageSizeChoices.push(200);
// contentViewModel.pageSizeChoices.push(500);
// contentViewModel.pageSizeChoices.push(1000);

// var saved = utility.getPrimitiveFromLocalStorage(contentViewModel.localStorageKeys.PageSize);
// var selected = contentViewModel.selectedPageSizeChoice.peek();

// console.log("saved:"+saved);
// console.log("selected:"+selected);
// if( saved != selected ){
//   console.log("Fixing page size difference");
//   contentViewModel.selectedPageSizeChoice(saved);
// }


DoTour()

function DoTour() {
  require('bootstrap-tour')

    // Instance the tour
    var tour = new Tour({
      name: "LHTourJobs",
      smartPlacement: true,
      placement: "right",
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
        content: "Lighthouse Advanced Export allows you to export jobs and includes almost all the available data for the job - 33 data fields in total.",
      },
      {
        element: "#lhquickfilter",
        title: "Lighthouse Quickfilters",
        placement: "right",
        backdrop: false,
        content: "Lighthouse adds a new filter menu that groups together common filters.eg 'Rescue Jobs' covers RCR, Flood, and VR.",
      },
      {
        element: "#lhfiltercollections",
        title: "Filter Collections",
        placement: "right",
        onNext: function (tour) {
          $('#lhquickfilter > ul').hide();
        },
        content: "Lighthouse Filter Collections allow you to save your current filter selection for later use.",
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


