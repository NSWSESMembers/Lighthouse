var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseChrome = require('../lib/shared_chrome_code.js');

var $ = require('jquery');
var _ = require('underscore');

global.jQuery = $;
var ElasticProgress = require('elastic-progress');
var crossfilter = require('crossfilter');

require('bootstrap-tour')

require('bootstrap');


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
      applyTheme([localStorage.getItem("LighthouseSummaryTheme")]);



      //This is called when the loading progress bar closes. good place for onload kinda code



/// Initialize the tour
summaryTour.init();

// Start the tour
summaryTour.start();
console.log('Close finished')
startTimer(60);

resize()

}
});

  // SET ON CLOSE TO RUN THIS

  //run every X period of time the main loop.

  RunForestRun(mp);
});

window.addEventListener('resize', function(event){
  console.log('resize')
  resize()
});

$(document).on('change', 'input[name=slide]:radio', function() {
  console.log(this.value);
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

$(document).on('click',"#settings", function() {
  $('input[name=themebox]').val([localStorage.getItem("LighthouseSummaryTheme")]);
  $('#settingsmodal').modal('show');
})

$(document).on('click',"#submitButton",function() {
  $('#settingsmodal').modal('hide');

  localStorage.setItem("LighthouseSummaryTheme",$('input[name=themebox]:checked').val())
  applyTheme($('input[name=themebox]:checked').val()) 

})

function resize() {
  var neightbourHeight = $('#outstanding').parent().parent().parent().parent().parent().height()

  neightbourHeight=parseInt(neightbourHeight)-10-10-10-10-10 //all the padding
  $('#title').parent().height(neightbourHeight*0.6) //60%
  ($('#title-details-start').parent().parent().height(neightbourHeight*0.4)) //40%

  return true

}

function applyTheme(themeName){
  console.log('Apply theme:'+themeName)
  switch (themeName+''){ //make it a string because storage objects is weird

   case "wob":
   $( "body" ).removeClass('night');
   $( "body" ).removeClass('day');
   break;

   case "boo":
   $( "body" ).removeClass('night');
   $( "body" ).addClass('day');
   break;

   case "night":
   $( "body" ).removeClass('day');
   $( "body" ).addClass('night');
   break;

   default:
   console.log("unknown theme. reseting")
   localStorage.setItem("LighthouseSummaryTheme",'boo')

   applyTheme("boo")


   break;
 }
}

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

    params.start = starttime;
    params.end = endtime;

  } else {
    params = getSearchParameters();
  }

  if (unit == null) {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') {
      if (params.hq.split(",").length == 1) { //one HQ was passed
        LighthouseUnit.get_unit_name(params.hq, params.host, params.token, function(result) {
          unit = result;
          HackTheMatrix(unit, params.host,params.token,mp);
        });
      } else {
        unit = [];
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        hqsGiven.forEach(function(d) {
          LighthouseUnit.get_unit_name(d, params.host, params.token, function(result) {
            unit.push(result);
            if (unit.length == params.hq.split(",").length) {
              HackTheMatrix(unit, params.host,params.token,mp);
            }
          });
        });
      }
    } else { //no hq was sent, get them all
      unit = [];
      HackTheMatrix(unit, params.host,params.token,mp);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    HackTheMatrix(unit, params.host,params.token);
  }

}

