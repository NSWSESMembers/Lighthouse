var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

  //send the address to the extensions content script
  if (event.data.type && (event.data.type == "FROM_PAGE")) {
    console.log(event.data.address);
    chrome.runtime.sendMessage({type: "asbestos", address: event.data.address}, function(response) {
      console.log(response);
      $('#asbestos-register-text').html(response.result);
      $('#asbestos-register-box').click(function(){
        window.open(response.requrl)
      })
      $('#asbestos-register-box').css('cursor','pointer');
      if (response.colour != "") {
        //has asbestos
        window.postMessage({ type: "FROM_LH", result: true }, "*");
        $('#asbestos-register-box')[0].style.color = "white"
        $('#asbestos-register-box').css({'background' :'linear-gradient(transparent 8px, '+response.colour+' -10px','margin-left':'17px'})
      } else {
        //no asbestos or error
        window.postMessage({ type: "FROM_LH", result: false }, "*");
        $('#asbestos-register-box')[0].style.color = "black"
        $('#asbestos-register-box').css({'background' :''})
      }

    });

  }
}, false);


$(document).ready(function(){

})

job_asbestos_history = (
  <div class="form-group">
  <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px" src={chrome.extension.getURL("icons/lh-black.png")} />Fairtrade Register</label>
  <div id="asbestos-register-box" class="col-md-10 col-lg-8" style="width:inherit">
  <p id="asbestos-register-text" class="form-control-static">Waiting For An Address</p>
  </div>
  </div>
  );



$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(2)').after(job_asbestos_history);



console.log("injecting")

inject('jobs/create.js');
