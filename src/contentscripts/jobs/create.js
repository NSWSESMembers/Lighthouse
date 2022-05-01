var inject = require('../../lib/inject.js');
var DOM = require('jsx-dom-factory').default;
var $ = require('jquery');
var vincenty = require('../../lib/vincenty.js');

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


  }  else if (event.data.type && (event.data.type == "FROM_PAGE_LHQ_DISTANCE")) {
    var t0 = performance.now();
  $.getJSON(chrome.extension.getURL("resources/SES_HQs.geojson"), function (data) {
    distances = []
    data.features.forEach(function(v){
      v.distance = vincenty.distVincenty(v.properties.POINT_Y,v.properties.POINT_X,event.data.lat,event.data.lng)/1000
      distances.push(v)
    })
    let _sortedDistances = distances.sort(function(a, b) {
      return a.distance - b.distance
    });
    $('#nearest-lhq-text').text(`${_sortedDistances[0].properties.HQNAME} (${_sortedDistances[0].distance.toFixed(2)} kms), ${_sortedDistances[1].properties.HQNAME} (${_sortedDistances[1].distance.toFixed(2)} kms), ${_sortedDistances[2].properties.HQNAME} (${_sortedDistances[2].distance.toFixed(2)} kms)`)
    var t1 = performance.now();
    console.log("Call to calculate distances from LHQs took " + (t1 - t0) + " milliseconds.")
})
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

  job_nearest_lhq = (
    <div class="form-group">
    <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
    src={chrome.extension.getURL("icons/lh-black.png")} /><abbr title="Distance as the crow flies">Closest LHQs </abbr></label>
    <div id="nearest-lhq-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
    <p id="nearest-lhq-text" class="form-control-static">Waiting For A Location</p>
    </div>
    </div>
  );


$('#createRfaForm > fieldset:nth-child(6) > div:nth-child(2)').after(job_asbestos_history);

$('#createRfaForm > fieldset:nth-child(6) > div:nth-child(12)').after(job_nearest_lhq);


console.log("injecting")

inject('jobs/create.js');
