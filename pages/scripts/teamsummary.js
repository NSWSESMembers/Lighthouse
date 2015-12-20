var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var $ = require('jquery');
global.jQuery = $;
var crossfilter = require('crossfilter');
var timeoverride = null;

// inject css c/o browserify-css
require('../styles/teamsummary.css');

// window.onerror = function(message, url, lineNumber) {
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message;
//   return true;
// };

//on DOM load
document.addEventListener('DOMContentLoaded', function() {

  //run every X period of time the main loop.
  display = document.querySelector('#time');
  startTimer(60, display);

  RunForestRun()
});


$(document).on('change', 'input[name=slide]:radio', function() {
  timeoverride = (this.value == "reset" ? null : this.value);

  RunForestRun();
});

//refresh button
$(document).ready(function() {
  document.getElementById("refresh").onclick = function() {
    RunForestRun();
  }
});


function myScript() {
  console.log("radio");
}

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
  var params = {};
  var prmarr = prmstr.split("&");
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split("=");
    params[tmparr[0]] = tmparr[1];
  }
  return params;
}

var timeperiod;
var unit = null;


var params = getSearchParameters();

//update every X seconds
function startTimer(duration, display) {
  var timer = duration,
  minutes, seconds;
  setInterval(function() {
    minutes = parseInt(timer / 60, 10)
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    display.textContent = minutes + ":" + seconds;

    if (--timer < 0) { //when the timer is 0 run the code
      timer = duration;
      RunForestRun();
    }
  }, 1000);
}



//Get times vars for the call
function RunForestRun() {

  if (timeoverride !== null) { //we are using a time override

    var end = new Date();

    var start = new Date();
    start.setDate(start.getDate() - (timeoverride / 24));


    starttime = start.toISOString();
    endtime = end.toISOString();

    console.log(starttime);
    console.log(endtime);

    params.start = starttime;
    params.end = endtime;

  } else {
    params = getSearchParameters();
  }

  if (unit == null) {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') {  //if not no hqs
      if (params.hq.split(",").length == 1) { //if only one HQ
        LighthouseUnit.get_unit_name(params.hq,params.host, function(result) {
          unit = result;
          HackTheMatrix(unit,params.host);
        });
      } else {
        unit = [];
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        console.log(hqsGiven);
        hqsGiven.forEach(function(d){
          LighthouseUnit.get_unit_name(d, params.host, function(result) {
            unit.push(result);
            if (unit.length == params.hq.split(",").length) {
              HackTheMatrix(unit, params.host);
            }
          });
        });
      }
    } else { //no hq was sent, get them all
      unit = [];
      HackTheMatrix(unit,params.host);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    HackTheMatrix(unit, params.host);
  }

}

