var DOM = require('jsx-dom-factory');

console.log("inject running");

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




          window.postMessage({ type: "FROM_PAGE", address: address }, "*");
        } else {
          $('#asbestos-register-flag').text("Not A Searchable Address");
        }
      } else {
        $('#asbestos-register-flag').text("Waiting For An Address");
      }
    })


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

