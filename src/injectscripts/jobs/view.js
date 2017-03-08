var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var $ = require('jquery');

console.log("Running content script");

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(lighthouseKeeper);

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(lighthouseKeeper);

//if tasking update

masterViewModel.teamsViewModel.taskedTeams.subscribe(lighthouseTasking);


function lighthouseTasking() {
  console.log("Tasking Changes")
  ///Horrible nasty code for untasking

  $('div.widget-content div.list-group div.list-group-item.clearfix div.col-xs-6.small.text-right').each(function(k, v) { //for every dom

    //pull out the call sign and the status
    DOMCallsign = ($(this)[0].parentNode.children[0].children[0].href.split("/")[4])
    DOMStatus = ($(this)[0].parentNode.children[1].innerText.split(" ")[0])

    //for every tasked team
    $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k,vv){

      //match against this DOM
      if (vv.Team.Id == DOMCallsign && vv.CurrentStatus == DOMStatus && vv.CurrentStatusId == 1) //only show for tasking that can be deleted (tasked only)
      { 
        //attached a X button if its matched and deletable
        test = return_untask_button()
        $(v).append(test)

        //click function
        $(test).click(function() {
          DOMCallsign = ($(this)[0].parentNode.parentNode.children[0].children[0].href.split("/")[4])
          DOMStatus = ($(this)[0].parentNode.parentNode.children[1].innerText.split(" ")[0])

          event.stopImmediatePropagation();
          $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k,v){

            if (v.Team.Id == DOMCallsign && v.CurrentStatus == DOMStatus) //match it again
            {
              untaskTeamFromJob(v.Team.Id, jobId, v.Id)  //untask it
            }
          })
        })
      }
    })
  })

////END horrible untask code

}


//call on run
lighthouseKeeper();


//call when the address exists
whenAddressIsReady(function() {
  console.log(masterViewModel.geocodedAddress.peek());
  window.postMessage({ type: "FROM_PAGE", address: masterViewModel.geocodedAddress.peek() }, "*");
})

whenTeamsAreReady(function(){



  lighthouseTasking()




  //checkbox for hide completed tasking
  $('#content div.col-md-5 div[data-bind="visible: teamsLoaded()"] div.widget-header').append(renderCheckBox());

  if (masterViewModel.sector.peek() !== null)
  {
    $('#content div.col-md-5 div[data-bind="visible: jobLoaded()"] div.widget-header').append(renderSectorFilterCheckBox());

    $('#lighthouseSectorFilterEnabled').click(function() {
    // Toggle Value
    var lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );
    // Save Value
    localStorage.setItem('LighthouseSectorFilterEnabled', lh_SectorFilterEnabled);

    sectorfilter_switch()


  });
    sectorfilter_switch()
  }

  $('#lighthouseEnabled').click(function() {
    // Toggle Value
    var lh_hideComplete = !( localStorage.getItem('LighthouseHideCompletedEnabled') == 'true' || localStorage.getItem('LighthouseHideCompletedEnabled') == null );
    // Save Value
    localStorage.setItem('LighthouseHideCompletedEnabled', lh_hideComplete);
    // Trigger Display Change
    taskingItems_switch();
  });
  
  taskingItems_prepare();

  quickTask = return_quicktaskbutton()

  //the quicktask button
  $(quickTask).find('button').click(function() {
    if ($(quickTask).hasClass("open") == false)
    {
      InstantTaskButton()
    }
  })

  if (masterViewModel.canTask.peek() == true)
  {
    $('div.widget.actions-box div.widget-content').append(quickTask);
  }

});

function sectorfilter_switch(){
  // Set flag
  var lh_SectorFilterEnabled = localStorage.getItem('LighthouseSectorFilterEnabled') == 'false';
  // Toggle class for checkbox
  $('#lighthouseSectorFilterEnabled')
  .toggleClass('fa-check-square-o', lh_SectorFilterEnabled)
  .toggleClass('fa-square-o', !lh_SectorFilterEnabled);
}

