var inject = require('../../lib/inject.js');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;
var $ = require('jquery');
var vincenty = require('../../lib/vincenty.js');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

    if (event.data.type && (event.data.type == "FROM_PAGE_JOBTYPE")) {
      if (event.data.jType) {
        $('#nearest-rescue-lhq-label').text(`Closest ${event.data.jType} LHQs`)
        $('#nearest-rescue-lhq-group').show()
    } else {
      $('#nearest-rescue-lhq-group').hide()
    }
    }

  if (event.data.type && (event.data.type == "FROM_PAGE_FTASBESTOS_SEARCH")) {
    chrome.runtime.sendMessage({type: "asbestos", address: event.data.address}, function(response) {
      if (response.resultbool == false)
      {
        response.requrl = ''
      } else {
        window.postMessage({ type: "FROM_LH_ASBESTOS", result: true }, "*");
      }
    asbestosBoxColor(response.result,response.colour,response.requrl)
    });
  } else if (event.data.type && (event.data.type == "FROM_PAGE_SESASBESTOS_RESULT")) {
    window.postMessage({ type: "FROM_LH_ASBESTOS", result: true }, "*");
    asbestosBoxColor(event.data.address.PrettyAddress+" was FOUND on the SES asbestos register.",'red','')


  }  else if (event.data.type && (event.data.type == "FROM_PAGE_LHQ_DISTANCE")) {
    var t0 = performance.now('');
    $('#nearest-lhq-text').text('Searching...')
    $('#nearest-rescue-lhq-text').text('Searching...')
  $.getJSON(chrome.runtime.getURL("resources/SES_HQs.geojson"), function (data) {
    let distances = []
    let rescueDistances = []
    data.features.forEach(function(v){
      v.distance = vincenty.distVincenty(v.properties.POINT_Y,v.properties.POINT_X,event.data.lat,event.data.lng)/1000
      distances.push(v)
      if (event.data.report != null) {
      let unitAccreditations = event.data.report[v.properties.UNIT_CODE] 
      if (typeof unitAccreditations != "undefined") {
        let jobType = event.data.jType
        let combo = []

        switch (jobType) {
          case "FR":
          if (unitAccreditations['Flood Rescue in Water'] == "Available") {
            combo.push('In') 
          }
          if (unitAccreditations['Flood Rescue on Water'] == "Available") {
            combo.push('On') 
          }
          if (combo.length >= 1) {
            v.properties.QUAL = combo.join('/')
            rescueDistances.push(v)
          }
          break;
          case "RCR":
          if (unitAccreditations['GLR'] == "Available") {
            v.properties.QUAL = 'GLR'
            rescueDistances.push(v)
          }
          break
          case "VR":
          if (unitAccreditations['Vertical Rescue'] == "Available") {
            rescueDistances.push(v)
          }
          break;
          default:
            if (unitAccreditations[jobType] == "Available") {
              rescueDistances.push(v)
            }
          break
        }
         }
        }
    })
    let _sortedDistances = distances.sort(function(a, b) {
      return a.distance - b.distance
    });

    let _sortedRescueDistances = rescueDistances.sort(function(a, b) {
      return a.distance - b.distance
    });
    
    let nearestLhqStrings = []
    for(let i = 0; i < 4; i++){
      if (typeof _sortedDistances[i] != "undefined") {
        let newDom = (
          <a type="button" class="btn btn-default btn-sm" style="margin-bottom:5px" data-unit={_sortedDistances[i].properties.UNIT_CODE}>{_sortedDistances[i].properties.HQNAME} ({_sortedDistances[i].distance.toFixed(2)} kms)</a>
        )
        $(newDom).click(function(e) {
          e.preventDefault()
          window.postMessage({ type: "FROM_LH_SETASSIGNEDUNIT", code: _sortedDistances[i].properties.UNIT_CODE}, "*");
        })
        nearestLhqStrings.push(newDom)
      }
    }

    let nearestRescueLhqStrings = []
    for(let i = 0; i < 4; i++){
      if (typeof _sortedRescueDistances[i] != "undefined") {
        let rescueString = ''
        if (typeof _sortedRescueDistances[i].properties.QUAL != 'undefined') { //they have an extra qual string on their unit from above logic
          rescueString = ` (${_sortedRescueDistances[i].properties.QUAL})`
        }
        let newDom = (
          <a type="button" class="btn btn-info btn-sm" style="margin-bottom:5px" data-unit={_sortedRescueDistances[i].properties.UNIT_CODE}>{_sortedRescueDistances[i].properties.HQNAME}{rescueString} ({_sortedRescueDistances[i].distance.toFixed(2)} kms)</a>
        )
        $(newDom).click(function(e) {
          e.preventDefault()
          window.postMessage({ type: "FROM_LH_SETASSIGNEDUNIT", code: _sortedRescueDistances[i].properties.UNIT_CODE}, "*");
        })
      nearestRescueLhqStrings.push(newDom)
      }
    }


    if (nearestLhqStrings.length == 0) {
      nearestLhqStrings.push('No Results')
    }

    if (nearestRescueLhqStrings.length == 0) {
      nearestRescueLhqStrings.push('No Results')
    }

    $('#nearest-lhq-text').empty()
    $('#nearest-lhq-text').append(nearestLhqStrings)


    $('#nearest-rescue-lhq-text').empty()
    $('#nearest-rescue-lhq-text').append(nearestRescueLhqStrings)

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

let job_asbestos_history = (
  <div class="form-group">
  <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px" src={chrome.runtime.getURL("icons/lh-black.png")} />Asbestos Register</label>
  <div id="asbestos-register-box" class="col-md-10 col-lg-8" style="width:inherit">
  <a style="color:white;background-color:red" id="asbestos-register-error"></a>
  <p id="asbestos-register-text" class="form-control-static">Waiting For An Address</p>
  </div>
  </div>
  );

  let job_contained_within_lhq = (
    <div class="form-group" id="contained-within-lhq-group">
    <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
    src={chrome.runtime.getURL("icons/lh-black.png")} /><span id="contained-within-lhq-label">Located Within</span></label>
    <div id="contained-within-lhq-box" class="col-md-9 col-lg-9">
    <div class="btn-toolbar" id="contained-within-lhq-text" style="margin: unset; margin-left: -5px;">
    <p class="form-control-static">Waiting For A Location</p>
    </div>
    </div>
    </div>
  );
  
  let job_nearest_lhq = (
    <div class="form-group">
    <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
    src={chrome.runtime.getURL("icons/lh-black.png")} />Closest LHQs</label>
    <div id="nearest-lhq-box" class="col-md-9 col-lg-9">
    <div class="btn-toolbar" id="nearest-lhq-text" style="margin: unset; margin-left: -5px;">
    <p class="form-control-static">Waiting For A Location</p>
    </div>
    </div>
    </div>
  );

  let job_nearest_rescue_lhq = (
    <div class="form-group" id="nearest-rescue-lhq-group" style="display: none;">
    <label class="col-md-2 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
    src={chrome.runtime.getURL("icons/lh-black.png")} /><span id="nearest-rescue-lhq-label">Closest Accreditred LHQs</span></label>
    <div id="nearest-rescue-lhq-box" class="col-md-9 col-lg-9">
    <div class="btn-toolbar" id="nearest-rescue-lhq-text" style="margin: unset; margin-left: -5px;">
    <p class="form-control-static">Waiting For A Location</p>
    </div>
    </div>
    </div>
  );


$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(2)').after(job_asbestos_history);

$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(14)').after(job_nearest_rescue_lhq);

$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(14)').after(job_nearest_lhq);

$('#createRfaForm > fieldset:nth-child(5) > div:nth-child(14)').after(job_contained_within_lhq);





console.log("injecting")

inject('jobs/create.js');