//make the call to beacon
function HackTheMatrix(unit, host, token, progressBar) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  LighthouseJob.get_json(unit, host, start, end, token,
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

      JobStatusGroup.all().forEach(function(d) {
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
          default:
          console.log("unmatched status - "+d)
          break;
        }
      });

      var storm = 0;
      var flood = 0;
      var rescue = 0;
      var support = 0;

      JobTypeGroup.all().forEach(function(d) {
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

      var outstanding = newJob + activeJob + tskJob + refJob;
      var completed = canJob + completeJob + finJob + rejJob;

      _.each([
        ['#outstanding', outstanding],
        ['#completedsum', completed],
        ['#totalnumber', jobs.Results.length],
        ['#new', newJob],
        ['#active', activeJob],
        ['#tasked', tskJob],
        ['#completed', completeJob],
        ['#referred', refJob],
        ['#cancelled', canJob],
        ['#rejected', rejJob],
        ['#finalised', finJob],
        ['#support', support],
        ['#flood', flood],
        ['#rescue', rescue],
        ['#storm', storm],
        ], function(params) {
          var [elem, jobCount] = params;
          $(elem + ' .lh-value').text('' + jobCount)
          if(jobCount > 0) {
            $(elem + ' .lh-subscript').text(Math.round(jobCount / jobs.Results.length * 100) + '%')
          }
          else {
            $(elem + ' .lh-subscript').html('&mdash;%')
          }
        });
      
      var options = {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false
      };

      var title;
      
      if (unit.length == 0) { //whole nsw state
        document.title = "NSW Job Summary";
        title = "<p style='margin-bottom:0px'>Job Summary</p>NSW";
      } else {
        if (Array.isArray(unit) == false) { //1 lga
          document.title = unit.Name + " Job Summary";
          title = "<p style='margin-bottom:0px'>Job Summary</p>"+unit.Name;
        }
        if (unit.length > 1) { //more than one
          document.title = "Group Job Summary";
          title = "<p style='margin-bottom:0px'>Job Summary</p>"+unit.length+" Units";
        };
      }

      var weekday = new Array(7);
      weekday[0] =  "Sunday";
      weekday[1] = "Monday";
      weekday[2] = "Tuesday";
      weekday[3] = "Wednesday";
      weekday[4] = "Thursday";
      weekday[5] = "Friday";
      weekday[6] = "Saturday";

      $('#title-details-start').html('<div>'+weekday[start.getDay()]+'</div><div>'+start.getHours().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false})+':'+start.getMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false})+'</div><div>'+start.getDate()+'/'+(parseInt(start.getMonth())+1)+'/'+start.getFullYear()+'</div>')
      $('#title-details-finish').html('<div>'+weekday[end.getDay()]+'</div><div>'+end.getHours().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false})+':'+end.getMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false})+'</div><div>'+end.getDate()+'/'+(parseInt(end.getMonth())+1)+'/'+end.getFullYear()+'</div>')

      $('#title').html(title)

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


      // Instance the tour
      var summaryTour = new Tour({
        name: "LHTJobSummary",
        smartPlacement: true,
        debug: true,
        steps: [
        {
          element: "",
          placement: "top",
          orphan: true,
          backdrop: true,
          title: "Welcome",
          content: "Welcome to the Job Summary Dashboard. As this is your first time here lets quickly run through how this all works. Most things are self explanatory so this will be quick."
        },
        {
          element: "#title",
          placement: "auto",
          orphan: true,
          backdrop: true,
          title: "Selected unit",
          content: "This represents which unit (or group of unit) the summary covers. A count will be shown if multiple units are sellected."
        },
        {
          element: "#radio1",
          delay: 500,
          placement: "top",
          orphan: true,
          backdrop: true,
          title: "Time override",
          content: "Use these to ignore the selected time and automatically keep a sliding time window."
        },
        {
          element: "#refresh",
          title: "Refresh",
          placement: "auto",
          backdrop: true,
          content: "The data will automatically update when the timer reaches 0. You can force an update by clicking here at any time.",
        },
        {
          element: "#settings",
          title: "Settings",
          placement: "top",
          backdrop: true,
          content: "Here you will find display settings.",
          onNext: function (tour) {$('#settingsmodal').modal('show');}
        },
        {
          element: "#themepicker",
          title: "Colour Theme",
          placement: "right",
          delay: 500,
          backdrop: true,
          content: "This changes the colour theme of the dashboard."
        },
        {
          element: "#submitButton",
          title: "Save",
          placement: "auto",
          backdrop: true,
          onNext: function (tour) {$('#settingsmodal').modal('hide');},
          content: "Don't forget to save."
        },
        {
          element: "",
          delay: 500,
          placement: "top",
          orphan: true,
          backdrop: true,
          title: "Thanks",
          content: "This covers the basic operation of the Job Summary Dashboard."
        }
        ]});
