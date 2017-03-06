var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

  if (event.data.type && (event.data.type == "FROM_PAGE")) {
    console.log(event.data.address);
    //reset the colors
    $('#asbestos-register-flag')[0].style.color = "black"
    $('#asbestos-register-flag')[0].style.backgroundColor = "";
    chrome.runtime.sendMessage({type: "asbestos", address: event.data.address}, function(response) {
      console.log(response);
      $('#asbestos-register-flag').text(response.result);
      if (response.colour != "") {
        $('#asbestos-register-flag')[0].style.color = "white"
        $('#asbestos-register-flag')[0].style.backgroundColor = response.colour;
      } else {
        $('#asbestos-register-flag')[0].style.color = "black"
        $('#asbestos-register-flag')[0].style.backgroundColor = "";
      }

    });

  }
}, false);


$(document).ready(function(){



})

job_asbestos_history = (
  <div class="form-group">
  <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px" src={chrome.extension.getURL("icons/lh-black.png")} />Fairtrade Register</label>
  <div class="col-md-10 col-lg-8">
  <p id="asbestos-register-flag" class="form-control-static">Waiting For An Address</p>
  </div>
  </div>
  );



$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(2)').after(job_asbestos_history);



console.log("injecting")

inject('jobs/create.js');
