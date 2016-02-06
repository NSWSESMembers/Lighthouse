whenWeAreReady(user,function() {

  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      results = JSON.parse(xhttp.responseText);

      user.hq = results;

      //menu bar code
      var ul = document.getElementsByClassName("nav navbar-nav");

      var li = document.createElement("li");
      li.classList.add("dropdown");

      var tonight = new Date();

      tonight.setHours(23, 59, 59, 0);

      tonight = new Date(tonight.getTime());


      var thismorning = new Date();

      thismorning.setHours(0, 0, 0, 0);

      thismorning = new Date(thismorning.getTime());


      var vars = "?host=" + location.hostname + "&hq=" + user.currentHqId + "&start=" + encodeURIComponent(thismorning.toISOString()) + "&end=" + encodeURIComponent(tonight.toISOString());

      var jobsummaryUrl = lighthouseUrl + "pages/summary.html" + vars;
      var jobstatsUrl = lighthouseUrl + "pages/stats.html" + vars;
      var jobexportUrl = lighthouseUrl + "pages/advexport.html" + vars;

      var teamsummaryUrl = lighthouseUrl + "pages/teamsummary.html" + vars;

      var aboutURL = "https://github.com/OSPFNeighbour/Lighthouse/blob/master/README.md" //chrome.extension.getURL("lighthouse/about.html");


      li.innerHTML = "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\"><span class=\"nav-text\"><img width=\"16px\" style=\"vertical-align: text-bottom;margin-right:5px\" src=\"" + lighthouseUrl + "icons/lh.png" + "\">Lighthouse</span></a><ul class=\"dropdown-menu\"><li role=\"presentation\" class=\"dropdown-header\">Jobs</li><li><a href=\"" + jobsummaryUrl + "\">Job Summary (" + results.Code + " Today)</a></li><li><a href=\"" + jobstatsUrl + "\">Job Statistics (" + results.Code + " Today)</a></li><li><a href=\"" + jobexportUrl + "\">Job Export (" + results.Code + " Today)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">Teams</li><li><a href=\"" + teamsummaryUrl + "\">Team Summary (" + results.Code + " Today)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">About</li><li><a href=\"" + aboutURL + "\">About Lighthouse</a></li>";

      $('.nav .navbar-nav:not(".navbar-right")').append(li);


        //lighthouse menu for teams
        if (location.pathname == "/Teams") {

          var filtermenu = '<li class=""> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">NSW</span></span> <br> </span> </ul> </li>';

          filtermenu = filtermenu.replace(/\$LHURL/g, lighthouseUrl);
          filtermenu = filtermenu.replace(/\$UNIT/g, user.hq.Code);
          filtermenu = filtermenu.replace(/\$REGION/g, user.hq.ParentEntity.Code);

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



        }

      //lighthouse menu for jobs

      if (location.pathname == "/Jobs") {

       //with dates var filtermenu = '<li class=""> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Time Range</a> <span class="label tag tag-task tag-disabled" id="filtertoday"><span class="tag-text">Today</span></span> <span class="label tag tag-task tag-disabled" id="filter3day"><span class="tag-text">3 Days</span></span> <span class="label tag tag-task tag-disabled" id="filter7day"><span class="tag-text">7 Days</span></span><span class="label tag tag-task tag-disabled" id="filter30day"><span class="tag-text">30 Days</span></span> </span><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Open</span></span> <span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span> <span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Type</a> <span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span> <span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span> <span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span> <span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">NSW</span></span> <br> </span> </ul> </li>';


        var filtermenu = '<li class=""> <a href="#" class="js-sub-menu-toggle"> <i class="fa fa-fw"></i><img width="14px" style="vertical-align:top;margin-right:10px;float:left" src="$LHURLicons/lh-black.png"><span class="text" style="margin-left: -20px;">Lighthouse Quick Filters</span> <i class="toggle-icon fa fa-angle-left"></i> </a> <ul class="sub-menu " style="display: none;"><span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Status</a> <span class="label tag tag-job-status tag-disabled" id="filteropen"><span class="tag-text">Open</span></span> <span class="label tag tag-job-status tag-disabled" id="filterclosed"><span class="tag-text">Closed</span></span> <span class="label tag tag-lighthouse" id="filterallstatus"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Job Type</a> <span class="label tag tag-rescue tag-disabled" id="filterrescue"><span class="tag-text">Rescue</span></span> <span class="label tag tag-job-type tag-disabled" id="filterstorm"><span class="tag-text">Storm</span></span> <span class="label tag tag-flood-misc tag-disabled" id="filterflood"><span class="tag-text">Flood</span></span> <span class="label tag tag-lighthouse" id="filteralltype"><span class="tag-text"><img width="14px" style="width:14px;vertical-align:top;margin-right:5px" src="$LHURLicons/lh-black.png">All</span></span> </span> <span class="twitter-typeahead" style="margin-left:5px;margin-bottom:10px;position:relative;display:inline-block;direction:ltr"> <a>Locations</a> <span class="label tag tag-property tag-disabled" id="filtermyhq"><span class="tag-text">$UNIT</span></span> <span class="label tag tag-property tag-disabled" id="filterallmyregion"><span class="tag-text">$REGION</span></span> <span class="label tag tag-property tag-disabled" id="clearlocator"><span class="tag-text">NSW</span></span> <br> </span> </ul> </li>';

        filtermenu = filtermenu.replace(/\$LHURL/g, lighthouseUrl);
        filtermenu = filtermenu.replace(/\$UNIT/g, user.hq.Code);
        filtermenu = filtermenu.replace(/\$REGION/g, user.hq.ParentEntity.Code);

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

      } // location.pathname == "/Jobs"
    } // xhttp.readyState == 4 && xhttp.status == 200
  } // xhttp.onreadystatechange

  xhttp.open("GET", "https://" + location.hostname + "/Api/v1/Entities/" + user.currentHqId, true);
  xhttp.send();

});


function filtershowallmyregion() {
  filterViewModel.selectedEntities.destroyAll() //flush first :-)
var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function() {
  if (xhttp.readyState == 4 && xhttp.status == 200) {
    results = JSON.parse(xhttp.responseText);
    console.log(results);
    results.forEach(function(d) {
      filterViewModel.selectedEntities.push(d);
    });
    filterViewModel.updateFilters();
  }
}
xhttp.open("GET", "https://" + location.hostname + "/Api/v1/Entities/" + user.currentRegionId + "/Children", true);
xhttp.send();
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
