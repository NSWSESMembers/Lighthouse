var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

  
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FROM_PAGE_FTASBESTOS_SEARCH")) {
    chrome.runtime.sendMessage({type: "asbestos", address: event.data.address}, function(response) {
      if (response.resultbool == false)
      {
        response.requrl = ''
      } else {
        window.postMessage({ type: "FROM_LH", result: true }, "*");
      }
      asbestosBoxColor(response.result,response.colour,response.requrl)
    });
  } else if (event.data.type && (event.data.type == "FROM_PAGE_SESASBESTOS_RESULT")) {
    window.postMessage({ type: "FROM_LH", result: true }, "*");
    asbestosBoxColor(event.data.address.PrettyAddress+" was FOUND on the SES asbestos register.",'red','')


  }
}, false);

function asbestosBoxColor(text, color, url) {
  $('#asbestos-register-text').html(text);
  if (url != '')
  {
    console.log("got url")
    $('#asbestos-register-box').css('cursor','pointer');
    $('#asbestos-register-box').click(function(){
      window.open(url)
    })
  }
  if (color != "") {
    $('#asbestos-register-box')[0].style.color = "white"
    $('#asbestos-register-box').css({'background' :'linear-gradient(transparent 8px, '+color+' -10px','margin-left':'17px'});
  }
}


$(document).ready(function(){

})

job_asbestos_history = (
  <div class="form-group">
  <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px" src={chrome.extension.getURL("icons/lh-black.png")} />Asbestos Register</label>
  <div id="asbestos-register-box" class="col-md-10 col-lg-8" style="width:inherit">
  <a style="color:white;background-color:red" id="asbestos-register-error"></a>
  <p id="asbestos-register-text" class="form-control-static">Waiting For An Address</p>
  </div>
  </div>
  );



$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(2)').after(job_asbestos_history);



console.log("injecting")

inject('jobs/create.js');
