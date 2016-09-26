var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseChrome = require('../lib/shared_chrome_code.js');

var $ = require('jquery');
global.jQuery = $;
var ElasticProgress = require('elastic-progress');
var crossfilter = require('crossfilter');

// inject css c/o browserify-css
require('../styles/summary.css');


var timeoverride = null;

window.onerror = function(message, url, lineNumber) {
  document.getElementById("loading").innerHTML = "Error loading page<br>" + message + " Line " + lineNumber;
  return true;
};



//on DOM load
document.addEventListener('DOMContentLoaded', function() {
  var element = document.querySelector('.loadprogress');

  var mp = new ElasticProgress(element, {
    buttonSize: 60,
    fontFamily: "Montserrat",
    colorBg: "#7dbde8",
    colorFg: "#0f3a57",
    onClose:function(){
      document.getElementById("loading").style.visibility = 'hidden';
      document.getElementById("results").style.visibility = 'visible';
    }
  });

  // SET ON CLOSE TO RUN THIS

  //run every X period of time the main loop.
  startTimer(60);

  RunForestRun(mp);
});


$(document).on('change', 'input[name=slide]:radio', function() {
  console.log(this.value);
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

//refresh button
$(document).ready(function() {

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
    params[tmparr[0]] = tmparr[1];
  }
  return params;
}

var timeperiod;
var unit = null;


var params = getSearchParameters();

//update every X seconds
function startTimer(duration) {
  var display = document.querySelector('#time');
  var timer = duration,
  minutes, seconds;
  setInterval(function() {
    minutes = parseInt(timer / 60, 10)
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    display.innerText = minutes + ":" + seconds;

    if (--timer < 0) { //when the timer is 0 run the code
      timer = duration;
      RunForestRun();
    }
  }, 1000);
}



//Get times vars for the call
function RunForestRun(mp) {

  mp && mp.open();

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

    if (typeof params.hq !== 'undefined') {
      if (params.hq.split(",").length == 1) { //one HQ was passed
        LighthouseUnit.get_unit_name(params.hq, params.host, function(result) {
          unit = result;
          HackTheMatrix(unit, params.host,mp);
        });
      } else {
        unit = [];
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        console.log(hqsGiven);
        hqsGiven.forEach(function(d) {
          LighthouseUnit.get_unit_name(d, params.host, function(result) {
            unit.push(result);
            if (unit.length == params.hq.split(",").length) {
              HackTheMatrix(unit, params.host,mp);
            }
          });
        });
      }
    } else { //no hq was sent, get them all
      unit = [];
      HackTheMatrix(unit, params.host,mp);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    HackTheMatrix(unit, params.host);
  }

}

//make the call to beacon
function HackTheMatrix(unit, host, progressBar) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  LighthouseJob.get_json(unit, host, start, end,
    function(jobs) {
      var facts = crossfilter(jobs.Results);
      var all = facts.groupAll();

      var JobStatus = facts.dimension(function(d) {
        return d.JobStatusType.Name;
      });

      var JobType = facts.dimension(function(d) {
        return d.JobType.ParentId;
      });

      var JobStatusGroup = JobStatus.group().reduceCount(function(d) {
        return d.JobStatusType.Name;
      });
      var JobTypeGroup = JobType.group().reduceCount(function(d) {
        return d.JobType.ParentId;
      });

      var completeJob = 0;
      var newJob = 0;
      var activeJob = 0;
      var refJob = 0;
      var finJob = 0;
      var canJob = 0;
      var rejJob = 0;
      var tskJob = 0;

      JobStatusGroup.top(Infinity).forEach(function(d) {
        console.log(d.key + " " + d.value);
        switch (d.key) {
          case "New":
          newJob = d.value;
          break;
          case "Active":
          activeJob = d.value;
          break;
          case "Tasked":
          tskJob = d.value;
          break;
          case "Complete":
          completeJob = d.value;
          break;
          case "Finalised":
          finJob = d.value;
          break;
          case "Referred":
          refJob = d.value;
          break;
          case "Rejected":
          rejJob = d.value;
          break;
          case "Cancelled":
          canJob = d.value;
          break;
        }
      });

      var storm = 0;
      var flood = 0;
      var rescue = 0;
      var support = 0;

      JobTypeGroup.top(Infinity).forEach(function(d) {
        switch (d.key) {
            case 1: // Parent: Storm
            storm = d.value;
            break;
            case 2: // Parent: Support
            support = d.value;
            break;
            case 4: // Parent: Flood Assistance
            flood = d.value;
            break;
            case 5: // Parent: Rescue
            rescue = d.value;
            break;
          }
        });

      var open = newJob + activeJob + tskJob + refJob;
      var closed = canJob + completeJob + finJob + rejJob;

      document.getElementById("open").innerHTML = (jobs.Results.length && open) ? (open + "<h6>" + Math.round(open / jobs.Results.length * 100) + "%</h6>"):(open+"<h6>&ndash; %</h6>");
      document.getElementById("closed").innerHTML = (jobs.Results.length && closed) ? (closed + "<h6>" + Math.round(closed / jobs.Results.length * 100) + "%</h6>"):(closed+"<h6>&ndash; %</h6>");
      document.getElementById("totalnumber").innerHTML = jobs.Results.length+ "<h6>&ndash; %</h6>";

      document.getElementById("new").innerHTML = (jobs.Results.length && newJob) ? (newJob + "<h6>" + Math.round(newJob / jobs.Results.length * 100) + "%</h6>"):(newJob+"<h6>&ndash; %</h6>");
      document.getElementById("active").innerHTML = (jobs.Results.length && activeJob) ? (activeJob + "<h6>" + Math.round(activeJob / jobs.Results.length * 100) + "%</h6>"):(activeJob+"<h6>&ndash; %</h6>");
      document.getElementById("tsk").innerHTML = (jobs.Results.length && tskJob) ? (tskJob + "<h6>" + Math.round(tskJob / jobs.Results.length * 100) + "%</h6>"):(tskJob+"<h6>&ndash; %</h6>");
      document.getElementById("comp").innerHTML = (jobs.Results.length && completeJob) ? (completeJob + "<h6>" + Math.round(completeJob / jobs.Results.length * 100) + "%</h6>"):(completeJob+"<h6>&ndash; %</h6>");
      
      document.getElementById("ref").innerHTML = (jobs.Results.length && refJob) ? (refJob + "<h6>" + Math.round(refJob / jobs.Results.length * 100) + "%</h6>"):(refJob+"<h6>&ndash; %</h6>");
      document.getElementById("can").innerHTML = (jobs.Results.length && canJob) ? (canJob + "<h6>" + Math.round(canJob / jobs.Results.length * 100) + "%</h6>"):(canJob+"<h6>&ndash; %</h6>");
      document.getElementById("rej").innerHTML = (jobs.Results.length && rejJob) ? (rejJob + "<h6>" + Math.round(rejJob / jobs.Results.length * 100) + "%</h6>"):(rejJob+"<h6>&ndash; %</h6>");
      document.getElementById("fin").innerHTML = (jobs.Results.length && finJob) ? (finJob + "<h6>" + Math.round(finJob / jobs.Results.length * 100) + "%</h6>"):(finJob+"<h6>&ndash; %</h6>");

      document.getElementById("support").innerHTML = (jobs.Results.length && support) ? (support + "<h6>" + Math.round(finJob / jobs.Results.length * 100) + "%</h6>"):(support+"<h6>&ndash; %</h6>");
      document.getElementById("flood").innerHTML = (jobs.Results.length && flood) ? (flood + "<h6>" + Math.round(flood / jobs.Results.length * 100) + "%</h6>"):(flood+"<h6>&ndash; %</h6>");
      document.getElementById("rescue").innerHTML = (jobs.Results.length && rescue) ? (rescue + "<h6>" + Math.round(rescue / jobs.Results.length * 100) + "%</h6>"):(rescue+"<h6>&ndash; %</h6>");
      document.getElementById("storm").innerHTML = (jobs.Results.length && storm) ? (storm + "<h6>" + Math.round(storm / jobs.Results.length * 100) + "%</h6>"):(storm+"<h6>&ndash; %</h6>");



      
      var options = {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false
      };

      var banner;
      
      if (unit.length == 0) { //whole nsw state
        document.title = "NSW Job Summary";
        banner = "<h3>Job summary for NSW</h3>";
      } else {
        if (Array.isArray(unit) == false) { //1 lga
          document.title = unit.Name + " Job Summary";
          banner = '<h3>Job summary for ' + unit.Name + "</h3>";
        }
        if (unit.length > 1) { //more than one
          document.title = "Group Job Summary";
          banner = "<h3>Job summary for Group</h3>";
        };
      }

      document.getElementById("banner").innerHTML = banner + "<h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "</h4>";

      progressBar && progressBar.setValue(1);
      progressBar && progressBar.close();


    },
    function(val,total){
      if (progressBar) { //if its a first load
        if (val == -1 && total == -1) {
          progressBar.fail();
        } else {
          progressBar.setValue(val/total)
        }
      }
    }
    );

}