function taskingItems_prepare(){
  $('#content > div.col-md-5 > div:nth-child(2) > div.widget-content > div > div')
  .each(function(k,v){
    var $t = $(v);
    var isComplete = $('div:nth-child(1) > div.col-xs-6.small.text-right > span',$t).text().indexOf('Complete') === 0;
      // Add class "team_complete" to any Tasked Items where the status starts with "Complete"
      $t.toggleClass('team_complete', isComplete);
    })
  .click(taskingItems_individual);
  taskingItems_switch();
}
function taskingItems_switch(){
  // Set flag
  var hideComplete = localStorage.getItem('LighthouseHideCompletedEnabled') == 'false';
  // Toggle class for container
  $('#content > div.col-md-5 > div:nth-child(2)').toggleClass('team_complete_hidden', hideComplete);
  // Toggle class for checkbox
  $('#lighthouseEnabled')
  .toggleClass('fa-check-square-o', hideComplete)
  .toggleClass('fa-square-o', !hideComplete);
}

function taskingItems_individual(e){
  // Tasked Team Clicked On
  var $t = $(e.currentTarget);
  // Only Toggle Content if the Clicked Team is Complete
  if( $t.hasClass('team_complete') )
    $('div.row.clearfix:not(:contains("Set"))', $t).slideToggle();
}


document.title = "#"+jobId;

function lighthouseKeeper(){

  ////Quick Task Stuff


  var $targetElements = $('.job-details-page div[data-bind="foreach: opsLogEntries"] div[data-bind="text: $data"]');

console.log($targetElements)

  var ICEMS_Dictionary = {
    'ASNSW'   : 'NSW Ambulance' ,
    'FRNSW'   : 'NSW Fire &amp; Rescue' ,
    'NSWPF'   : 'NSW Police Force' ,
    'TMC'     : 'Transport Management Center',
    'NSWTMC'  : 'NSW Transport Management Center',

    'AA'      : 'As Above' ,
    'INFTS?'  : 'Informant/Caller' ,
    '\dPOBS?' : 'Person(s) On Board' ,
    'POIS?'   : 'Person(s) Of Interest' ,
    'POSS'    : 'Possible' ,
    'PTS?'    : 'Patient(s)' ,
    'VEHS?'   : 'Vehicle(s)' ,
    'VICT?'   : 'Victim' ,
    'Y[OR]'   : 'Years Old',
    'NPI'     : 'No Person(s) Injured',
    'NPT'     : 'No Person(s) Trapped',
    'NFI'     : 'No Further Information',
    'THX'     : 'Thanks'

  };

  $targetElements.each(function(v){
    var $t = $(this);
    var contentOrig = $t.html();
    var contentRepl = contentOrig;
    // '<br>' to HTML LineBreaks
    contentRepl = contentRepl.replace(/&lt;br(?:\s*\/)?&gt;/g, '<br />');
    // '\n' to HTML LineBreaks
    contentRepl = contentRepl.replace(/\s*\\n/, '<br />');
    // ICEMS Dictionary
    _.each(ICEMS_Dictionary, function(clearText, abbrText){
      var contentTemp = contentRepl;
      contentRepl = contentRepl.replace(new RegExp('\\b(' + abbrText + ')\\b', 'gi'), '<abbr title="' + clearText + '">$1</abbr>');
    });
    if(contentRepl != contentOrig){
      $t.html(contentRepl).addClass('lighthouseKeeper-modified');
    }else{
      $t.addClass('lighthouseKeeper-nomodifications');
    }
  });

}


document.getElementById("FinaliseQuickTextBox").onchange = function() {
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.finalisationText(this.value);
}

