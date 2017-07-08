var DOM = require('jsx-dom-factory');
var sesAsbestosSearch = require('../../../lib/sesasbestos.js');

console.log("jobs/create.js inject running");

$(document).ready(function() {


  //Code to allow the extension to talk back to the page to access the jobsystem and apply the tag.
  window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FROM_LH")) {
    if(event.data.result == true)
    {
      console.log("Applying Fibro/Asbestos tag")
      $.each(jobsystem.availableJobTags.peek(),function(k,v){
        if(v.Name == "Fibro/Asbestos"){
          jobsystem.jobTagClicked(v);
          return false
        }
      })
    } else {
      console.log("Removing Fibro/Asbestos tag if present")
      $.each(jobsystem.selectedJobTags.peek(),function(k,v){
        if(v.Name == "Fibro/Asbestos"){
          jobsystem.jobTagClicked(v);
          return false
        }
      })
    }
  }
})

  whenWeAreReady(jobsystem, function() {
    console.log("jobs create ready")

    jobsystem.geocodedAddress.subscribe(function(status) {
      $('#asbestos-register-flag').text("Searching...");
      if (jobsystem.geocodedAddress.peek() != null)
      {
        address = jobsystem.geocodedAddress.peek()
        if (address.street != "") 
        {
          address.PrettyAddress = address.pretty_address
          address.StreetNumber = address.number
          address.Street = address.street
          address.Locality = address.locality
          address.Flat = address.flat

    //reset the colors
    $('#asbestos-register-box')[0].style.color = "black"
    $('#asbestos-register-box').css({'background' :'','margin-left':'0px'})

      sesAsbestosSearch(jobsystem.geocodedAddress.peek(), function(res) {
        if (res == true)
        {
          window.postMessage({ type: "FROM_PAGE_SESASBESTOS_RESULT", address: address, result: true, color: 'red' }, "*");

        } else {
          window.postMessage({ type: "FROM_PAGE_FTASBESTOS_SEARCH", address: address }, "*");
        }
      })

  } else {
    $('#asbestos-register-flag').text("Not A Searchable Address");
  }
} else {
  $('#asbestos-register-flag').text("Waiting For An Address");
}
})

    DoTour()


  });

});



function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
	var waiting = setInterval(function() {
		if (typeof varToCheck != "undefined") {
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

function DoTour() {
  require('bootstrap-tour')

    // Instance the tour
    var tour = new Tour({
      name: "LHTourJobCreate",
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
        element: "#asbestos-register-text",
        title: "Lighthouse Loose Fill Asbestos Register",
        placement: "top",
        backdrop: false,
        content: "Lighthouse will search the NSW Dept Of Fair Trading Loose Fill Abestos Register for the jobs address and display the results.",
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Questions?",
        content: "If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
      }
      ]
    })

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
}

