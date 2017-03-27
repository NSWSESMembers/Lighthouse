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


      var vars = "?host=" + urls.Base + "&hq=" + user.currentHqId + "&start=" + encodeURIComponent(thismorning.toISOString()) + "&end=" + encodeURIComponent(tonight.toISOString()) + "&token=" + encodeURIComponent(user.accessToken);

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
    <a href="'+lighthouseUrl+'pages/summary.html'+vars+'">Job Summary ('+unitName+' Today)</a>\
    </li>\
    <li id="lhstatsmenuitem">\
    <a href="'+lighthouseUrl+'pages/stats.html'+vars+'">Job Statistics ('+unitName+' Today)</a>\
    </li>\
    <li id="lhexportmenuitem">\
    <a href="'+lighthouseUrl+'pages/advexport.html'+vars+'">Job Export ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">Teams\
    </li>\
    <li id="lhteammenuitem">\
    <a href="'+lighthouseUrl+'pages/teamsummary.html'+vars+'">Team Summary ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">Maps\
    </li>\
    <li id="lhmapmenuitem">\
    <a href="'+lighthouseUrl+'pages/map.html'+vars+'">Live Map ('+unitName+')</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">About\
    </li>\
    <li id="lhtourmenuitem">\
    <a href="#" id="LHTourRestart">Restart All Tours</a>\
    </li>\
    <li>\
    <a href="https://github.com/NSWSESMembers/Lighthouse/blob/master/README.md">About Lighthouse</a>\
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
    <a href="'+lighthouseUrl+'pages/summary.html'+vars+'">Job Summary ('+unitName+' Today)</a>\
    </li>\
    <li id="lhstatsmenuitem">\
    <a href="'+lighthouseUrl+'pages/stats.html'+vars+'">Job Statistics ('+unitName+' Today)</a>\
    </li>\
    <li id="lhexportmenuitem">\
    <a href="'+lighthouseUrl+'pages/advexport.html'+vars+'">Job Export ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">Teams\
    </li>\
    <li id="lhteammenuitem">\
    <a href="'+lighthouseUrl+'pages/teamsummary.html'+vars+'">Team Summary ('+unitName+' Today)</a>\
    </li>\
    <li role="presentation" class="divider"></li><li role="presentation" class="dropdown-header">About\
    </li>\
    <li id="lhtourmenuitem">\
    <a href="#" id="LHTourRestart">Restart All Tours</a>\
    </li>\
    <li>\
    <a href="https://github.com/NSWSESMembers/Lighthouse/blob/master/README.md">About Lighthouse</a>\
    </li>\
    </ul>\
    </li>\
    ')
}


}

$('.nav .navbar-nav:not(".navbar-right")').append(lighthouseMenu);

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

if (location.pathname == "/") {
  DoTour()
}

        //lighthouse menu for teams
        if (location.pathname == "/Teams") {

          //var filtermenu = '<li class="" id="lhquickfilter"> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">All</span></span> <br> </span> </ul> </li>';
          var filtermenu = '<li class="" id="lhquickfilter"> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span><i class="toggle-icon fa fa-angle-left"></i></a><ul class="sub-menu" style="display: none;"><li class="active"><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-home"></i><a style="font-size: .9em; margin-left: 5px">Locations</a><span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span><span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span><span class="label tag tag-lighthouse" id="clearlocator"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span></span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-clock-o"></i><a style="font-size: .9em; margin-left: 5px">Times</a><span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span><span class="label tag tag-task tag-disabled" id="filter7days"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30days"><span class="tag-text">30 Days</span></span></span><li></ul></li>';

          filtermenu = filtermenu.replace(/\$LHURL/g, lighthouseUrl);

          filtermenu = filtermenu.replace(/\$UNIT/g, user.hq.Code);



          if (user.hq.EntityTypeId != 1) {
            //make region level more obvious
            filtermenu = filtermenu.replace(/\$REGION/g, user.hq.ParentEntity.Code+" Units");
          } else {
            filtermenu = filtermenu.replace(/\$REGION/g, user.hq.ParentEntity.Code);

          }

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

        }

      //lighthouse menu for jobs

      if (location.pathname == "/Jobs") {

       //with dates var filtermenu = '<li class=""> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Time Range</a> <span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span> <span class="label tag tag-task tag-disabled" id="filter3day"><span class="tag-text">3 Days</span></span> <span class="label tag tag-task tag-disabled" id="filter7day"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30day"><span class="tag-text">30 Days</span></span> </span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Open</span></span> <span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span> <span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Type</a> <span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span> <span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span> <span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span> <span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">NSW</span></span> <br> </span> </ul> </li>';


       var filtermenu = '<li class="" id="lhquickfilter"> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span><i class="toggle-icon fa fa-angle-left"></i></a><ul class="sub-menu" style="display: none;"><li class="active"><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-flag"></i><a style="font-size: .9em;margin-left: 5px">Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Outstanding</span></span><span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span><span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span></span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-file-text-o"></i><a style="font-size: .9em;margin-left: 5px">Job Type</a><span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span><span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span><span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span><span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span></span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-home"></i><a style="font-size: .9em; margin-left: 5px">Locations</a><span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span><span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span><span class="label tag tag-lighthouse" id="clearlocator"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span></span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"><i class="toggle-icon-sub fa fa-clock-o"></i><a style="font-size: .9em; margin-left: 5px">Times</a><span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span><span class="label tag tag-task tag-disabled" id="filter7days"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30days"><span class="tag-text">30 Days</span></span></span><li></ul></li>';

       filtermenu = filtermenu.replace(/\$LHURL/g, lighthouseUrl);
       filtermenu = filtermenu.replace(/\$UNIT/g, user.hq.Code);
       if (user.hq.EntityTypeId != 1) {
            //make region level more obvious
            filtermenu = filtermenu.replace(/\$REGION/g, user.hq.Code+" Units");
          } else {
            filtermenu = filtermenu.replace(/\$REGION/g, user.hq.ParentEntity.Code);

          }
          $('.main-menu > li:nth-child(1)').after(filtermenu);

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

      } // location.pathname == "/Jobs"
  }) // xhttp.onreadystatechange


});


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
