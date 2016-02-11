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
  if (address.Street == null && address.Locality == null && address.Latitude == null && address.Longitude== null) {
    return renderError(
      'Unable to Perform Address Search. Address is not Geocoded.' +
      'Please edit the job and geocode the job location.'
    );
  }

  //addresses with only GPS
  if (address.Street == null && address.Locality == null) {
    return renderError(
      'Unable to Perform Address Search. Job location does not appear to ' +
      'at a street address.'
    );
  }

  var q;
  if(address.Street == null && address.Locality == null) {
    // address without a street or address but still geocoded
    q = address.PrettyAddress;
  }
  else {
    q = address.Street + ', ' + address.Locality;
  }
  q = q.substring(0 , 30);

  var now = new Date();
  var end = new Date();
  end.setYear(end.getFullYear() - 1);

  $.ajax({
    type: 'GET' ,
    url: '/Api/v1/Jobs/Search' ,
    data: {
      'Q':                  q.substring(0, 30),
      'StartDate':          end.toLocaleString(),
      'EndDate':            now.toLocaleString(),
      'ViewModelType':      2,
      'PageIndex':          1,
      'PageSize':           1000,
      'SortField':          'JobReceived',
      'SortOrder':          'desc',
      'LighthouseFunction': 'checkAddressHistory'
    } ,
    cache: false ,
    dataType: 'json' ,
    complete: function(response, textStatus) {
      var $job_view_history_container = $('#job_view_history_container');
      switch(textStatus){
        case 'success':
          if(response.responseJSON.Results.length) {
            var history_rows = {
              'exact': {
                title: 'Same Address',
                always_show: true,
                jobs: new Array()
              } ,
              'partial': {
                title: 'Apartment, Townhouse or Battleaxe',
                always_show: false,
                jobs: new Array()
              } ,
              'neighbour': {
                title: 'Immediate Neighbours',
                always_show: false,
                jobs: new Array()
              } ,
              'street': {
                title: 'Same Street',
                always_show: false,
                jobs: new Array()
              }
            };
            status_groups = {
              'active': ['new', 'acknowledged', 'tasked', 'referred'],
              'complete': ['complete', 'finalised'],
              'cancelled': ['cancelled', 'rejected']
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
              if(v.Id == jobId) {
                return true;
              }
 
              //No street number so it can only be the same road
              if(v.Address.StreetNumber == null || address.StreetNumber == null) {
                history_rows.street.jobs.push(v);
                return true;
              }
 
              // Construct Row
              if(v.Address.PrettyAddress == address.PrettyAddress) {
                history_rows.exact.jobs.push(v);
                return true;
              }
 
              // Not an exact address match, so include the address in the result row
              if(v.Address.StreetNumber.replace(/\D+/g, '') == address.StreetNumber.replace(/\D+/g, '')){
                history_rows.partial.jobs.push(v);
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
                return true;
              }
              history_rows.street.jobs.push(v);
            });

            // create DOM elements for each history result section
            $.each(history_rows, function(group, d) {
              var section_inner = [];

              if(d.jobs.length) {
                var has_old = false;

                // Create all of the DOM elements to represent each history item
                // within each section
                $.each(d.jobs, function(idx, job) {
                  var thedate = new Date(
                    new Date(job.JobReceived).getTime() +
                    (new Date(job.JobReceived).getTimezoneOffset() * 60000)
                  );

                  // Older than 14 days - consider "old"
                  var isold = ( thedate.getTime() < ( now.getTime() - 14 * 24 * 60 * 60 * 1000 ) );
                  var tagarray = new Array();
                  $.each( job.Tags , function( tagIdx , tagObj ){
                    tagarray.push( tagObj.Name );
                  });
                  var cssarray = new Array(
                    'job_view_history_item',
                    'job_view_history_item_status_'+job.JobStatusType.Name.toLowerCase()
                  );
                  if(isold) {
                    cssarray.push('job_view_history_item_old');
                    has_old = true;
                  }
                  $.each(status_groups, function(status_group, statuses) {
                    if( statuses.indexOf(job.JobStatusType.Name.toLowerCase()) >= 0){
                      cssarray.push('job_view_history_item_statusgroup_' + status_group);
                    }
                  });

                  section_inner.push(     
                    <div class={cssarray.join(' ')}>
                      <div class="job_view_history_title">
                        <a href={"/Jobs/"+job.Id} class="job_view_history_id">{job.Identifier}</a>
                        <span class="job_view_history_address">{job.Address.PrettyAddress}</span>
                        <span class="job_view_history_status">{job.JobStatusType.Name}</span>
                      </div>
                      <div class="job_view_history_situation">
                        {( job.SituationOnScene == null ? <em>View job for more detail</em> : job.SituationOnScene )}
                      </div>
                      <div class="job_view_history_tags">
                        <i class="fa fa-tags"></i>
                        {( tagarray.length ? tagarray.join(', ') : <em>No Tags</em> )}
                      </div>
                      <div class="job_view_history_time">{moment(thedate).fromNow()}</div>
                    </div>
                  );
                });

                if(has_old) {
                  section_inner.push(
                    <div class="job_view_history_toggle_old">
                      <span>Show</span> Older Reports
                    </div>
                  );
                }
              }
              else if(d.always_show) {
                section_inner.push(
                  <div class="job_view_history_none">
                    <em>No Reports Found</em>
                  </div>
                );
              }

              var history_section;

              // now render the whole section
              if(d.jobs.length || d.always_show) {
                var jobs = d.jobs.length.toString() + ' Job' + (d.jobs.length == 1 ? 'job' : 'jobs');
                history_section = (
                  <fieldset id={"job_view_history_group_" + group} class="job_view_history_group col-md-12">
                    <legend>
                      {d.title}
                      <span class="group_size">{jobs}</span>
                    </legend>
                    <div class="form-group col-xs-12">{section_inner}</div>
                  </fieldset>
                );
              }

              if($job_view_history_container.data('phase') == 'loading' ) {
                $job_view_history_container.empty().data('phase', 'rendering');
              }

              $job_view_history_container.append(history_section);
              $job_view_history_container.data('phase', 'complete');
            });

            $('#job_view_history_groups div.job_view_history_toggle_old')
              .click(function() {
                var $t = $(this);
                var $p = $t.closest('fieldset.job_view_history_group');
                var $old_rows = $('div.job_view_history_item_old:not(.job_view_history_item_statusgroup_active)', $p);
                var toshow = $old_rows.filter(':hidden').length > 0;
                $old_rows.toggle(toshow);
                $('span', $t).text(toshow ? 'Hide' : 'Show');
              });
          }
          else {
            content = '<em>Address Search - No History</em>';
          }
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
