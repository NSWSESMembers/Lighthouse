var DOM = require('jsx-dom-factory').default;
var sesAsbestosSearch = require('../../lib/sesasbestos.js');

console.log("jobs/create.js inject running");

$(document).ready(function() {


  //Code to allow the extension to talk back to the page to access the jobsystem and apply the tag.
  window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source != window)
      return;
    if (event.data.type && (event.data.type == "FROM_LH")) {
      if (event.data.result == true) {
        console.log("Applying Fibro/Asbestos tag")
        $.each(jobsystem.availableJobTags.peek(), function(k, v) {
          if (v.Name == "Fibro/Asbestos") {
            jobsystem.jobTagClicked(v);
            return false
          }
        })
      } else {
        console.log("Removing Fibro/Asbestos tag if present")
        $.each(jobsystem.selectedJobTags.peek(), function(k, v) {
          if (v.Name == "Fibro/Asbestos") {
            jobsystem.jobTagClicked(v);
            return false
          }
        })
      }
    }
  })

  whenWeAreReady(jobsystem, function() {
    console.log("jobs create ready")

    jobsystem.latitude.subscribe(function(status) {
      if (jobsystem.latitude.peek() != '' && jobsystem.longitude.peek() != '') {
        window.postMessage({ type: "FROM_PAGE_LHQ_DISTANCE", lat: jobsystem.latitude.peek(), lng: jobsystem.longitude.peek() }, "*");
      }
    })

    jobsystem.longitude.subscribe(function(status) {
      if (jobsystem.latitude.peek() != '' && jobsystem.longitude.peek() != '') {
        window.postMessage({ type: "FROM_PAGE_LHQ_DISTANCE", lat: jobsystem.latitude.peek(), lng: jobsystem.longitude.peek() }, "*");
      }
    })

    jobsystem.geocodedAddress.subscribe(function(status) {
      $('#asbestos-register-text').text("Searching...");
      if (jobsystem.geocodedAddress.peek() != null) {

      window.postMessage({ type: "FROM_PAGE_LHQ_DISTANCE", lat: jobsystem.geocodedAddress.peek().latitude, lng: jobsystem.geocodedAddress.peek().longitude }, "*");


        address = jobsystem.geocodedAddress.peek()
        if (address.street != "") {
          address.PrettyAddress = address.pretty_address
          address.StreetNumber = address.number
          address.Street = address.street
          address.Locality = address.locality
          address.Flat = address.flat

          //reset the colors
          $('#asbestos-register-box')[0].style.color = "black"
          $('#asbestos-register-box').css({
            'background': '',
            'margin-left': '0px'
          })

          sesAsbestosSearch(jobsystem.geocodedAddress.peek(), function(res) {
            if (res == true) {
              window.postMessage({
                type: "FROM_PAGE_SESASBESTOS_RESULT",
                address: address,
                result: true,
                color: 'red'
              }, "*");
            } else {
              window.postMessage({
                type: "FROM_PAGE_FTASBESTOS_SEARCH",
                address: address
              }, "*");
            }
          })

        } else {
          $('#asbestos-register-flag').text("Not A Searchable Address");
        }
      } else {
        $('#asbestos-register-flag').text("Waiting For An Address");
      }
    })
  });
});

function whenWeAreReady(varToCheck, cb) { //when external vars have loaded
  var waiting = setInterval(function() {
    if (typeof varToCheck != "undefined") {
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}
