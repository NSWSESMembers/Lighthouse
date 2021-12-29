var inject = require('../../../lib/inject.js');
var _ = require('underscore');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');
var vincenty = require('../../../lib/vincenty.js');


window.addEventListener("message", function(event) {
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FROM_PAGE_FTASBESTOS_SEARCH")) {
    chrome.runtime.sendMessage({type: "asbestos", address: event.data.address}, function(response) {
    if (response.resultbool == false)
      {
        response.requrl = ''
      }
      asbestosBoxColor(response.result,response.colour,response.requrl)
    });
  } else if (event.data.type && (event.data.type == "FROM_PAGE_SESASBESTOS_RESULT")) {
    asbestosBoxColor(event.data.address.PrettyAddress+" was FOUND on the SES asbestos register.",'red','')
  } else if (event.data.type && (event.data.type == "FROM_PAGE_UPDATE_API_TOKEN")) {

  } else if (event.data.type && (event.data.type == "FROM_PAGE_LHQ_DISTANCE")) {
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
    $('#asbestos-register-box')
      .css('cursor','pointer')
      .click(function(){
        window.open(url)
      });
  }
  if (color != "") {
    $('#asbestos-register-box')[0].style.color = "white"
    $('#asbestos-register-box').css({'background' :'linear-gradient(transparent 8px, '+color+' -10px'});
  }
}


function renderQuickText(id, selections) {
  return (
    <div class="form-group">
    <label class="col-md-4 col-lg-3 control-label">
    <img style="width:16px;vertical-align:top;margin-right:5px"
    src={chrome.extension.getURL("icons/lh-black.png")} />
    Quick Text
    </label>
    <div class="col-md-8 col-lg-9" style="margin-bottom: 15px;">
    <select class="form-control" id={id} style="width:100%">
    {
      _.map(selections, function(selection) {
        return <option>{selection}</option>;
      })
    }
    </select>
    </div>
    </div>
    );
}





// Quick Text - Job - Finalise
$('#finaliseJobModal .modal-body .form-group:nth-child(1)').after(
  renderQuickText("FinaliseQuickTextBox", [
    "",
    "All paperwork and documentation completed",
    "NFA",
    "Job completed"
    ])
  );

// Quick Text - Job - Complete
// this is nth-child(1) even though there are more elements because
// at the time this code _usually_ runs knockout hasn't been initialised
// yet so there are less elements than after it has rendered.
// TODO: make this more intelligent by searching for the appropriate
// label and inserting before/after that.
$('#completeRescueModal .modal-body .form-group:nth-child(1)').after(
  renderQuickText("CompleteQuickTextBox", [
    "",
    "All paperwork and documentation completed",
    "NFA",
    "NFA SES. Referred to council",
    "Job completed"
    ])
  );

// Quick Actions - Job - Team Complete
var options = [
["Storm/Tree Ops",         "stormtree",        "tag-task"],
["Storm/Property Protect", "stormproperty",    "tag-task"],
["Storm/Public Safety",    "stormsafety",      "tag-task"],
["Storm/Road Access",      "stormaccess",      "tag-task"],
["Storm/Recon",            "stormrecon",       "tag-task"],
["RCR/Calloff",            "rcrcalloff",       "tag-rescue"],
["RCR/Extricate",          "rcrcallextricate", "tag-rescue"]
];

var html = (
  <div class="form-group">
  <label class="col-md-4 col-lg-3 control-label">
  <img style="width:16px;vertical-align:top;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} />
  Quick Tasks
  </label>
  <div class="col-md-8 col-lg-9" style="margin-bottom: 15px;">
  {
    _.map(options, function(option) {
      return (
        <span id={option[1]} class={'label tag tag-disabled '+option[2]}>
        <span class="tag-text">{option[0]}</span>
        </span>
        );
    })
  }
  </div>
  </div>
);

// Quick Text - Job - Team Complete
var html2 = renderQuickText("CompleteTeamQuickTextBox", [
  "",
  "NSW SES volunteers attended scene and resident no longer required assistance.",
  ])

$('#completeTeamModal > div > div > div.modal-body > div > div > div > textarea[data-bind$="value: actionTaken"]').parent().parent().after([html, html2]);

// Insert element into DOM - Will populate with AJAX results via checkAddressHistory()
job_view_history = (
  <fieldset id="job_view_history_groups" class="col-md-12">
  <legend class="main"><img style="width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} />Job History <span>12 Months search by Address</span></legend>
  <div id="job_view_history_container">
  <div style="text-align:center">
  <img src="/Content/images/loading_30.gif" />
  </div>
  </div>
  </fieldset>
);

// Insert element into DOM - Will populate with AJAX results via checkAddressHistory()
job_asbestos_history = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} />Asbestos Register</label>
  <div id="asbestos-register-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <a style="color:white;background-color:red" id="asbestos-register-error"></a>
  <p id="asbestos-register-text" class="form-control-static">Searching...</p>
  </div>
  </div>
);

job_what3words = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} />what3words</label>
  <div id="what3words-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <p id="what3words-text" class="form-control-static">
	<span style="color:#E11F26">///</span> <span style="color:#bbb">&mdash;.&mdash;.&mdash;</span>
  </p>
  </div>
  </div>
);

job_nearest_lhq = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} /><abbr title="Distance as the crow flies">Closest LHQs </abbr></label>
  <div id="nearest-lhq-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <p id="nearest-lhq-text" class="form-control-static">Waiting...</p>
  </div>
  </div>
);

job_nearest_avl = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} /><abbr title="As reported and filtered by Beacon, distance as the crow flies">Closest AVLs </abbr></label>
  <div id="nearest-avl-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <p id="nearest-avl-text" class="form-control-static">Waiting...</p>
  </div>
  </div>
);

$('fieldset.col-md-12').each(function(k,v){
  var $v = $(v);
  var $p = $v.closest('fieldset');
  var section_title = $v.text().trim();
  if( section_title.indexOf( 'Notes' ) === 0 || section_title.indexOf( 'Messages' ) === 0 ){
    $p.before(job_view_history);
    return false; // break out of $.each()
  }
});

$('fieldset.col-md-12').each(function(k,v){
  var $v = $(v);
  var section_title = $v[0].children[0].innerText;

  if(section_title.indexOf( 'Job Details' ) === 0 ) {
    $v.append(job_asbestos_history)
    return false;
  }

})


$('#editRfaForm > fieldset.col-md-8 > div > label').each(function(k,v){
  var $v = $(v);
  if (v.innerText == 'LGA') {
    $v.parent().after(job_nearest_avl)
    $v.parent().after(job_nearest_lhq)
    return false;
  }
})

$('#editRfaForm > fieldset.col-md-8 > div > label').each(function(k,v){
  var $v = $(v);
  if (v.innerText == 'Lat/Long') {
    $v.parent().after(job_what3words)
    return false;
  }
})

job_lighthouse_actions = (
  <div id="lighthouse_actions" class="widget actions-box" style="">
    <div class="widget-header">
        <h3><img style="width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.extension.getURL("icons/lh-black.png")} /> Lighthouse Actions</h3>
    </div>
    <div class="widget-content" id="lighthouse_actions_content">
    </div>
  </div>
)

$('div.widget.actions-box').after(job_lighthouse_actions)


// inject the coded needed to fix visual problems
// needs to be injected so that it runs after the DOMs are created
// We run this last because we want to ensure the elements created above have
// been loaded into the DOM before the injected script runs
inject('jobs/view.js');
