var inject = require('../../lib/inject.js');
var _ = require('underscore');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;
var $ = require('jquery');
var vincenty = require('../../lib/vincenty.js');

// inject all.css - browserify-css takes care of this
require('../../styles/jobs.view.css');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
    if (event.data.type && (event.data.type == "FROM_PAGE_LHQ_RESCUE_DISTANCE")) {
      $.getJSON(chrome.runtime.getURL("resources/SES_HQs.geojson"), function (data) {
        let rescueDistances = []
        data.features.forEach(function(v){
          v.distance = vincenty.distVincenty(v.properties.POINT_Y,v.properties.POINT_X,event.data.lat,event.data.lng)/1000

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
    
        let _sortedRescueDistances = rescueDistances.sort(function(a, b) {
          return a.distance - b.distance
        });
    
        let nearestRescueLhqStrings = []
        for(let i = 0; i < 4; i++){
          if (typeof _sortedRescueDistances[i] != "undefined") {
            let rescueString = ''
            if (typeof _sortedRescueDistances[i].properties.QUAL != 'undefined') { //they have an extra qual string on their unit from above logic
              rescueString = ` (${_sortedRescueDistances[i].properties.QUAL})`
            }
          nearestRescueLhqStrings.push(`${_sortedRescueDistances[i].properties.HQNAME}${rescueString} (${_sortedRescueDistances[i].distance.toFixed(2)} kms)`)
          }
        }
    
        if (nearestRescueLhqStrings.length == 0) {
          nearestRescueLhqStrings.push('No Results')
        }

        $('#nearest-rescue-lhq-text').empty()
        $('#nearest-rescue-lhq-text').append(nearestRescueLhqStrings.join(', '))

    
      })
    }
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
    // do nothing
  } else if (event.data.type && (event.data.type == "FROM_PAGE_LHQ_DISTANCE")) {
    var t0 = performance.now();
  $.getJSON(chrome.runtime.getURL("resources/SES_HQs.geojson"), function (data) {
    let distances = []
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
} else if (event.data.type && (event.data.type == "FROM_PAGE_LHQS")) {
  console.log("LHQS REQUESTED")
  $.getJSON(chrome.runtime.getURL("resources/SES_HQs.geojson"), function (data) {
    window.postMessage({type: "lhqs", data: data}, '*');
  })
  } else if (event.data.type && (event.data.type == "FROM_PAGE_ASSIGNEDLHQ")) { //return a single units GPS location
    console.log("ASSIGNED LHQ REQUESTED")
    $.getJSON(chrome.runtime.getURL("resources/SES_HQs.geojson"), function (data) {
      data.features.forEach(function(v){
        if (v.properties.UNIT_CODE == event.data.lhq.Code) {
          window.postMessage({type: "assignedLHQ", latitude: v.geometry.coordinates[1], longitude: v.geometry.coordinates[0]}, '*');
        }
      })
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
    src={chrome.runtime.getURL("icons/lh-black.png")} />
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
  src={chrome.runtime.getURL("icons/lh-black.png")} />
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
let job_view_history = (
  <fieldset id="job_view_history_groups" class="col-md-12">
  <legend class="main"><img style="width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.runtime.getURL("icons/lh-black.png")} />Job History <span>12 Months search by Address</span></legend>
  <div id="job_view_history_container">
  <div style="text-align:center">
  <img src="/Content/images/loading_30.gif" />
  </div>
  </div>
  </fieldset>
);

// Insert element into DOM - Will populate with AJAX results via checkAddressHistory()
let job_asbestos_history = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.runtime.getURL("icons/lh-black.png")} />Asbestos Register</label>
  <div id="asbestos-register-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <a style="color:white;background-color:red" id="asbestos-register-error"></a>
  <p id="asbestos-register-text" class="form-control-static">Searching...</p>
  </div>
  </div>
);

let job_nearest_lhq = (
  <div class="form-group">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.runtime.getURL("icons/lh-black.png")} /><abbr title="Distance as the crow flies">Closest LHQs </abbr></label>
  <div id="nearest-lhq-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <p id="nearest-lhq-text" class="form-control-static">Waiting...</p>
  </div>
  </div>
);

let job_nearest_rescue_lhq = (
  <div class="form-group" id="nearest-rescue-lhq-group" style="display: none;">
  <label class="col-xs-3 col-sm-2 col-md-4 col-lg-3 control-label"><img style="margin-left:-21px;width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.runtime.getURL("icons/lh-black.png")} /><abbr title="Distance as the crow flies">Closest Accreditred LHQs</abbr></label>
  <div id="nearest-rescue-lhq-box" class="col-xs-9 col-sm-10 col-md-8 col-lg-9">
  <p id="nearest-rescue-lhq-text" class="form-control-static"></p>
  </div>
  </div>
);

let job_nearest_asset_widget = (
  <div class="widget" style="" id="lighthouse_nearestasset">
        <div class="widget-header">
          <h3><img style="width:16px;vertical-align:inherit;margin-right:5px" src={chrome.runtime.getURL("icons/lh-black.png")} /> Nearest Asset Locations</h3>
          <span class="pull-right btn-group btn-group-sm" data-toggle="buttons">
          <button id="assetLocationButtonFiltered" type="button" class="btn btn-inactive"><span class="text">Filtered Only</span></button>
          <button id="assetLocationButtonActiveOnly" type="button" class="btn btn-inactive"><span class="text">Active Only</span></button>
            <button id="assetLocationButtonAll" type="button" class="btn btn-inactive"><span class="text">All</span></button>
            <button id="assetLocationButtonOff" type="button" class="btn btn-active"><span class="text">Off</span></button>
          </span>
          <span class="pull-right btn-group btn-group-sm" data-toggle="buttons" style="margin-right: 5px">
          <button id="assetLocationButtonRefresh" type="button" class="btn btn-inactive"><span class="text"><i class="fa fa-refresh" style="margin-right:0px"></i></span></button>
          </span>
        </div>
        <div class="widget-content" style="display:none" id="nearest-asset-geoerror" >
        <div class="alert alert-danger text-center widget-content">
        <div class="form-group">
          Address not geocoded - Cannot calculate any asset distances without a geocoded address.
        </div>
      </div>
        </div>
        <div class="widget-content" id="nearest-asset-box" style="display:none">
        <div style="overflow-y: scroll; max-height: 260px;">
          <table class="table text-center" id="nearest-asset-table">
          <thead>
            <tr>
              <th scope="col" class="text-center">Callsign</th>
              <th scope="col" class="text-center">Locate</th>
              <th scope="col" class="text-center">Owner</th>
              <th scope="col" class="text-center">Abs Distance & Bearing</th>
              <th scope="col" class="text-center">Talkgroup</th>
              <th scope="col" class="text-center">Last Update</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
        </div>
        <div class="text-center" id="asset-route-warning" style="visibility:hidden">Travel distance and time are estimates and should not be used for navigation or response times</div>
        <div id="asset-map-container" style="height: 450px; position: relative;">
        <div id="asset-map" style="height: 450px;">
          <div id="asset-map-loading" class="leaflet-loader-container">
            <div class="leaflet-loader-background">
              <div class="leaflet-loader">Loading...</div>
            </div>
          </div>
        </div>
        </div>
        <div id="asset-draw-time"></div>
        <div id="filter-warning" style="visibility:hidden"></div>
        </div>
  </div>
);



let asset_filter_modal = (
      <div id="LHAssetFilterModal" class="modal fade" role="dialog">
 <div class="modal-dialog modal-sm" style="width:50%">
    <div class="modal-content">
       <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal">&times;</button>
          <h4 class="modal-title">Lighthouse Asset Filter</h4>
       </div>
       <div class="modal-body">
          <h4>Select assets to show</h4>
          <p/>
          <div class="container-fluid">

             <div class='row' style="display: flex; align-items: center;">
                <div class="col-md-5 text-center">
                <h5>All Assets</h5>
                <input type="text" style="width: 100%; margin:auto; margin-bottom: 5px" id="assetListAllQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
                <div id="asset-map-filter-loading" class="filter-loader-container">
                  <div class="filter-loader-background">
                    <div class="filter-loader">Loading...</div>
                  </div>
                  </div>
                   <select multiple id="assetFilterListAll">
                   </select>
                </div>
                <div class="col-md-2 text-center">
                <div>
                   <div>
                      <button style="margin-bottom: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListAddSelected">Add<span style="margin-left: 10px;" class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span></button>
                   </div>
                   <div>
                      <button style="margin-top: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListRemoveSelected"><span style="margin-right: 10px;" class="glyphicon glyphicon-arrow-left" aria-hidden="true"></span>Remove</button>
                   </div>
                   </div>
                </div>
                <div class="col-md-5 text-center">
                <h5>Selected Assets</h5>
                <input type="text" style="width: 100%; margin:auto; margin-bottom: 5px" id="assetListSelectedQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
                   <select multiple id="assetFilterListSelected">
                   </select>
                </div>
             </div>
          </div>
       </div>
       <div class="modal-footer">
          <button type="button" class="btn btn-primary" id="assetSaveFiltersButton" data-dismiss="modal">Proceed</button>
       </div>
    </div>
 </div>
</div>
)




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
    $v.parent().after(job_nearest_rescue_lhq)

    $v.parent().after(job_nearest_lhq)
    return false;
  }
})

let job_lighthouse_actions = (
  <div id="lighthouse_actions" class="widget actions-box" style="">
    <div class="widget-header">
        <h3><img style="width:16px;vertical-align:inherit;margin-right:5px"
  src={chrome.runtime.getURL("icons/lh-black.png")} /> Lighthouse Actions</h3>
    </div>
    <div class="widget-content" id="lighthouse_actions_content">
    </div>
  </div>
)

$('div.widget.actions-box').after(job_lighthouse_actions)
$('#map').parent().before(job_nearest_asset_widget)

var $mapblock = $(
  <div id="lighthouse_mapblock">
  <div>Click to zoom or move map</div>
  </div>
  );

$mapblock
.click(function(e){
  $(this).hide();
  e.stopPropagation();
});

$('#asset-map-container').prepend($mapblock)
.mouseleave(function(_e) {
  $mapblock.show();
});

$( "body" ).append(asset_filter_modal)


// inject the coded needed to fix visual problems
// needs to be injected so that it runs after the DOMs are created
// We run this last because we want to ensure the elements created above have
// been loaded into the DOM before the injected script runs
inject('jobs/view.js');