document.getElementById("CompleteQuickTextBox").onchange = function() {
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

function InstantTaskButton() {

  var now = moment();
  var end = moment();
  end.subtract(1, 'y');

  alreadyTasked = []
  $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k,v){
    if(v.CurrentStatusId != 6)
    {
      alreadyTasked.push(v.Team.Id)
    }
  })
  $(quickTask).find('ul').empty();
  loading = (<li><a href="#"><i class="fa fa-refresh fa-spin fa-2x fa-fw"></i></a></li>)
  $(quickTask).find('ul').append(loading)

  UnitsToSearch = []

  if (user.hq.EntityTypeId != 1) {
    console.log("HQ Entity is not a unit, will resolve group")
    $.ajax({
      type: 'GET'
      , url: '/Api/v1/Entities/'+user.hq.Id+'/Children'
      , data: {LighthouseFunction: 'QuickTaskResolveChildrenOfEntity'}
      , cache: false
      , dataType: 'json'
      , complete: function(response, textStatus) {
        console.log('textStatus = "%s"', textStatus, response);
        if(textStatus == 'success')
        {
          if(response.responseJSON.length) {
            $.each(response.responseJSON, function(k,v){
              UnitsToSearch.push(v.Id);
            })
          }
          GetQuickTaskTeams(UnitsToSearch)
        }
      }
    })

  } else {
    UnitsToSearch.push(user.currentHqId)
    GetQuickTaskTeams(UnitsToSearch)

  }


  function GetQuickTaskTeams(UnitsToSearch) {



    theData = {
      'StartDate':          end.toISOString()
      , 'EndDate':            now.toISOString()
      , 'TypeIds[]':          1
      , 'IncludeDeleted':     false
      , 'StatusTypeId[]':     3
      , 'PageIndex':          1
      , 'PageSize':           1000
      , 'SortField':          'Callsign'
      , 'SortOrder':          'asc'
      ,'LighthouseFunction': 'InstantTaskButton' 
    }

    AssignedToId = []
    CreatedAtId = []
    $.each(UnitsToSearch, function(k,v){
      AssignedToId.push(v)
      CreatedAtId.push(v)
    })

    theData.AssignedToId = AssignedToId
    theData.CreatedAtId = CreatedAtId

    lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );



    if (masterViewModel.sector.peek() !== null && lh_SectorFilterEnabled === true )
    {
      theData.SectorIds = masterViewModel.sector.peek().Id
      theData.Unsectorised = true
    }

    $.ajax({
      type: 'GET'
      , url: '/Api/v1/Teams/Search'
      , data: theData
      , cache: false
      , dataType: 'json'
      , complete: function(response, textStatus) {
        console.log('textStatus = "%s"', textStatus, response);
        if(textStatus == 'success')
        {
          if(response.responseJSON.Results.length) {
            $(quickTask).find('ul').empty();

            /////
            ///// Search Box
            /////
            theSearch = return_search_box()

            $(theSearch).click(function (e) {
              e.stopPropagation();
            });

            $(theSearch).keyup(function (e) {
              e.stopPropagation();
              console.log(e.target.value)
              $.each($(quickTask).find('ul').find('li[role!="presentation"]'),function(k,v){
                if (($(v)[0].innerText).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
                {
                  $(v).hide()
                } else {
                 $(v).show()
               }
             })

            });

            /////
            ///// END Search Box
            /////


            $(quickTask).find('ul').append(theSearch);


            sector = {}
            nonsector = []
            $.each(response.responseJSON.Results, function(k, v) { //for every team that came back
          if ($.inArray(v.Id,alreadyTasked) == -1) //not a currently active team on this job, so we can task them
          {
            var item;
            if (v.Members.length == 0)
            {
              item = return_li(v.Id,v.Callsign.toUpperCase(),null,v.TaskedJobCount+"");
            } else
            {
              $(v.Members).each(function(k, vv) {
                if (vv.TeamLeader)
                {
                  item = return_li(v.Id,v.Callsign.toUpperCase(),vv.Person.FirstName+" "+vv.Person.LastName,v.TaskedJobCount+"");
                  $(item).click(function () {
                    TaskTeam(v.Id)
                  })
                }
              })
            }
            if (v.Sector === null)
            {
              nonsector.push(item)
            } else {
              var sectorName = v.Sector.Name;
              if (sectorName in sector)
              {
                sector[sectorName].push(item)
              } else {
                sector[sectorName] = [item]
              }
            }
            
          }
        })
finalli = []
drawnsectors = []


          //finalli.push(return_lipres(masterViewModel.sector.peek().Name+" Sector Teams"));
          $.each(sector, function(k, v){
            if (k in drawnsectors)
            {
              finalli.push(v)
            } else {
              drawnsectors.push(k)
              //if (finalli.length != 0) { finalli.push(return_lidivider()) };
              finalli.push(return_lipres(k+ " Sector"))
              finalli.push($(v))
            }
          })
          //finalli.push(return_lidivider());
          finalli.push(return_lipres("Unsectorised Teams"));
          $.each(nonsector, function(k, v){
            finalli.push(v)
          })
          $(quickTask).find('ul').append(finalli)

        } else {
          $(quickTask).find('ul').empty();

          no_results = (<li><a href="#">No Active Field Teams</a></li>)
          $(quickTask).find('ul').append(no_results)
        }
      }
    }
  })
}
}


