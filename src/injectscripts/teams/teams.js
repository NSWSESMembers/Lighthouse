$("#lighthouseTeamSummaryButton").mouseenter(function(ev) {
  summary();
});

document.getElementById("lighthouseTeamSummaryButton").onclick = function() {
  summary();
}

function summary(){
  var hqs = filterViewModel.selectedEntities.peek();
  var start = new Date(filterViewModel.startDate.peek()._d);
  var end = new Date(filterViewModel.endDate.peek()._d);

  var hq = hqs.map(function(d){
    return d.Id;
  })

  if (hq.length !== 0) {
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"pages/teamsummary.html?host="+location.hostname+"&hq="+hq+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
  } else {
    $("#lighthouseTeamSummaryButton").attr("href",lighthouseUrl+"pages/teamsummary.html?host="+location.hostname+"&start="+encodeURIComponent(start.toISOString())+"&end="+encodeURIComponent(end.toISOString()));
  }
}


DoTour()

function DoTour() {
  require('bootstrap-tour')

    // Instance the tour
    var tour = new Tour({
      name: "LHTeams",
      smartPlacement: true,
      placement: "right",
      debug: true,
      storage: false,
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
        element: "#lighthouseTeamSummaryButton",
        title: "Lighthouse Summary",
        placement: "bottom",
        backdrop: false,
        content: "Lighthouse Summary provides a simple to read screen that gives a summary of all job. It will only follow Headquarter and Date filters.",
      },
      {
        element: "#lhquickfilter",
        title: "Lighthouse Quickfilters",
        placement: "right",
        backdrop: false,
        onNext: function (tour) {
          $('#lhquickfilter > ul').hide();
        },
        content: "Lighthouse adds a new filter menu that groups together common filters.",
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Questions?",
        content: "If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
      },
      ]
    })

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
}


