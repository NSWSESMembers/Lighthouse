var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var LighthouseChrome = require('../lib/shared_chrome_code.js');

var moment = require('moment');
var $ = require('jquery');
global.jQuery = $;

var timeoverride = null;

var params = getSearchParameters();

var apiHost = params.host
var token = ''
var tokenexp = ''


// inject css c/o browserify-css
require('../styles/teamsummary.css');

// window.onerror = function(message, url, lineNumber) {
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message;
//   return true;
// };

//on DOM load
document.addEventListener('DOMContentLoaded', function() {
  var mp = new Object();
  mp.setValue = function(value) { //value between 0 and 1
    $('#loadprogress').css('width', (Math.round(value * 100) + '%'));
    $('#loadprogress').text(Math.round(value * 100) + '%')
  }
  mp.open = function() {
    $('#loadprogress').css('width', 1 + '%');
  }
  mp.fail = function(error) {
    $('#loadprogress').css('width', '100%');
    $('#loadprogress').addClass('progress-bar-striped bg-danger');
    $('#loadprogress').text('Error Loading - ' + error)
  }
  mp.close = function() {
    document.getElementById("loading").style.visibility = 'hidden';
    positionFooter();

    $(window)
      .scroll(positionFooter)
      .resize(positionFooter)

  }

  //run every X period of time the main loop.
  display = document.querySelector('#time');
  startTimer(60, display);

  RunForestRun(mp)
});


$(document).on('change', 'input[name=slide]:radio', function() {
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

//refresh button
$(document).ready(function() {

  validateTokenExpiration();
  setInterval(validateTokenExpiration, 3e5);

  if (chrome.manifest.name.includes("Development")) {
    $('body').addClass("watermark");
  }


  document.getElementById("refresh").onclick = function() {
    RunForestRun();
  }


});

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
  var params = {};
  var prmarr = prmstr.split("&");
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split("=");
    params[tmparr[0]] = decodeURIComponent(tmparr[1]);
  }
  return params;
}

var timeperiod;
var unit = null;

function validateTokenExpiration() {
  getToken(function() {
    moment().isAfter(moment(tokenexp).subtract(5, "minutes")) && (console.log("token expiry triggered. time to renew."),
      $.ajax({
        type: 'GET',
        url: params.source + "/Authorization/RefreshToken",
        beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function(response, textStatus) {
          token = response.responseJSON.access_token
          tokenexp = response.responseJSON.expires_at
          chrome.storage.local.set({
            ['beaconAPIToken-' + apiHost]: JSON.stringify({
              token: token,
              expdate: tokenexp
            })
          }, function() {
            console.log('local data set - beaconAPIToken')
          })
          console.log("successful token renew.")
        }
      })
    )
  })
}

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
function RunForestRun(mp) {
  getToken(function() {
    mp && mp.open();


    if (timeoverride != null) { //we are using a time override

      var end = new Date();

      var start = new Date();
      start.setDate(start.getDate() - (timeoverride / 24));

      starttime = start.toISOString();
      endtime = end.toISOString();

      params.start = starttime;
      params.end = endtime;

    } else {
      params = getSearchParameters();
    }

    if (unit == null) {
      console.log("firstrun...will fetch vars");

      if (typeof params.hq != 'undefined') { //if not no hqs
        if (params.hq.split(",").length == 1) { //if only one HQ
          LighthouseUnit.get_unit_name(params.hq, apiHost, token, function(result, error) {
            if (typeof error == 'undefined') {
              unit = result;
              HackTheMatrix(unit, apiHost, params.source, token, mp);
            } else {
              mp.fail(error)
            }
          });
        } else {
          unit = [];
          console.log("passed array of units");
          var hqsGiven = params.hq.split(",");
          console.log(hqsGiven);
          hqsGiven.forEach(function(d) {
            LighthouseUnit.get_unit_name(d, params.host, token, function(result, error) {
              if (typeof error == 'undefined') {
                mp.setValue(((10 / params.hq.split(",").length) * unit.length) / 100) //use 10% for lhq loading
                unit.push(result);
                if (unit.length == params.hq.split(",").length) {
                  HackTheMatrix(unit, apiHost, params.source, token, mp);
                }
              } else {
                mp.fail(error)
              }
            });
          });
        }
      } else { //no hq was sent, get them all
        unit = [];
        HackTheMatrix(unit, apiHost, params.source, token, mp);
      }
    } else {
      console.log("rerun...will NOT fetch vars");
      HackTheMatrix(unit, apiHost, params.source, token);
    }
  })
}