function TaskTeam(teamID) {
  var data = {};
  var TeamIds = [];
  TeamIds.push(teamID);
  var JobIds = [];
  JobIds.push(jobId);
  data.TeamIds = TeamIds;
  data.JobIds = JobIds;
  datastring = JSON.stringify(data);
  $.ajax({
    type: 'POST'
    , url: '/Api/v1/Tasking'
    , data: {TeamIds: TeamIds, JobIds: JobIds, LighthouseFunction: 'TaskTeam'}
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      console.log('textStatus = "%s"', textStatus, response);
      if (textStatus == 'success')
      {
        masterViewModel.teamsViewModel.loadTaskedTeams()
      }
    }
  })
}

function return_search_box() {
  return (
    <input type="text" style="width: 95%; margin:auto" id="filterquicksearch" maxlength="30" class="form-control input-sm" placeholder="Filter"></input>
    )
}

function return_li(id, callsign, teamleader, JobCount) {
  console.log(teamleader)
  if (teamleader != null)
  {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <small>{teamleader}<sup>TL</sup></small></a></li>
      )
  } else {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <i><small>No Members</small></i></a></li>
      )
  }
}

function return_lipres(title) {
  return(
    <li style="text-align:left" role="presentation" class="dropdown-header">{title}</li>
    )
}

function return_lidivider() {
  return(
    <li role="presentation" class="divider"></li>
    )
}

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

function return_untask_button() {
  return (<sup style="margin-left: 10px;margin-right: -5px; cursor: pointer;">X</sup>)
}



