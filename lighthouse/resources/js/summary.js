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
  startTimer(180);

  RunForestRun(mp);
});


$(document).on('change', 'input[name=slide]:radio', function() {
  console.log(this.value);
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

//refresh button
$(document).ready(function() {
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
        GetUnitNamefromBeacon(params.hq, params.host, function(result) {
          unit = result;
          HackTheMatrix(unit, params.host,mp);
        });
      } else {
        unit = [];
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        console.log(hqsGiven);
        hqsGiven.forEach(function(d) {
          GetUnitNamefromBeacon(d, params.host, function(result) {
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

  GetJSONfromBeacon(unit, host, start, end,
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
      var ackJob = 0;
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
          case "Acknowledged":
            ackJob = d.value;
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

      document.getElementById("new").innerHTML = newJob + "<h6>" + Math.round(newJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("ack").innerHTML = ackJob + "<h6>" + Math.round(ackJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("comp").innerHTML = completeJob + "<h6>" + Math.round(completeJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("ref").innerHTML = refJob + "<h6>" + Math.round(refJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("can").innerHTML = canJob + "<h6>" + Math.round(canJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("rej").innerHTML = rejJob + "<h6>" + Math.round(rejJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("tsk").innerHTML = tskJob + "<h6>" + Math.round(tskJob / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("fin").innerHTML = finJob + "<h6>" + Math.round(finJob / jobs.Results.length * 100) + "%</h6>";

      document.getElementById("support").innerHTML = support + "<h6>" + Math.round(support / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("flood").innerHTML = flood + "<h6>" + Math.round(flood / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("rescue").innerHTML = rescue + "<h6>" + Math.round(rescue / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("storm").innerHTML = storm + "<h6>" + Math.round(storm / jobs.Results.length * 100) + "%</h6>";
      var open = newJob + ackJob + tskJob + refJob;
      var closed = canJob + completeJob + finJob + rejJob;

      document.getElementById("open").innerHTML = open + "<h6>" + Math.round(open / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("closed").innerHTML = closed + "<h6>" + Math.round(closed / jobs.Results.length * 100) + "%</h6>";
      document.getElementById("totalnumber").innerHTML = jobs.Results.length + "<h6>" + Math.round(jobs.Results.length / jobs.Results.length * 100) + "%</h6>";
      
      var options = {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false
      };

      if (unit.length == 0) { //whole nsw state
        document.title = "NSW Job Summary";
        document.getElementById("banner").innerHTML = "<h3>Job summary for NSW</h3>";
      } else {
        if (Array.isArray(unit) == false) { //1 lga
          document.title = unit.Name + " Job Summary";
          document.getElementById("banner").innerHTML = '<h3>Job summary for ' + unit.Name + "</h3>";
        }
        if (unit.length == 1) { //more than one
          document.title = "Group Job Summary";
          document.getElementById("banner").innerHTML = "<h3>Job summary for Group</h3>";
        };
      }

      document.getElementById("banner").innerHTML = document.getElementById("banner").innerHTML + "<h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "</h4>";

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
