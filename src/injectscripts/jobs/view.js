var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var $ = require('jquery');

console.log("Running content script");

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(function(d) {
  cleanupBr();
});

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(function(d) {
  cleanupBr();
});

//call on run
cleanupBr();


document.title = "#"+jobId;

function cleanupBr() {
  console.log("BR cleanup called")
  //only run if messages and notes have loaded in (causes problems overwise and won't load)
  var selector = '.job-details-page div[data-bind="foreach: opsLogEntries"] div[data-bind="text: Text"]';

  $(selector).each(function() {
    var text = $(this).html();
    var replaced = text.replace(/&lt;br&gt;/g, '<br />');
    $(this).html(replaced);
  });

  try { //get rid of the loading image which some times gets suck. i assume a race condition it the cause
    var progress = document.getElementById("editRfaForm").getElementsByClassName("col-xs-12 text-center");
    progress[0].parentNode.removeChild(progress[0]);
  } catch (err) {
    console.log(err.messages);
  }
}


document.getElementById("FinaliseQuickTextBox").onchange = function() {
  console.log(this.value);
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.finalisationText(this.value);
}

document.getElementById("CompleteQuickTextBox").onchange = function() {
  console.log(this.value);
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.finalisationText(this.value);
}


masterViewModel.completeTeamViewModel.primaryActivity.subscribe(function(newValue) {
  if (typeof newValue !== 'undefined') {
    if (newValue !== null) {
      switch (newValue.Name) {
        case "Storm":
          removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
          var quickText = ["", "No damage to property, scene safe. Resident to arrange for clean up.", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe.", "Branch/tree sectioned; resident/owner to organize removal"]
          document.getElementById("CompleteTeamQuickTextBox").removed
          for (var i = 0; i < quickText.length; i++) {
            var opt = document.createElement('option');
            opt.text = quickText[i];
            opt.value = quickText[i];
            document.getElementById("CompleteTeamQuickTextBox").add(opt);
          }
          break;
        case "Search":
          removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
          var quickText = ["", "All teams complete on search, person found safe and well.", "All teams complete on search, nothing found."]
          for (var i = 0; i < quickText.length; i++) {
            var opt = document.createElement('option');
            opt.text = quickText[i];
            opt.value = quickText[i];
            document.getElementById("CompleteTeamQuickTextBox").add(opt);
          }
          break;
      }
    }
  }
});

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function removeOptions(selectbox) {
  var i;
  for (i = selectbox.options.length - 1; i >= 0; i--) {
    selectbox.remove(i);
  }
}

//take the clicked list option and set the complete action the value of this.
document.getElementById("CompleteTeamQuickTextBox").onchange = function() {
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.completeTeamViewModel.actionTaken(this.value);
}


$(document).ready(function() {
  _.each([
    ["#stormtree", "Storm", "Tree Operations/Removal"],
    ["#stormproperty", "Storm", "Property Protection"],
    ["#stormsafety", "Storm", "Public Safety"],
    ["#stormacccess", "Storm", "Road/Access Clearance"],
    ["#stormrecon", "Storm", "Reconnaissance"],
    ["#rcrcallof", "RoadCrashRescue", "Call Off"],
    ["#rcrcallextricate", "RoadCrashRescue", "Extrication"],
  ], function(args) {
    var selector = args[0]
      , parent = args[1]
      , child = args[2];

    $(args[0]).click(function() {
      masterViewModel.completeTeamViewModel.availablePrimaryActivities.peek().forEach(function(d){
        if (d.Name == parent) {
          masterViewModel.completeTeamViewModel.primaryActivity(d);
          masterViewModel.completeTeamViewModel.availablePrimaryTasks.subscribe(function(d) {
            d.forEach(function(d) {
              if (d.Name == child) {
                masterViewModel.completeTeamViewModel.primaryTask(d)
              }
            });
          })
        }
      });
    });
  });
});


function checkAddressHistory(){
  var date_options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };

  var address = masterViewModel.geocodedAddress();
  if(typeof address == 'undefined') {
    // address not available yet (probably waiting for server to respond to
    // AJAX. Try again soon.
    setTimeout(checkAddressHistory, 500);
    return;
  }

  //dont allow searches if the job has not been geocoded
  if(address.Street == null && address.Locality == null && address.Latitude == null && address.Longitude== null) {
    return renderError(
      'Unable to Perform Address Search. Address is not Geocoded.' +
      'Please edit the job and geocode the job location.'
    );
  }

  //addresses with only GPS
  if(address.Street == null && address.Locality == null) {
    return renderError(
      'Unable to Perform Address Search. Job location does not appear to ' +
      'at a street address.'
    );
  }

  var q;
  if(address.Street == null && address.Locality == null) {
    // address without a street or address but still geocoded
    q = address.PrettyAddress;
  } else {
    q = address.Street + ', ' + address.Locality;
  }
  q = q.substring(0, 30);

  var now = new Date();
  var end = new Date();
  end.setYear(end.getFullYear() - 1);

  $.ajax({
    type: 'GET'
    , url: '/Api/v1/Jobs/Search'
    , data: {
      'Q':                    q.substring(0, 30)
      , 'StartDate':          end.toLocaleString()
      , 'EndDate':            now.toLocaleString()
      , 'ViewModelType':      2
      , 'PageIndex':          1
      , 'PageSize':           1000
      , 'SortField':          'JobReceived'
      , 'SortOrder':          'desc'
      , 'LighthouseFunction': 'checkAddressHistory'
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      var $job_view_history_container = $('#job_view_history_container');
      switch(textStatus){
        case 'success':
          if(response.responseJSON.Results.length) {
            var history_rows = { 'exact':     { title :        'Same Address'
                                              , always_show : true
                                              , hide_old :    false
                                              , has_old :     false
                                              , jobs :        new Array() }
                               , 'partial':   { title :         'Apartment, Townhouse or Battleaxe'
                                              , always_show : false
                                              , hide_old :    false
                                              , has_old :     false
                                              , jobs :        new Array() }
                               , 'neighbour': { title :         'Immediate Neighbours'
                                              , always_show : false
                                              , hide_old :    false
                                              , has_old :     false
                                              , jobs :        new Array() }
                               , 'street':    { title :         'Same Street'
                                              , always_show : false
                                              , hide_old :    true
                                              , has_old :     false
                                              , jobs :        new Array() } };
            status_groups = {
                'active' :    ['new', 'acknowledged', 'tasked', 'referred']
              , 'complete' :  ['complete', 'finalised']
              , 'cancelled' : ['cancelled', 'rejected']
            };

            if(address.StreetNumber != null){
              var re_StreetNumber_Parts = /^(?:(\d+)\D)?(\d+)\D*/;
              var jobAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
                address.StreetNumber);
              var jobAddress_StreetNumber_Max = parseInt(
                jobAddress_StreetNumber_tmp[2], 10);
              var index = typeof jobAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
              var jobAddress_StreetNumber_Min = parseInt(
                jobAddress_StreetNumber_tmp[index], 10);
            }
            $.each(response.responseJSON.Results, function(k, v) {
              // History Job is Current Job
              if(v.Id == jobId) return true;
 
              // Santitise and Pre-Process Job Details (for later display)
              // Job URL
              v.url = '/Jobs/'+v.Id;
              // Adjust the Job Recieved Time
              v.JobReceived = new Date(
                new Date(v.JobReceived).getTime() +
                (new Date(v.JobReceived).getTimezoneOffset() * 60000)
              );
              // Generate the Relative Time
              v.relativeTime = moment(v.JobReceived).fromNow();
              // Is the Job Older than 14 Days
              v.isold = ( v.JobReceived.getTime() < ( now.getTime() - 14 * 24 * 60 * 60 * 1000 ) );
              // Default value for Situation on Scene
              if(v.SituationOnScene == null) v.SituationOnScene = (<em>View job for more detail</em>);
              // Job Tags
              var tagArray = new Array();
              $.each( v.Tags , function( tagIdx , tagObj ){
                tagArray.push( tagObj.Name );
              });
              v.tagString = ( tagArray.length ? tagArray.join(', ') : (<em>No Tags</em>) );
              // Job CSS Classes
              v.cssClasses = 'job_view_history_item job_view_history_item_status_' + v.JobStatusType.Name.toLowerCase();
              if(v.isold) v.cssClasses += ' job_view_history_item_old';
              $.each(status_groups, function(status_group, statuses) {
                if( statuses.indexOf(v.JobStatusType.Name.toLowerCase()) >= 0){
                  v.cssClasses += ' job_view_history_item_statusgroup_' + status_group;
                }
              });

              // No street number so it can only be the same road
              if(v.Address.StreetNumber == null || address.StreetNumber == null) {
                history_rows.street.jobs.push(v);
                history_rows.street.has_old = history_rows.street.has_old || v.has_old;
                return true;
              }
 
              // Construct Row
              if(v.Address.PrettyAddress == address.PrettyAddress) {
                history_rows.exact.jobs.push(v);
                history_rows.exact.has_old = history_rows.exact.has_old || v.has_old;
                return true;
              }
 
              // Not an exact address match, so include the address in the result row
              if(v.Address.StreetNumber.replace(/\D+/g, '') == address.StreetNumber.replace(/\D+/g, '')){
                history_rows.partial.jobs.push(v);
                history_rows.partial.has_old = history_rows.partial.has_old || v.has_old;
                return true;
              }
              var rowAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
                v.Address.StreetNumber);
              var rowAddress_StreetNumber_Max = parseInt(
                rowAddress_StreetNumber_tmp[2], 10);
              var index = typeof rowAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
              var rowAddress_StreetNumber_Min = parseInt(
                rowAddress_StreetNumber_tmp[index], 10);
              if (Math.abs(jobAddress_StreetNumber_Min - rowAddress_StreetNumber_Max) == 2 ||
                  Math.abs(jobAddress_StreetNumber_Max - rowAddress_StreetNumber_Min) == 2) {
                history_rows.neighbour.jobs.push(v);
                history_rows.neighbour.has_old = history_rows.neighbour.has_old || v.has_old;
                return true;
              }
              history_rows.street.jobs.push(v);
              history_rows.street.has_old = history_rows.street.has_old || v.has_old;
            }); // Loop End - response.responseJSON.Results

            // Use JSX to Render
            $job_view_history_container.html(
              <div>
              {_.map(_.filter(history_rows, function(row) { return row.always_show || row.jobs.length; }), function(groupData, groupKey){
                return (
                  <fieldset id={"job_view_history_group_" + groupKey} class="job_view_history_group col-md-12">
                    <legend>
                      {groupData.title}
                      <span class="group_size">{groupData.jobs.length + ' Job' + (groupData.jobs.length == 1 ? '' : 's')}</span>
                    </legend>
                    <div class="form-group col-xs-12">
                      {(groupData.jobs.length == 0
                        ? <div class="job_view_history_none"><em>No Reports Found</em></div>
                        : _.map(groupData.jobs, function(j){
                            return (
                              <div class={j.cssClasses}>
                                <div class="job_view_history_title">
                                  <a href={j.url} class="job_view_history_id">{j.Identifier}</a>
                                  <span class="job_view_history_address">{j.Address.PrettyAddress}</span>
                                  <span class="job_view_history_status">{j.JobStatusType.Name}</span>
                                </div>
                                <div class="job_view_history_situation">{j.SituationOnScene}</div>
                                <div class="job_view_history_tags">
                                  <i class="fa fa-tags"></i>
                                  {j.tagString}
                                </div>
                                <div class="job_view_history_time">{j.relativeTime}</div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </fieldset>
                );
              })}
              </div>
            );

            // Show/Hide Handler
            $('#job_view_history_groups div.job_view_history_toggle_old')
              .click(function() {
                var $t = $(this);
                var $p = $t.closest('fieldset.job_view_history_group');
                var $old_rows = $('div.job_view_history_item_old:not(.job_view_history_item_statusgroup_active)', $p);
                var toshow = $old_rows.filter(':hidden').length > 0;
                $old_rows.toggle(toshow);
                $('span', $t).text(toshow ? 'Hide' : 'Show');
              });

            // We've Inserted the History - Stop Here
            return;
          }
          content = '<em>Address Search - No History</em>';
          break;
        case 'error' :
          content = '<em>Unable to Perform Address Search</em>';
          break;
        case 'nocontent' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
        case 'timeout' :
          content = '<em>Address Search Timed Out</em>';
          break;
        case 'abort' :
          content = '<em>Address Search Aborted</em>';
          break;
        case 'parsererror' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
      }

      // Showing an Error Message
      $job_view_history_container.html(content);
    }
  });
}

setTimeout(checkAddressHistory, 400);

function renderHistoryError(text) {
  return (
    <div>
      <em>{text}</em>
    </div>
  );
}

function renderError(text) {
  $('#job_view_history div.form-group').empty().append(
    <em>{text}</em>
  );
}
