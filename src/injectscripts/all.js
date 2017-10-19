whenWeAreReady(user,function() {


  if (typeof urls.Base == "undefined") {
    urls.Base = "https://"+location.hostname
  }

  $.get( urls.Base+"/Api/v1/Entities/"+user.currentHqId, function( data ) {
    results = data;

    user.hq = results;

      //menu bar code
      var ul = document.getElementsByClassName("nav navbar-nav");

      var tonight = new Date();

      tonight.setHours(23, 59, 59, 0);

      tonight = new Date(tonight.getTime());

      var thismorning = new Date();

      thismorning.setHours(0, 0, 0, 0);

      thismorning = new Date(thismorning.getTime());


      var vars = "?host=" + urls.Base + "&source="+ location.origin +"&hq=" + user.currentHqId + "&start=" + encodeURIComponent(thismorning.toISOString()) + "&end=" + encodeURIComponent(tonight.toISOString()) + "&token=" + encodeURIComponent(user.accessToken)+ "&tokenexp="+encodeURIComponent(user.expiresAt);

      lighthouseMenu = MakeMenu(lighthouseUrl,vars,user.hq.Code)

      function MakeMenu(lighthouseUrl, vars, unitName) {

        if (lighthouseEnviroment == "Development") {
  //dev version
  return $.parseHTML('\
    <li class="dropdown" id="lhmenu">\
    <a href="#" class="dropdown-toggle" data-toggle="dropdown">\
    <span class="nav-text"><img width="16px" style="vertical-align: text-bottom;margin-right:5px" src="'+lighthouseUrl+'icons/lh.png"></img>Lighthouse</span>\
    </a>\
    <ul class="dropdown-menu">\
    <li role="presentation" class="dropdown-header">Jobs</li>\
    <li id="lhsummarymenuitem">\
    <a href="'+lighthouseUrl+'pages/summary.html'+vars+'" target="_blank">Job Summary ('+unitName+' Today)</a>\
    </li>\
    <li id="lhstatsmenuitem">\
    <a href="'+lighthouseUrl+'pages/stats.html'+vars+'" target="_blank">Job Statistics ('+unitName+' Today)</a>\
    </li>\
    <li id="lhexportmenuitem">\
    <a href="'+lighthouseUrl+'pages/advexport.html'+vars+'" target="_blank">Job Export ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">Teams\
    </li>\
    <li id="lhteammenuitem">\
    <a href="'+lighthouseUrl+'pages/teamsummary.html'+vars+'" target="_blank">Team Summary ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">About\
    </li>\
    <li id="lhtourmenuitem">\
    <a href="#" id="LHTourRestart">Restart All Tours</a>\
    </li>\
    <li id="lhstoragemenuitem">\
    <a href="#" id="LHClearStorage">Delete All Collections</a>\
    </li>\
    <li>\
    <a href="http://lighthouse.ses.nsw.gov.au">About Lighthouse</a>\
    </li>\
    </ul>\
    </li>\
    ')
} else if (lighthouseEnviroment == "Production") {
  //prod version
  return $.parseHTML('\
    <li class="dropdown" id="lhmenu">\
    <a href="#" class="dropdown-toggle" data-toggle="dropdown">\
    <span class="nav-text"><img width="16px" style="vertical-align: text-bottom;margin-right:5px" src="'+lighthouseUrl+'icons/lh.png"></img>Lighthouse</span>\
    </a>\
    <ul class="dropdown-menu">\
    <li role="presentation" class="dropdown-header">Jobs</li>\
    <li id="lhsummarymenuitem">\
    <a href="'+lighthouseUrl+'pages/summary.html'+vars+'" target="_blank">Job Summary ('+unitName+' Today)</a>\
    </li>\
    <li id="lhstatsmenuitem">\
    <a href="'+lighthouseUrl+'pages/stats.html'+vars+'" target="_blank">Job Statistics ('+unitName+' Today)</a>\
    </li>\
    <li id="lhexportmenuitem">\
    <a href="'+lighthouseUrl+'pages/advexport.html'+vars+'" target="_blank">Job Export ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">Teams\
    </li>\
    <li id="lhteammenuitem">\
    <a href="'+lighthouseUrl+'pages/teamsummary.html'+vars+'" target="_blank">Team Summary ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">About\
    </li>\
    <li id="lhtourmenuitem">\
    <a href="#" id="LHTourRestart">Restart All Tours</a>\
    </li>\
    <li id="lhstoragemenuitem">\
    <a href="#" id="LHClearStorage">Delete All Collections</a>\
    </li>\
    <li>\
    <a href="https://github.com/NSWSESMembers/Lighthouse/blob/master/README.md">About Lighthouse</a>\
    </li>\
    </ul>\
    </li>\
    ')
}


}

$('ul.nav.navbar-nav.navbar-left').append(lighthouseMenu);

$("#LHTourRestart").click(function() {
 Object.keys(localStorage)
 .forEach(function(key){
   if (/^LHTour/.test(key)) {
     console.log("Removing localstorage key..."+key);
     localStorage.removeItem(key);
   }
 });
 location.reload();    
});

$("#LHClearStorage").click(function() {
  window.postMessage({ type: 'PURGE_COLLECTION', name: 'lighthouseMessageCollections'}, '*');
  window.postMessage({ type: 'PURGE_COLLECTION', name: 'lighthouseTeamFilterCollections'}, '*');
  window.postMessage({ type: 'PURGE_COLLECTION', name: 'lighthouseJobFilterCollections'}, '*');
  location.reload();
});

if (location.pathname == "/") {
  DoTour()
}

  //lighthouse menu for teams
  if (location.pathname == "/Teams") {

    if (user.hq.EntityTypeId != 1) {     //make region level more obvious
      regionfilter = user.hq.Code+" Units";
    } else {
      regionfilter = user.hq.ParentEntity.Code;
    }


    var filtermenu = `\
    <li class="" id="lhquickfilter">\
    <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="${lighthouseUrl}icons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span><i class="toggle-icon fa fa-angle-left"></i></a>\
    <ul class="sub-menu" style="display: none;">\
    <li class="active">\
    <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-home" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 5px">Locations</a><span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">${user.hq.Code}</span></span><span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">${regionfilter}</span></span><span class="label tag tag-lighthouse" id="clearlocator"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="${lighthouseUrl}icons/lh-black.png">All</span></span></span>\
    <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-clock-o" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 5px">Times</a><span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span><span class="label tag tag-task tag-disabled" id="filter7days"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30days"><span class="tag-text">30 Days</span></span></span>\
    <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-object-group" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 7px">Filter Collections</a><div id="lhfiltercollections" style="display: inline-block;"></div><div><button type="button" class="btn btn-primary btn-xs" id="lhfiltercollectionsave"></i>Save Current</button></div></span>\
    <li>\
    </ul>\
    </li>`;


    $('.main-menu > li:nth-child(1)').after(filtermenu);


    $("#filterallmyregion").click(function() {
      filterViewModel.selectedEntities.removeAll();
      filtershowallmyregion();
    });

    $("#filtermyhq").click(function() {
      filterViewModel.selectedEntities.removeAll();
      filterViewModel.selectedEntities.push(user.hq);
      filterViewModel.updateFilters();
    });

    $("#clearlocator").click(function() {
      filterViewModel.selectedEntities.removeAll();
      filterViewModel.updateFilters();
    });

    $("#filtertoday").click(function() {
      filterViewModel.startDate(utility.dateRanges.Today.StartDate())
      filterViewModel.endDate(utility.dateRanges.Today.EndDate())
      filterViewModel.dateRangeType('Today')
      $("#reportrange span").html(utility.dateRanges.Today.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Today.StartDate().format("MMMM D, YYYY H:mm"));
      $('div.daterangepicker.dropdown-menu.opensleft > div.ranges > ul > li').each(function(j){
        if ($(this).text() == "Today")
        {
          $(this).addClass('active')
        } else {
          $(this).removeClass('active')
        }
      })
      filterViewModel.updateFilters();
    });

    $("#filter7days").click(function() {
      filterViewModel.startDate(utility.dateRanges.Last7Days.StartDate())
      filterViewModel.endDate(utility.dateRanges.Last7Days.EndDate())
      filterViewModel.dateRangeType('Last 7 Days')
      $("#reportrange span").html(utility.dateRanges.Last7Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last7Days.StartDate().format("MMMM D, YYYY H:mm"));
      $('div.daterangepicker.dropdown-menu.opensleft > div.ranges > ul > li').each(function(j){
        if ($(this).text() == "Last 7 Days")
        {
          $(this).addClass('active')
        } else {
          $(this).removeClass('active')
        }
      })
      filterViewModel.updateFilters();
    });

    $("#filter30days").click(function() {
     filterViewModel.startDate(utility.dateRanges.Last30Days.StartDate())
     filterViewModel.endDate(utility.dateRanges.Last30Days.EndDate())
     filterViewModel.dateRangeType('Last 30 Days')
     $("#reportrange span").html(utility.dateRanges.Last30Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last30Days.StartDate().format("MMMM D, YYYY H:mm"));
     $('div.daterangepicker.dropdown-menu.opensleft > div.ranges > ul > li').each(function(j){
      if ($(this).text() == "Last 30 Days")
      {
        $(this).addClass('active')
      } else {
        $(this).removeClass('active')
      }
    })
     filterViewModel.updateFilters();
   });

    $("#lhfiltercollectionsave").click(function() {

      saveObject = {}

  saveObject.selectedTeamTypes = filterViewModel.selectedTeamTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
  saveObject.selectedTeamStatusTypes = filterViewModel.selectedTeamStatusTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
  saveObject.selectedCapabilities = filterViewModel.selectedCapabilities.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
  saveObject.dateRangeType = filterViewModel.dateRangeType.peek()
  saveObject.startDate = filterViewModel.startDate.peek()
  saveObject.endDate = filterViewModel.endDate.peek()

  saveObject.selectedEntities = filterViewModel.selectedEntities.peek().map(function(x) {return {Id:x.Id,Name:x.Name,EntityTypeId:x.EntityTypeId}}) //lets make it shorter

  var SaveName = prompt("Please enter a name for the collection. If the name already exists it will be overwritten.", "");
  if (SaveName !== null && SaveName != "") {

    CollectionParent = {}
    CollectionParent.name = SaveName;
    CollectionParent.description = SaveName;
    CollectionParent.items = saveObject;

    window.postMessage({ type: 'SAVE_COLLECTION', newdata:JSON.stringify(CollectionParent),name: 'lighthouseTeamFilterCollections'}, '*');

  }

})

LoadTeamFilterCollections()

}

//lighthouse menu for jobs

if (location.pathname === "/Jobs" || location.pathname === "/Jobs/SituationalAwareness") {

  if (location.pathname === "/Jobs/SituationalAwareness") {
    filterViewModel = window.contentViewModel.filterViewModel;
  }

//with dates var filtermenu = '<li class=""> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Time Range</a> <span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span> <span class="label tag tag-task tag-disabled" id="filter3day"><span class="tag-text">3 Days</span></span> <span class="label tag tag-task tag-disabled" id="filter7day"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30day"><span class="tag-text">30 Days</span></span> </span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Open</span></span> <span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span> <span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Type</a> <span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span> <span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span> <span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span> <span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">NSW</span></span> <br> </span> </ul> </li>';


if (user.hq.EntityTypeId != 1) {
            //make region level more obvious
            regionfilter = user.hq.Code+" Units";
          } else {
            regionfilter = user.hq.ParentEntity.Code;
          }

          var filtermenu = `\
          <li class="" id="lhquickfilter">\
          <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="${lighthouseUrl}icons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span><i class="toggle-icon fa fa-angle-left"></i></a>\
          <ul class="sub-menu" style="display: none;">\
          <li class="active">\
          <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-flag" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em;margin-left: 5px">Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Outstanding</span></span><span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span><span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="${lighthouseUrl}icons/lh-black.png">All</span></span></span>\
          <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-file-text-o" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em;margin-left: 5px">Job Type</a><span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span><span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span><span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span><span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="${lighthouseUrl}icons/lh-black.png">All</span></span></span>\
          <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-home" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 5px">Locations</a><span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">${user.hq.Code}</span></span><span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">${regionfilter}</span></span><span class="label tag tag-lighthouse" id="clearlocator"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="${lighthouseUrl}icons/lh-black.png">All</span></span></span>\
          <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-clock-o" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 5px">Times</a><span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span><span class="label tag tag-task tag-disabled" id="filter7days"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30days"><span class="tag-text">30 Days</span></span></span>\
          <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-object-group" style="float: left;margin-top: 12px;"></i><a style="font-size: .9em; margin-left: 7px">Filter Collections</a><div id="lhfiltercollections" style="display: inline-block;"></div><div><button type="button" class="btn btn-primary btn-xs" id="lhfiltercollectionsave"></i>Save Current</button></div></span>\
          </li>
          </ul>
          </li>`;

          if (location.pathname === "/Jobs") {
            $('.main-menu > li:nth-child(1)').after(filtermenu);
          } else if (location.pathname === "/Jobs/SituationalAwareness") {
            $('#currentSituationFilter > li:nth-child(1)').after(filtermenu);
          }

          $("#filterrescue").click(function() {
            filterViewModel.selectedParentJobTypes.removeAll();
            filterViewModel.selectedFloodAssTypes.removeAll();
            filterViewModel.parentJobTypeClicked({
              Id: 5,
              Name: "Rescue",
              Description: "Rescue",
              ParentId: null
            });
            filterViewModel.updateFilters();
          });

          $("#filterstorm").click(function() {
            filterViewModel.selectedParentJobTypes.removeAll();
            filterViewModel.selectedRescueTypes.removeAll();
            filterViewModel.selectedFloodAssTypes.removeAll();
            filterViewModel.parentJobTypeClicked({
              Id: 1,
              Name: "Storm",
              Description: "Storm",
              ParentId: null
            });
            filterViewModel.updateFilters();
          });
          $("#filterflood").click(function() {
            filterViewModel.selectedParentJobTypes.removeAll();
            filterViewModel.selectedRescueTypes.removeAll();
            filterViewModel.parentJobTypeClicked({
              Id: 4,
              Name: "Flood Assistance",
              Description: "FloodAssistance",
              ParentId: null
            });
            filterViewModel.rescueTypeClicked({
              Id: 4,
              Name: "FR",
              Description: "Flood Rescue",
              ParentId: 5
            });
            filterViewModel.updateFilters();
          });
          $("#filteralltype").click(function() {
            filterViewModel.selectedParentJobTypes.removeAll();
            filterViewModel.selectedRescueTypes.removeAll();
            filterViewModel.selectedFloodAssTypes.removeAll();
            filterViewModel.updateFilters();
          });

          $("#filteropen").click(function() {
            filterViewModel.selectedStatusTypes.removeAll();
            filterViewModel.selectedStatusTypes.push({
              Id: 2,
              Name: "Acknowledged",
              Description: "Acknowledged",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 1,
              Name: "New",
              Description: "New",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 4,
              Name: "Tasked",
              Description: "Tasked",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 5,
              Name: "Referred",
              Description: "Referred",
              ParentId: null
            });
            filterViewModel.updateFilters();
          });

          $("#filterclosed").click(function() {
            filterViewModel.selectedStatusTypes.removeAll();
            filterViewModel.selectedStatusTypes.push({
              Id: 6,
              Name: "Complete",
              Description: "Complete",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 7,
              Name: "Cancelled",
              Description: "Cancelled",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 3,
              Name: "Rejected",
              Description: "Rejected",
              ParentId: null
            });
            filterViewModel.selectedStatusTypes.push({
              Id: 8,
              Name: "Finalised",
              Description: "Finalised",
              ParentId: null
            });
            filterViewModel.updateFilters();
          });

          $("#filterallstatus").click(function() {
            filterViewModel.selectedStatusTypes.removeAll();
            filterViewModel.updateFilters();
          });

          $("#filterallmyregion").click(function() {
            filterViewModel.selectedEntities.removeAll();
            filtershowallmyregion();
          });

          $("#filtermyhq").click(function() {
            filterViewModel.selectedEntities.removeAll();
            filterViewModel.selectedEntities.push(user.hq);
            filterViewModel.updateFilters();
          });

          $("#clearlocator").click(function() {
            filterViewModel.selectedEntities.removeAll();
            filterViewModel.updateFilters();
          });

          $("#filtertoday").click(function() {
            filterViewModel.startDate(utility.dateRanges.Today.StartDate())
            filterViewModel.endDate(utility.dateRanges.Today.EndDate())
            filterViewModel.dateRangeType('Today')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Today.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Today.EndDate()
            $("#reportrange span").html(utility.dateRanges.Today.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Today.EndDate().format("MMMM D, YYYY H:mm"));
            filterViewModel.updateFilters();
          });

          $("#filter7days").click(function() {
            filterViewModel.startDate(utility.dateRanges.Last7Days.StartDate())
            filterViewModel.endDate(utility.dateRanges.Last7Days.EndDate())
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last7Days.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last7Days.EndDate()
            filterViewModel.dateRangeType('Last 7 Days')
            $("#reportrange span").html(utility.dateRanges.Last7Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last7Days.EndDate().format("MMMM D, YYYY H:mm"));
            filterViewModel.updateFilters();
          });

          $("#filter30days").click(function() {
           filterViewModel.startDate(utility.dateRanges.Last30Days.StartDate())
           filterViewModel.endDate(utility.dateRanges.Last30Days.EndDate())
           $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last30Days.StartDate()
           $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last30Days.EndDate()
           filterViewModel.dateRangeType('Last 30 Days')
           $("#reportrange span").html(utility.dateRanges.Last30Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last30Days.EndDate().format("MMMM D, YYYY H:mm"));
           filterViewModel.updateFilters();
         });


          $("#lhfiltercollectionsave").click(function() {

            saveObject = {}

            saveObject.selectedTags = filterViewModel.selectedTags.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
            saveObject.selectedRescueTypes = filterViewModel.selectedRescueTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
            saveObject.selectedFloodAssTypes = filterViewModel.selectedFloodAssTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
            saveObject.selectedPriorityTypes = filterViewModel.selectedPriorityTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
            saveObject.selectedStatusTypes = filterViewModel.selectedStatusTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID
            saveObject.selectedParentJobTypes = filterViewModel.selectedParentJobTypes.peek().map(function(x) {return {Id:x.Id}}) //lets make it shorter by only keeping the ID

            saveObject.dateRangeType = filterViewModel.dateRangeType.peek()
            saveObject.startDate = filterViewModel.startDate.peek()
            saveObject.endDate = filterViewModel.endDate.peek()

            saveObject.selectedEvents = filterViewModel.selectedEvents.peek()

            saveObject.icemsIInIds = filterViewModel.icemsIInIds.peek().map(function(x) {return x.ReferringAgencyReference}) //scrub out the private details and just return the ID, we will fetch job details on load.

            saveObject.selectedTeams = filterViewModel.selectedTeams.peek() //already really short

            saveObject.selectedEntities = filterViewModel.selectedEntities.peek().map(function(x) {return {Id:x.Id,Name:x.Name,EntityTypeId:x.EntityTypeId}}) //lets make it shorter
            saveObject.selectedPeople = filterViewModel.selectedPeople.peek().map(function(x) {return {Id:x.Id,FullName:x.FullName}}) //lets make it shorter

            var SaveName = prompt("Please enter a name for the collection. If the name already exists it will be overwritten.", "");
            if (SaveName !== null && SaveName != "") {
              CollectionParent = {}
              CollectionParent.name = SaveName;
              CollectionParent.description = SaveName;
              CollectionParent.items = saveObject;
              console.log(CollectionParent)
              window.postMessage({ type: 'SAVE_COLLECTION', newdata:JSON.stringify(CollectionParent), name: 'lighthouseJobFilterCollections'}, '*');
            }

          })

LoadJobFilterCollections()


      } // location.pathname == "/Jobs"


  }) // xhttp.onreadystatechange


});

