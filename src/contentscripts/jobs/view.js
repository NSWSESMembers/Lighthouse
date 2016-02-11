var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var $ = require('jquery');

function renderQuickText(id, selections) {
  return (
    <div class="form-group">
      <div class="row">
        <label class="col-md-4 col-lg-3 control-label">
          <img style="width:16px;vertical-align:top;margin-right:5px"
               src={chrome.extension.getURL("icons/lh-black.png")} />
          Quick Text
        </label>
        <div class="col-md-8 col-lg-9">
          <select class="form-control" id={id} style="width:100%">
            {
              _.map(selections, function(selection) {
                return <option>{selection}</option>;
              })
            }
          </select>
        </div>
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
    <div class="row">
      <label class="col-md-4 col-lg-3 control-label">
        <img style="width:16px;vertical-align:top;margin-right:5px"
             src={chrome.extension.getURL("icons/lh-black.png")} />
        Quick Tasks
      </label>
      <div class="col-md-8 col-lg-9">
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
  </div>
);

// Quick Text - Job - Team Complete
var html2 = renderQuickText("CompleteTeamQuickTextBox", [
  "",
  "NSW SES volunteers attended scene and resident no longer required assistance.",
])

$('#completeTeamModal .modal-body .form-group:nth-child(12)').after([html, html2]);

// Insert element into DOM - Will populate with AJAX results via checkAddressHistory()
job_view_history = (
  <fieldset id="job_view_history_groups" class="col-md-12">
    <legend class="main"><img style="width:16px;vertical-align:inherit;margin-right:5px"
                 src={chrome.extension.getURL("icons/lh-black.png")} />Job History <span>12 Months search by Address</span></legend>
    <div id="job_view_history_container" data-phase="loading">
      <div style="text-align:center">
        <img src="/Content/images/loading_30.gif" />
      </div>
    </div>
  </fieldset>
);

$job_view_history_perfect = (
  <fieldset id="job_view_history" class="col-md-12">
    <legend><img style="width:16px;vertical-align:inherit;margin-right:5px"
             src={chrome.extension.getURL("icons/lh-black.png")} />Job History for Address</legend>
    <div class="form-group col-xs-12">
      <div style="text-align:center">
        <img
             src="/Content/images/loading_30.gif" />
      </div>
    </div>
  </fieldset>
);

$job_view_history_fuzzy = (
    <fieldset id="job_view_history_fuzzy" class="col-md-12">
    <legend><img style="width:16px;vertical-align:inherit;margin-right:5px"
             src={chrome.extension.getURL("icons/lh-black.png")} />Job History for Neighbours and Street (12 Months)</legend>
    <div class="form-group col-xs-12">
      <div style="text-align:center">
        <img
             src="/Content/images/loading_30.gif" />
      </div>
    </div>
    </fieldset>
);

$('fieldset.col-md-12 legend').each(function(k,v){
  var $v = $(v);
  var $p = $v.closest('fieldset');
  var section_title = $v.text().trim();
  if( section_title.indexOf( 'Notes' ) === 0 || section_title.indexOf( 'Messages' ) === 0 ){
    $p.before(job_view_history);
    //$p.before($job_view_history_perfect);
    //$p.before($job_view_history_fuzzy);
    return false; // break out of $.each()
  }
});

// inject the coded needed to fix visual problems
// needs to be injected so that it runs after the DOMs are created
// We run this last because we want to ensure the elements created above have
// been loaded into the DOM before the injected script runs
inject('jobs/view.js');