$(document).ready(function() {




  _.each([
    ["#stormtree", "Storm", "Tree Operations/Removal"],
    ["#stormproperty", "Storm", "Property Protection"],
    ["#stormsafety", "Storm", "Public Safety"],
    ["#stormaccess", "Storm", "Road/Access Clearance"],
    ["#stormrecon", "Storm", "Reconnaissance"],
    ["#rcrcalloff", "RoadCrashRescue", "Call Off"],
    ["#rcrcallextricate", "RoadCrashRescue", "Extrication "],
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

function return_quicktaskbutton() {
  return (
    <div id="lighthouse_instanttask" style="position:relative;display:inline-block;vertical-align:middle" class="dropdown">
    <button class="btn btn-sm btn-default dropdown-toggle" type="button" data-toggle="dropdown" id="lhtaskbutton"><img width="14px" style="vertical-align:top;margin-right:5px;float:left" src={lighthouseUrl+"icons/lh.png"}></img>Instant Task
    <span class="caret"></span></button>
    <ul class="dropdown-menu">
    </ul>
    </div>
    )
}

function checkAddressHistory(){
  var date_options = {
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
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Not Geocoded).<br/>' +
      ( masterViewModel.canEdit()
        ? '<a href="/Jobs/' + jobId + '/Edit' + '">Please edit the job and geocode the job location.</a>'
        : 'Have an authorised user edit the job and geocode the job location.' ) + '</em>'
      );
  }

  //addresses with only GPS
  if(address.Street == null && address.Locality == null) {
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Only GPS Lat/Long).<br/>' +
      'Please edit the job and geocode the job location.</em>'
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

  var start = moment();
  var now = new Date;
  var end = moment();
  end.subtract(1, 'y');

  $.ajax({
    type: 'GET'
    , url: '/Api/v1/Jobs/Search'
    , data: {
      'Q':                    q.substring(0, 30)
      , 'StartDate':          end.toISOString()
      , 'EndDate':            start.toISOString()
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
      console.log('textStatus = "%s"', textStatus, response);
      var $job_view_history_container = $('#job_view_history_container');
      switch(textStatus){
        case 'success':
        if(response.responseJSON.Results.length) {
          var history_rows = { 'exact':     { title :       'Same Address'
          , key :         'exact'
          , always_show : true
          , hide_old :    false
          , has_old :     false
          , jobs :        new Array() }
          , 'partial':   { title :       'Apartment, Townhouse or Battleaxe'
          , key :         'partial'
          , always_show : false
          , hide_old :    false
          , has_old :     false
          , jobs :        new Array() }
          , 'neighbour': { title :       'Immediate Neighbours'
          , key :         'neighbour'
          , always_show : false
          , hide_old :    false
          , has_old :     false
          , jobs :        new Array() }
          , 'street':    { title :       'Same Street'
          , key :         'street'
          , always_show : false
          , hide_old :    true
          , has_old :     false
          , jobs :        new Array() } };
          status_groups = {
            'active' :    ['new', 'acknowledged', 'active', 'tasked', 'referred']
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
              // Job Group
              var result_group = 'street';

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
              var jobGroups = new Array();
              $.each(status_groups, function(status_group, statuses) {
                if(statuses.indexOf(v.JobStatusType.Name.toLowerCase()) >= 0)
                  jobGroups.push(status_group);
              });
              if(jobGroups.length) v.cssClasses += ' job_view_history_item_statusgroup_' + jobGroups.join(' job_view_history_item_statusgroup_');
              if(v.isold) {
                v.cssClasses += ' job_view_history_item_old';
                if(jobGroups.indexOf('active') == -1) {
                  v.cssClasses += ' job_view_history_item_toggle';
                }
              }

              // Unless we have a Street Number for Current and Historic, we can only match the street
              if(v.Address.StreetNumber != null && address.StreetNumber != null) {

                if(v.Address.PrettyAddress == address.PrettyAddress) {
                  // Perfect Match
                  result_group = 'exact';
                } else if(v.Address.StreetNumber.replace(/\D+/g, '') == address.StreetNumber.replace(/\D+/g, '')){
                  // Not an exact address match, so include the address in the result row
                  result_group = 'partial';
                } else {
                  var rowAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
                    v.Address.StreetNumber);
                  var rowAddress_StreetNumber_Max = parseInt(
                    rowAddress_StreetNumber_tmp[2], 10);
                  var index = typeof rowAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
                  var rowAddress_StreetNumber_Min = parseInt(
                    rowAddress_StreetNumber_tmp[index], 10);
                  if (Math.abs(jobAddress_StreetNumber_Min - rowAddress_StreetNumber_Max) == 2 ||
                    Math.abs(jobAddress_StreetNumber_Max - rowAddress_StreetNumber_Min) == 2) {
                    result_group = 'neighbour';
                }
              }

            }
            
              // Push Job to Job Array
              history_rows[result_group].jobs.push(v);
              if(v.isold) history_rows[result_group].has_old = true;
            }); // Loop End - response.responseJSON.Results

            // Use JSX to Render
            $job_view_history_container.html(
              <div>
              {_.map(_.filter(history_rows, function(row) { return row.always_show || row.jobs.length; }), function(groupData, groupKey){
                return (
                  <fieldset id={"job_view_history_group_" + groupData.key } class={"job_view_history_group col-md-12" + (groupData.hide_old ? " job_view_history_showtoggle" : "")}>
                  <legend>
                  {groupData.title}
                  <span class="group_size">{groupData.jobs.length + ' Job' + (groupData.jobs.length == 1 ? '' : 's')}</span>
                  </legend>
                  <div class="form-group col-xs-12">
                  {(groupData.jobs.length == 0
                    ? <div class="job_view_history_none"><em>No Jobs Found</em></div>
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
            var $job_view_history_toggle_old = $( <div class="job_view_history_toggle_old"><span>Show</span> Older Jobs</div> )
            .click(function() {
              var $t = $(this);
              var $p = $t.closest('fieldset.job_view_history_group');
              var $old_rows = $('div.job_view_history_item_toggle', $p);
              var toshow = $old_rows.filter(':hidden').length > 0;
              $old_rows.toggle(toshow);
              $('span', $t).text(toshow ? 'Hide' : 'Show');
            });
            $('fieldset.job_view_history_showtoggle')
            .each(function(k ,v){
              var $v = $(v);
              if($('div.job_view_history_item_toggle', $v).length){
                $('div.form-group', $v).append($job_view_history_toggle_old);
              }
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
DoTour()

// wait for teams to have loaded
function whenTeamsAreReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel != "undefined" & masterViewModel.teamsViewModel.teamsLoaded.peek() == true) {
      console.log("teams are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

// wait for address to have loaded
function whenAddressIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel != "undefined" & masterViewModel.geocodedAddress != "undefined") {
      console.log("address is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

//checkbox for hide completed tasking

function renderSectorFilterCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseSectorFilterEnabled" class="fa fa-lg"></span> 
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Instant Filter by Sector
    </span>
    );
}

function renderCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseEnabled" class="fa fa-lg"></span> 
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Collapse Completed Tasking
    </span>
    );
}

function untaskTeamFromJob(TeamID, JobID, TaskingID) {
  $.ajax({
    type: 'DELETE'
    , url: '/Api/v1/Tasking/'+TaskingID
    , data: {
      'Id':       TaskingID
      ,'TeamId':    TeamID    
      , 'JobId':    JobID
      ,'LighthouseFunction': 'untaskTeamFromJob'       
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      console.log('textStatus = "%s"', textStatus, response);  
      if (textStatus == 'success')
      {
        masterViewModel.teamsViewModel.loadTaskedTeams()
      }

    }
  })
}



function DoTour() {
  require('bootstrap-tour')

  //this thing needs an id - its the page length box
  $('#content > div.widget.clearfix.job-reg-widget > div.widget-content > div > div.col-xs-4.text-right.job-reg-padding-fix > span').attr("id","pageination")



    // Instance the tour
    var tour = new Tour({
      name: "LHTourJobView",
      smartPlacement: true,
      placement: "right",
      debug: true,
      steps: [
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Lighthouse Welcome",
        content: "Lighthouse has made some changes to this page. would you like a tour?"
      },
      {
        element: "#job_view_history_groups",
        title: "Lighthouse Job History",
        placement: "top",
        backdrop: false,
        content: "Lighthouse will search for jobs with the same or similar address to this job. the results will be displayed here.",
      },
      {
        element: "#lhtaskbutton",
        placement: "left",
        orphan: true,
        backdrop: false,
        title: "Instant Task",
        content: "If the job is taskable there will be a grey button 'Instant Task' in the Actions box. This will allow you to task the job without leaving the job overview page."
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Untask",
        content: "If a team can be untasked from the job there will be a little x button next to them in the list of tasked teams."
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Quick Text and Tasks",
        onNext: function(tour) {
          $('#completeProviderModal').modal('hide');
        },
        content: "There are numerous Quick Text and Quick Task addons for team and job completion, as well as job finalisation. This saves having to click or type common tasks and actions. They appear on the completion popups"
      },
      {
        element: "#lighthouse_mapblock",
        title: "Lighthouse Map Tweak",
        placement: "top",
        backdrop: false,
        content: "To scroll the map you will need to click on it first. this stops the map 'stealing' the cursor when you scroll past",
      },
      {
        element: "",
        placement: "top",
        orphan: true,
        backdrop: true,
        title: "Questions?",
        content: "If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
    }
      ]
    })

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
}