function LoadTeamFilterCollections() {

  window.addEventListener("message", function(event) {
    // We only accept messages from content scrip
    if (event.source !== window)
      return;
    if (event.data.type) {
      if (event.data.type === "RETURN_COLLECTION" && event.data.name == "lighthouseTeamFilterCollections") {
        try {
          var items = JSON.parse(event.data.dataresult)
        } catch (e)
        {
          var items = []
        }
        ProcessData(items)
      }
    }
  })
  window.postMessage({ type: 'FETCH_COLLECTION',name: 'lighthouseTeamFilterCollections' }, '*');

  function ProcessData(theLoadedCollection) { //Load the saved Collections


    $("#lhfiltercollections").empty();

//Load the saved Collections
if (theLoadedCollection) {

  theLoadedCollection.forEach(function(item) {
    console.log()
    var button = make_collection_button(item.name, item.items.length + "")

    $(button).click(function() {
      filterViewModel.selectedTeamTypes.removeAll()
      item.items.selectedTeamTypes.forEach(function(itm) {
        filterViewModel.selectedTeamTypes.push(itm)
      })
      filterViewModel.selectedTeamStatusTypes.removeAll()
      item.items.selectedTeamStatusTypes.forEach(function(itm) {
        filterViewModel.selectedTeamStatusTypes.push(itm)
      })
      filterViewModel.selectedCapabilities.removeAll()
      item.items.selectedCapabilities.forEach(function(itm) {
        filterViewModel.selectedCapabilities.push(itm)
      })

      switch (item.items.dateRangeType)
      {
        case "Today":
        filterViewModel.startDate(utility.dateRanges.Today.StartDate())
        filterViewModel.endDate(utility.dateRanges.Today.EndDate())
        filterViewModel.dateRangeType('Today')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Today.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Today.EndDate()
        $("#reportrange span").html(utility.dateRanges.Today.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Today.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "Yesterday":
        filterViewModel.startDate(utility.dateRanges.Yesterday.StartDate())
        filterViewModel.endDate(utility.dateRanges.Yesterday.EndDate())
        filterViewModel.dateRangeType('Yesterday')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Yesterday.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Yesterday.EndDate()
        $("#reportrange span").html(utility.dateRanges.Yesterday.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Yesterday.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "Last 7 Days":
        filterViewModel.startDate(utility.dateRanges.Last7Days.StartDate())
        filterViewModel.endDate(utility.dateRanges.Last7Days.EndDate())
        filterViewModel.dateRangeType('Last 7 Days')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last7Days.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last7Days.EndDate()
        $("#reportrange span").html(utility.dateRanges.Last7Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last7Days.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "Last 30 Days":
        filterViewModel.startDate(utility.dateRanges.Last30Days.StartDate())
        filterViewModel.endDate(utility.dateRanges.Last30Days.EndDate())
        filterViewModel.dateRangeType('Last 30 Days')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last30Days.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last30Days.EndDate()
        $("#reportrange span").html(utility.dateRanges.Last30Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last30Days.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "This Month":
        filterViewModel.startDate(utility.dateRanges.ThisMonth.StartDate())
        filterViewModel.endDate(utility.dateRanges.ThisMonth.EndDate())
        filterViewModel.dateRangeType('This Month')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.ThisMonth.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.ThisMonth.EndDate()
        $("#reportrange span").html(utility.dateRanges.ThisMonth.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.ThisMonth.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "Last Month":
        filterViewModel.startDate(utility.dateRanges.LastMonth.StartDate())
        filterViewModel.endDate(utility.dateRanges.LastMonth.EndDate())
        filterViewModel.dateRangeType('Last Month')
        $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.LastMonth.StartDate()
        $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.LastMonth.EndDate()
        $("#reportrange span").html(utility.dateRanges.LastMonth.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.LastMonth.EndDate().format("MMMM D, YYYY H:mm"));
        break
        case "This Calendar Year":
        filterViewModel.startDate(moment().startOf('year'))
        filterViewModel.endDate(moment().endOf('year'))
        filterViewModel.dateRangeType('This Calendar Year')
        $("#reportrange").data().daterangepicker.startDate = moment().startOf('year')
        $("#reportrange").data().daterangepicker.endDate = moment().endOf('year')
        $("#reportrange span").html(moment().startOf('year').format("MMMM D, YYYY H:mm") + " - " + moment().endOf('year').format("MMMM D, YYYY H:mm"));
        break
        case "All":
        filterViewModel.startDate(utility.minDate)
        filterViewModel.endDate(moment().endOf('year'))
        filterViewModel.dateRangeType('All')
        $("#reportrange").data().daterangepicker.startDate = utility.minDate
        $("#reportrange").data().daterangepicker.endDate = moment().endOf('year')
        $("#reportrange span").html(utility.minDate.format("MMMM D, YYYY H:mm") + " - " + moment().endOf('year').format("MMMM D, YYYY H:mm"));
        break
        case "Custom Range":
        var start = moment(item.items.startDate)
        var end = moment(item.items.endDate)
        filterViewModel.startDate(start)
        filterViewModel.endDate(end)
        filterViewModel.dateRangeType('Custom Range')
        $("#reportrange").data().daterangepicker.startDate = start
        $("#reportrange").data().daterangepicker.endDate = end
        $("#reportrange span").html(start.format("MMMM D, YYYY H:mm") + " - " + end.format("MMMM D, YYYY H:mm"));
        break
      }

      filterViewModel.selectedEntities.removeAll()
      item.items.selectedEntities.forEach(function(itm) {
        filterViewModel.selectedEntities.push(itm)
      })

      filterViewModel.updateFilters();


    })

$(button).find('span.delbutton').click(function() {
  event.stopImmediatePropagation();
  var r = confirm("Are you sure you want to delete this collection?");
  if (r == true) {
    DeleteTeamCollection(item);
  }
})

$('#lhfiltercollections').append(button)

})

}
}

}



function LoadJobFilterCollections() {

  window.addEventListener("message", function(event) {
    // We only accept messages from content scrip
    if (event.source !== window)
      return;
    if (event.data.type) {
      if (event.data.type === "RETURN_COLLECTION" && event.data.name == "lighthouseJobFilterCollections") {
        try {
          var items = JSON.parse(event.data.dataresult)
        } catch (e)
        {
          var items = []
        }
        ProcessData(items)
      }
    }
  })

  window.postMessage({ type: 'FETCH_COLLECTION', name: 'lighthouseJobFilterCollections'}, '*');


  function ProcessData(theLoadedCollection) { //Load the saved Collections
    $("#lhfiltercollections").empty();
    
    if (theLoadedCollection) {
      theLoadedCollection.forEach(function(item) {
        var button = make_collection_button(item.name, item.items.length + "")

        $(button).click(function() {
          filterViewModel.selectedTags.removeAll()
          item.items.selectedTags.forEach(function(itm) {
            filterViewModel.selectedTags.push(itm)
          })
          filterViewModel.selectedRescueTypes.removeAll()
          item.items.selectedRescueTypes.forEach(function(itm) {
            filterViewModel.selectedRescueTypes.push(itm)
          })
          filterViewModel.selectedFloodAssTypes.removeAll()
          item.items.selectedFloodAssTypes.forEach(function(itm) {
            filterViewModel.selectedFloodAssTypes.push(itm)
          })
          filterViewModel.selectedPriorityTypes.removeAll()
          item.items.selectedPriorityTypes.forEach(function(itm) {
            filterViewModel.selectedPriorityTypes.push(itm)
          })
          filterViewModel.selectedStatusTypes.removeAll()
          item.items.selectedStatusTypes.forEach(function(itm) {
            filterViewModel.selectedStatusTypes.push(itm)
          })
          filterViewModel.selectedParentJobTypes.removeAll()
          item.items.selectedParentJobTypes.forEach(function(itm) {
            filterViewModel.selectedParentJobTypes.push(itm)
          })

          switch (item.items.dateRangeType)
          {
            case "Today":
            filterViewModel.startDate(utility.dateRanges.Today.StartDate())
            filterViewModel.endDate(utility.dateRanges.Today.EndDate())
            filterViewModel.dateRangeType('Today')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Today.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Today.EndDate()
            $("#reportrange span").html(utility.dateRanges.Today.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Today.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "Yesterday":
            filterViewModel.startDate(utility.dateRanges.Yesterday.StartDate())
            filterViewModel.endDate(utility.dateRanges.Yesterday.EndDate())
            filterViewModel.dateRangeType('Yesterday')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Yesterday.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Yesterday.EndDate()
            $("#reportrange span").html(utility.dateRanges.Yesterday.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Yesterday.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "Last 7 Days":
            filterViewModel.startDate(utility.dateRanges.Last7Days.StartDate())
            filterViewModel.endDate(utility.dateRanges.Last7Days.EndDate())
            filterViewModel.dateRangeType('Last 7 Days')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last7Days.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last7Days.EndDate()
            $("#reportrange span").html(utility.dateRanges.Last7Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last7Days.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "Last 30 Days":
            filterViewModel.startDate(utility.dateRanges.Last30Days.StartDate())
            filterViewModel.endDate(utility.dateRanges.Last30Days.EndDate())
            filterViewModel.dateRangeType('Last 30 Days')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.Last30Days.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.Last30Days.EndDate()
            $("#reportrange span").html(utility.dateRanges.Last30Days.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.Last30Days.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "This Month":
            filterViewModel.startDate(utility.dateRanges.ThisMonth.StartDate())
            filterViewModel.endDate(utility.dateRanges.ThisMonth.EndDate())
            filterViewModel.dateRangeType('This Month')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.ThisMonth.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.ThisMonth.EndDate()
            $("#reportrange span").html(utility.dateRanges.ThisMonth.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.ThisMonth.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "Last Month":
            filterViewModel.startDate(utility.dateRanges.LastMonth.StartDate())
            filterViewModel.endDate(utility.dateRanges.LastMonth.EndDate())
            filterViewModel.dateRangeType('Last Month')
            $("#reportrange").data().daterangepicker.startDate = utility.dateRanges.LastMonth.StartDate()
            $("#reportrange").data().daterangepicker.endDate = utility.dateRanges.LastMonth.EndDate()
            $("#reportrange span").html(utility.dateRanges.LastMonth.StartDate().format("MMMM D, YYYY H:mm") + " - " + utility.dateRanges.LastMonth.EndDate().format("MMMM D, YYYY H:mm"));
            break
            case "This Calendar Year":
            filterViewModel.startDate(moment().startOf('year'))
            filterViewModel.endDate(moment().endOf('year'))
            filterViewModel.dateRangeType('This Calendar Year')
            $("#reportrange").data().daterangepicker.startDate = moment().startOf('year')
            $("#reportrange").data().daterangepicker.endDate = moment().endOf('year')
            $("#reportrange span").html(moment().startOf('year').format("MMMM D, YYYY H:mm") + " - " + moment().endOf('year').format("MMMM D, YYYY H:mm"));
            break
            case "All":
            filterViewModel.startDate(utility.minDate)
            filterViewModel.endDate(moment().endOf('year'))
            filterViewModel.dateRangeType('All')
            $("#reportrange").data().daterangepicker.startDate = utility.minDate
            $("#reportrange").data().daterangepicker.endDate = moment().endOf('year')
            $("#reportrange span").html(utility.minDate.format("MMMM D, YYYY H:mm") + " - " + moment().endOf('year').format("MMMM D, YYYY H:mm"));
            break
            case "Custom Range":
            var start = moment(item.items.startDate)
            var end = moment(item.items.endDate)
            filterViewModel.startDate(start)
            filterViewModel.endDate(end)
            filterViewModel.dateRangeType('Custom Range')
            $("#reportrange").data().daterangepicker.startDate = start
            $("#reportrange").data().daterangepicker.endDate = end
            $("#reportrange span").html(start.format("MMMM D, YYYY H:mm") + " - " + end.format("MMMM D, YYYY H:mm"));
            break
          }

          filterViewModel.selectedEvents.removeAll()
          item.items.selectedEvents.forEach(function(itm) {
            filterViewModel.selectedEvents.push(itm)
          })

      //Fetch ICEMS jobs by Refering ID
      filterViewModel.icemsIInIds.removeAll()
      item.items.icemsIInIds.forEach(function(itm) {
        $.ajax({
          type: 'GET',
          url: urls.Base+'/Api/v1/Jobs/Search?ICEMSIncidentIdentifier=' + itm + '&PageSize=1',
          beforeSend: function(n) {
            n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
          },
          data: {
            LighthouseFunction: 'LighthouseLoadICEMSFromCollection'
          },
          cache: false,
          dataType: 'json',
          complete: function(response, textStatus) {
            if (textStatus == 'success') {
              if (response.responseJSON.Results.length)
              {
                filterViewModel.icemsIInIds.push(response.responseJSON.Results[0])
              }
            }
          }
        })
      })

      filterViewModel.selectedTeams.removeAll()
      item.items.selectedTeams.forEach(function(itm) {
        filterViewModel.selectedTeams.push(itm)
      })

      filterViewModel.selectedEntities.removeAll()
      item.items.selectedEntities.forEach(function(itm) {
        filterViewModel.selectedEntities.push(itm)
      })

      filterViewModel.selectedPeople.removeAll()
      item.items.selectedPeople.forEach(function(itm) {
        filterViewModel.selectedPeople.push(itm)
      })

      filterViewModel.updateFilters();


    })

$(button).find('span.delbutton').click(function() {
  event.stopImmediatePropagation();
  var r = confirm("Are you sure you want to delete this collection?");
  if (r == true) {
    DeleteJobCollection(item);
  }
})

$('#lhfiltercollections').append(button)

})

}
}

}

function DeleteTeamCollection(col) {
  window.postMessage({ type: 'DELETE_COLLECTION', target:JSON.stringify(col), name:'lighthouseTeamFilterCollections'}, '*');
}

function DeleteJobCollection(col) {
  window.postMessage({ type: 'DELETE_COLLECTION', target:JSON.stringify(col), name:'lighthouseJobFilterCollections'}, '*');
}

function make_collection_button(name, count) {
  return $.parseHTML(`
    <span class="label tag tag-rebecca tag-disabled">\
    <span><p  style="margin-bottom:0px"><i class="fa fa-object-group" aria-hidden="true" style="margin-right: 5px;"></i>`+name+`<span class="delbutton"><sup style="margin-left: 10px;margin-right: -5px;">X</sup></span></p></span>\
    </span>\
    `)
}

function filtershowallmyregion() {
  filterViewModel.selectedEntities.destroyAll() //flush first :-)
$.get( urls.Base+"/Api/v1/Entities/"+user.currentRegionId+"/Children", function( data ) {
  results = data;
  results.forEach(function(d) {
    filterViewModel.selectedEntities.push(d);
  });
  filterViewModel.updateFilters();
})
}


function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof varToCheck != "undefined") {
      console.log("We are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}


$(function(){

  // Adds CSS Classes to BODY
  $('body')
    // Start of the Hostname "beacon", "trainbeacon", "previewbeacon"
    .addClass(location.hostname.substring(0,location.hostname.indexOf('.')))
    // If Christmas
    .toggleClass('xmas', new Date().getMonth()==11);

  // Adds CSS Class to BODY

  // Shortcuts search box - if Job Number entered, jump straight to that job
  $('form#layoutJobSearchForm')
  .on('submit',function(e){
    var $t = $(this) ,
    $q = $('#layoutJobSearchFormJobQuery',$t) ,
    val = $q.val();
      if ( /^\d{0,4}\-?\d{4}$/.test( val ) ) { // if the field contains 4 or more digits and nothing else
        document.location = '/Jobs/' + parseInt( val.replace(/\D/g,'') , 10 );
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    });

});


function DoTour() {
  require('bootstrap-tour')


    // Instance the tour
    var tour = new Tour({
      name: "LHTourAll",
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
        element: "#lhmenu",
        title: "Lighthouse Menu",
        placement: "bottom",
        backdrop: false,
        onNext: function (tour) {
          $('#lhmenu > ul').show();
        },
        content: "The Lighthouse menu gives quick access to several lighthouse features.",
      },
      {
        element: "#lhsummarymenuitem",
        title: "Lighthouse Menu - Summary",
        placement: "left",
        backdrop: true,
        onShown: function (tour) {
          $('.popover').css("z-index", "9999999");
        },
        content: "Lighthouse Summary provides a simple to read screen that gives a summary of all jobs. It will default to jobs at your HQ and a 24 hour filter.",
      },
      {
        element: "#lhstatsmenuitem",
        title: "Lighthouse Menu - Statistics",
        placement: "right",
        backdrop: true,
        onShown: function (tour) {
          $('.popover').css("z-index", "9999999");
        },
        content: "Lighthouse Statistics provides a simple statistics (pie charts and bar graphs) breakdown for all jobs. It will default to jobs at your HQ and a 24 hour filter.",
      },
      {
        element: "#lhexportmenuitem",
        title: "Lighthouse Menu - Job Export",
        placement: "left",
        backdrop: true,
        content: "Lighthouse Advanced Export allows you to export jobs and includes almost all the available data for the job - 31 data fields in total.",
      },
      {
        element: "#lhteammenuitem",
        title: "Lighthouse Menu - Team Summary",
        placement: "right",
        backdrop: true,
        content: "Lighthouse Summary provides a simple to read screen that gives a summary of all job. It will default to teams at your HQ.",
      },
      {
        element: "#lhmapmenuitem",
        title: "Lighthouse Menu - Live Map",
        placement: "left",
        backdrop: true,
        content: "Lighthouse Live Map provides a live and interactive map that can plot jobs, teams, ipads, and people.",
      },
      {
        element: "#lhtourmenuitem",
        title: "Lighthouse Menu - Restart Tour",
        placement: "right",
        backdrop: true,
        content: "If you would like to replay the tour at any time, click here.",
      },
      {
        element: "#layoutJobSearchFormJobQuery",
        title: "Job Search",
        placement: "left",
        backdrop: false,
        onShown: function (tour) {
          $('#lhmenu ul').toggle();
          $('.popover').css("z-index", "9999999");
        },
        content: "If you search for a job number that is found you will be taken straight to that job",
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