//make the call to beacon
function HackTheMatrix(unit, host) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var totalMembersActive = 0;
  var totalTeamsActive = 0;

  LighthouseTeam.get_teams(unit, host, start, end, function(teams) {

    var options = {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "numeric",
      hour12: false
    };
    var table = document.getElementById("resultstable").getElementsByTagName('tbody')[0];

    $( "#resultstable tbody tr" ).each( function(){
      this.parentNode.removeChild( this );
    });

    teams.Results.forEach(function(d) { //for every team

      if (d.TeamStatusType.Name !== "Stood Down") { //that has not stood down

        totalTeamsActive++;

        var row = table.insertRow(-1);
        var callsign = row.insertCell(0);
        var members = row.insertCell(1);
        var status = row.insertCell(2);
        var jobCount = row.insertCell(3);
        var latestupdate = row.insertCell(4);
        latestupdate.className = "update";

        callsign.innerHTML = "<a href=\"https://"+host+"/Teams/"+d.Id+"/Edit\" target=\"_blank\">"+d.Callsign+"</a>";

        switch (d.TeamStatusType.Id) { //color the callsign by team status
          case 3: //active
          callsign.className = "callsign-active";
          break;
          case 1: //standby
          callsign.className = "callsign-standby";
          break;
          case 4: //rest
          callsign.className = "callsign-rest";
          break;
          case 2: //alert
          callsign.className = "callsign-alert";
          break;
          default:
          callsign.className = "callsign";
          break;
        }

        if (d.Members.length == 0) {
          members.innerHTML = "Empty"
        } else {
          d.Members.forEach(function(d2) { //for each member in the team
            totalMembersActive++; //count them
            if (members.innerHTML == "") { //if the first in the string dont add command
              if (d2.TeamLeader == true) { //bold if team leader
                members.innerHTML = "<b>" + d2.Person.FirstName + " " + d2.Person.LastName + "</b>";
              } else { //not bold
                members.innerHTML = d2.Person.FirstName + " " + d2.Person.LastName;
              }
            } else { //not first in string
              if (d2.TeamLeader == true) { //bold if team leader
                members.innerHTML = members.innerHTML + ", " + "<b>" + d2.Person.FirstName + " " + d2.Person.LastName + "</b>";
              } else { // not team leader
                members.innerHTML = members.innerHTML + ", " + d2.Person.FirstName + " " + d2.Person.LastName;
              }
            }
          });
        }
        members.className = "members";

        var rawteamdate = new Date(d.TeamStatusStartDate);
        var teamdate = new Date(rawteamdate.getTime() + (rawteamdate.getTimezoneOffset() * 60000));
        status.innerHTML = d.TeamStatusType.Name +"<br>"+teamdate.toLocaleTimeString("en-au", options);
        status.className = "status";

        var latest = null;
        var oldesttime = null;
        var completed = 0;

        LighthouseTeam.get_tasking(d.Id,host, function(e) {
          e.Results.forEach(function(f) {
            f.CurrentStatus == "Complete" && completed++;
            var rawdate = new Date(f.CurrentStatusTime);
            var thistime = new Date(rawdate.getTime() + (rawdate.getTimezoneOffset() * 60000));


            if (oldesttime < thistime && f.CurrentStatus !== "Tasked" && f.CurrentStatus !== "Untasked") {
             var diff = (new Date) - thistime;
             diff = diff / 1000 / 60;
             latest = f.CurrentStatus + " #" + f.Job.Identifier + "<br>" + f.Job.Address.PrettyAddress + "<br>" + thistime.toLocaleTimeString("en-au", options)+ "<br>"+secondsToHms(Math.round(diff))+" hrs ago";
             oldesttime = thistime;
           }
         });

          if (latest == null) {
            latest = "No Updates";
          }
          latestupdate.innerHTML = latest;

          jobCount.innerHTML = d.TaskedJobCount+"/"+completed;
          jobCount.className = "jobcount";
        });

        jobCount.innerHTML = "<img width=\"50%\" alt=\"Loading...\" src=\"images/loader.gif\">";
        latestupdate.innerHTML = "<img width=\"20%\" alt=\"Loading...\" src=\"images/loader.gif\">";

      }
    });

    var banner;

    if (unit.length == 0) { //whole nsw state
      document.title = "NSW Team Summary";
      banner = "<h2>Team summary for NSW</h2>";
    } else {
      if (Array.isArray(unit) == false) { //1 lga
        document.title = unit.Name + " Team Summary";
        banner = '<h2>Team summary for ' + unit.Name + "</h2>";
      };
      if (unit.length > 1) { //more than one
        document.title = "Group Team Summary";
        banner = "<h2>Team summary for Group</h2>";
      };
    }
    document.getElementById("banner").innerHTML = banner + "<h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "<br>Total Active Members: " + totalMembersActive + " | Total Active Teams: "+totalTeamsActive+"</h4>";
    document.getElementById("loading").style.visibility = 'hidden';
  });
}


function secondsToHms(d) {
d = Number(d);
var h = Math.floor(d / 3600);
var m = Math.floor(d % 3600 / 60);
var s = Math.floor(d % 3600 % 60);
return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s); }