//make the call to beacon
function HackTheMatrix(unit, host, source, token, progressBar) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var totalMembersActive = 0;
  var totalTeamsActive = 0;

  LighthouseTeam.get_teams(unit, host, start, end, token, function(teams) {
      var options = {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false
      };
      var table = document.getElementById("resultstable").getElementsByTagName('tbody')[0];

      $("#resultstable tbody tr").each(function() {
        this.parentNode.removeChild(this);
      });

      teams.Results.forEach(function(d) { //for every team

        if (d.TeamStatusType.Name != "Stood Down" && d.TeamStatusType.Name != "Rest" && d.TeamStatusType.Name != "Standby" && d.TeamStatusType.Name != "On Alert") { //that has not stood down

          totalTeamsActive++;

          var row = table.insertRow(-1);
          var callsign = row.insertCell(0);
          var members = row.insertCell(1);
          var status = row.insertCell(2);
          var jobCount = row.insertCell(3);
          var latestupdate = row.insertCell(4);
          latestupdate.className = "update";

          callsign.innerHTML = "<a href=\"" + source + "/Teams/" + d.Id + "/Edit\" target=\"_blank\">" + d.Callsign.trim() + "</a>";

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
          var teamdate = new Date(rawteamdate.getTime());
          status.innerHTML = d.TeamStatusType.Name + "<br>" + teamdate.toLocaleTimeString("en-au", options);
          status.className = "status";

          var latest = null;
          var oldesttime = null;
          var completed = 0;

          LighthouseTeam.get_tasking(d.Id, host, token, function(e) {
            e.Results.forEach(function(f) {
              f.CurrentStatus == "Complete" && completed++;
              var rawdate = new Date(f.CurrentStatusTime);
              var thistime = new Date(rawdate.getTime());


              if (oldesttime < thistime && f.CurrentStatus !== "Tasked" && f.CurrentStatus !== "Untasked") { //it wasnt an untask or a tasking (so its a action the team made like on route or onsite)
                var diff = moment(thistime).fromNow();
                latest = f.CurrentStatus + " #" + "<a style=\"color: inherit;\" href=\"" + source + "/Jobs/" + f.Job.Id + "\" target=\"_blank\">" + f.Job.Identifier + "</a>" + "<br>" + f.Job.Address.PrettyAddress + "<br>" + thistime.toLocaleTimeString("en-au", options) + "<br>" + diff;
                oldesttime = thistime;
              }
            });

            if (latest == null) {
              latest = "No Updates";
            }
            latestupdate.innerHTML = latest;

            jobCount.innerHTML = "<a href=\"" + source + "/Teams/" + d.Id + "/Jobs\" target=\"_blank\">" + d.TaskedJobCount + " | " + completed + "</a>";
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
      document.getElementById("banner").innerHTML = banner + "<h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "<br>Total Active Members: " + totalMembersActive + " | Total Active Teams: " + totalTeamsActive + "</h4>";
      progressBar && progressBar.setValue(1);
      progressBar && progressBar.close();
    },
    function(val, total) {
      if (progressBar) { //if its a first load
        if (val == -1 && total == -1) {
          progressBar.fail();
        } else {
          progressBar.setValue(0.1 + ((val / total) - 0.1)) //start at 10%, dont top 100%
        }
      }
    }
  );
}


function secondsToHms(d) {
  d = Number(d);
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);
  return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
}

function positionFooter() {
  var footerHeight = 55,
    footerTop = 0,
    $footer = $(".footer");
  footerHeight = $footer.height();
  footerTop = ($(window).scrollTop() + $(window).height() - footerHeight) + "px";

  if (($(document.body).height() + footerHeight) < $(window).height()) {
    $footer.css({
      position: "absolute"
    })
  } else {
    $footer.css({
      position: "static"
    })
  }
}

// wait for token to have loaded
function getToken(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function(data) {
      var tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost])
      if (typeof tokenJSON.token !== "undefined" && typeof tokenJSON.expdate !== "undefined" && tokenJSON.token != '' && tokenJSON.expdate != '') {
        token = tokenJSON.token
        tokenexp = tokenJSON.expdate
        console.log("api key has been found");
        clearInterval(waiting); //stop timer
        cb(); //call back
      }
    })
  }, 200);
}
