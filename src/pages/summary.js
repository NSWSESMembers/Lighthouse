var LighthouseJob = require('./lib/shared_job_code.js');
var LighthouseUnit = require('./lib/shared_unit_code.js');
require('./lib/shared_chrome_code.js'); // side-effect
import '../../styles/pages/summary.css';

var $ = require('jquery');
var _ = require('underscore');
var moment = require('moment');

global.jQuery = $;
var crossfilter = require('crossfilter');
require('bootstrap'); // for jq plugin: modal

var params = getSearchParameters();


var timeoverride = null;

var apiHost = params.host
var token = ''
var tokenexp = ''

var apiLoadingInterlock = false

var timeperiod;
var unit = null;

var sounds = {
  'None': '',
  'Chime': 'sounds/chime.mp3',
  'iphone': 'sounds/iphone.mp3',
  'Minion': 'sounds/minion.mp3',
  'Ding': 'sounds/ding.mp3',
}

var newJobSoundElement = document.createElement('audio');
var newJobSoundSampleElement = document.createElement('audio');


$(document).ready(function() {

  $('body').addClass('fade-in');
  validateTokenExpiration();

  setInterval(validateTokenExpiration, 3e5);

  if (chrome.manifest.name.includes("Development")) {
    $('body').addClass("watermark");
  }
  document.getElementById("refresh").onclick = function() {
    RunForestRun();
  }
});


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
    document.getElementById("results").style.visibility = 'visible';
    applyTheme([localStorage.getItem("LighthouseSummaryTheme")]);
    applySounds()
    console.log('Close finished')
    startTimer(30);

    resize()
  }


  // SET ON CLOSE TO RUN THIS

  //run every X period of time the main loop.
  RunForestRun(mp)
});

window.addEventListener('resize', function(event) {
  resize()
});

$('#newJobSound').change(function() {
  var val = $(this).val()
  console.log('Going to play ' + val)
  newJobSoundSampleElement.setAttribute('src', sounds[val]);

  if (val != 'None') {
    newJobSoundSampleElement.play();
  }
});

$(document).on('change', 'input[name=slide]:radio', function() {
  console.log(this.value);
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

$(document).on('click', "#settings", function() {
  $('input[name=themebox]').val([localStorage.getItem("LighthouseSummaryTheme")]);
  $('#newJobSound').empty()
  $.each(Object.keys(sounds), function(val, text) {
    $('#newJobSound').append(new Option(text, text));
  });

  $('#newJobSound').val(localStorage.getItem("LighthouseSummaryNewJobSound"))

  $('#settingsmodal').modal('show');
})

$(document).on('click', "#submitButton", function() {
  $('#settingsmodal').modal('hide');

  localStorage.setItem("LighthouseSummaryTheme", $('input[name=themebox]:checked').val())
  localStorage.setItem("LighthouseSummaryNewJobSound", $('#newJobSound').val())
  applySounds()
  applyTheme($('input[name=themebox]:checked').val())

})

function resize() {
  if (typeof $('#outstanding').parent() === "function") {
    var neightbourHeight = $('#outstanding').parent().parent().parent().parent().parent().height()

    neightbourHeight = parseInt(neightbourHeight) - 10 - 10 - 10 - 10 - 10 //all the padding
    $('#title').parent().height(neightbourHeight * 0.6) //60%
    ($('#title-details-start').parent().parent().height(neightbourHeight * 0.4)) //40%

    return true
  }

}

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

function applyTheme(themeName) {
  console.log('Apply theme:' + themeName)
  switch (themeName + '') { //make it a string because storage objects is weird

    case "wob":
      $("body").removeClass('night');
      $("body").removeClass('day');
      break;

    case "boo":
      $("body").removeClass('night');
      $("body").addClass('day');
      break;

    case "night":
      $("body").removeClass('day');
      $("body").addClass('night');
      break;

    default:
      console.log("unknown theme. reseting")
      localStorage.setItem("LighthouseSummaryTheme", 'boo')

      applyTheme("boo")

      break;
  }
}

function applySounds() {
  var newJobSound = localStorage.getItem("LighthouseSummaryNewJobSound")
  console.log('NewJobSound is ', newJobSound)

  //set default
  if (newJobSound == null) {
    localStorage.setItem("LighthouseSummaryNewJobSound", "None")
    newJobSound = "None"
  }

  newJobSoundElement.setAttribute('src', sounds[newJobSound]);

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
    params[tmparr[0]] = decodeURIComponent(tmparr[1]);
  }
  return params;
}



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
  if (!apiLoadingInterlock) {
    //prevent multiple overlapping runs
    apiLoadingInterlock = true
    getToken(function() {
      mp && mp.open();

      if (timeoverride !== null) { //we are using a time override

        var end = new Date();

        var start = new Date();
        start.setDate(start.getDate() - (timeoverride / 24));

        let starttime = start.toISOString();
        let endtime = end.toISOString();

        params.start = starttime;
        params.end = endtime;

      } else {
        params = getSearchParameters();
      }

      if (unit == null) {
        console.log("firstrun...will fetch vars");

        if (typeof params.hq !== 'undefined') {
          if (params.hq.split(",").length == 1) { //one HQ was passed
            LighthouseUnit.get_unit_name(params.hq, apiHost, params.userId, token, function(result, error) {
              if (typeof error == 'undefined') {
                unit = result;
                HackTheMatrix(unit, apiHost, params.userId, token, mp);
              } else {
                mp.fail(error)
              }
            });
          } else {
            unit = [];
            console.log("passed array of units");
            var hqsGiven = params.hq.split(",");
            hqsGiven.forEach(function(d) {
              LighthouseUnit.get_unit_name(d, apiHost, params.userId, token, function(result, error) {
                if (typeof error == 'undefined') {
                  mp.setValue(((10 / params.hq.split(",").length) * unit.length) / 100) //use 10% for lhq loading
                  unit.push(result);
                  if (unit.length == params.hq.split(",").length) {
                    HackTheMatrix(unit, apiHost, params.userId, token, mp);
                  }
                } else {
                  mp.fail(error)
                }
              });
            });
          }
        } else { //no hq was sent, get them all
          unit = [];
          HackTheMatrix(unit, apiHost, params.userId, token, mp);
        }
      } else {
        console.log("rerun...will NOT fetch vars");
        HackTheMatrix(unit, apiHost, params.userId, token);
      }
    })
  } else {
    console.log("interlock true, we are already running. preventing sequential run")
  }
}

//make the call to beacon
function HackTheMatrix(unit, host, userId, token, progressBar) {
console.log(userId)
  progressBar && progressBar.setValue(0.5);
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  LighthouseJob.get_summary_json(unit, host, start, end, userId, token,
    function(summary) {
      progressBar && progressBar.setValue(1);

      var completeJob = _.findWhere(summary.result, {
        Name: "Complete"
      }).Count;
      var newJob = _.findWhere(summary.result, {
        Name: "New"
      }).Count;
      var activeJob = _.findWhere(summary.result, {
        Name: "Active"
      }).Count;
      var refJob = _.findWhere(summary.result, {
        Name: "Referred"
      }).Count;
      var finJob = _.findWhere(summary.result, {
        Name: "Finalised"
      }).Count;
      var canJob = _.findWhere(summary.result, {
        Name: "Cancelled"
      }).Count;
      var rejJob = _.findWhere(summary.result, {
        Name: "Rejected"
      }).Count;
      var tskJob = _.findWhere(summary.result, {
        Name: "Tasked"
      }).Count;

      var storm = _.findWhere(summary.result, {
        Name: "Storm"
      }).Count;
      var flood = _.findWhere(summary.result, {
        Name: "Flood Misc"
      }).Count;
      flood = flood + _.findWhere(summary.result, {
        Name: "Medical Resupply"
      }).Count;
      flood = flood + _.findWhere(summary.result, {
        Name: "Fodder Drop"
      }).Count;
      flood = flood + _.findWhere(summary.result, {
        Name: "Resupply"
      }).Count;
      flood = flood + _.findWhere(summary.result, {
        Name: "Vet Assistance"
      }).Count;

      var rescue = _.findWhere(summary.result, {
        Name: "RCR"
      }).Count;
      rescue = rescue + _.findWhere(summary.result, {
        Name: "FR"
      }).Count;
      rescue = rescue + _.findWhere(summary.result, {
        Name: "WR"
      }).Count;
      rescue = rescue + _.findWhere(summary.result, {
        Name: "VR"
      }).Count;
      rescue = rescue + _.findWhere(summary.result, {
        Name: "CFR"
      }).Count;


      var support = _.findWhere(summary.result, {
        Name: "Support"
      }).Count;

      var outstanding = newJob + activeJob + tskJob + refJob;
      var completed = canJob + completeJob + finJob + rejJob;

      var total = outstanding + completed

      //Sounds for new jobs
      if (newJob > parseInt($('#new .lh-value').text())) {
        console.log('New job, will play newJobSoundElement if set')

        if (newJobSoundElement.getAttribute('src') != '') {
          console.log('playing newJobSoundElement')
          newJobSoundElement.play();
        }
      }

      _.each([
        ['#outstanding', outstanding],
        ['#completedsum', completed],
        ['#totalnumber', outstanding + completed],
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
        if (jobCount > 0) {
          $(elem + ' .lh-subscript').text(Math.round(jobCount / total * 100) + '%')
        } else {
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
          var code = unit.Name
          if (code.length > 15) { //handle long unit names
            code = unit.Code
          }
          document.title = unit.Name + " Job Summary";
          title = "<p style='margin-bottom:0px'>Job Summary</p>" + code;
        }
        if (unit.length > 1) { //more than one
          document.title = "Group Job Summary";
          title = "<p style='margin-bottom:0px'>Job Summary</p>" + unit.length + " Units";
        };
      }

      var weekday = new Array(7);
      weekday[0] = "Sunday";
      weekday[1] = "Monday";
      weekday[2] = "Tuesday";
      weekday[3] = "Wednesday";
      weekday[4] = "Thursday";
      weekday[5] = "Friday";
      weekday[6] = "Saturday";

      $('#title-details-start').html('<div>' + weekday[start.getDay()] + '</div><div>' + start.getHours().toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
      }) + ':' + start.getMinutes().toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
      }) + '</div><div>' + start.getDate() + '/' + (parseInt(start.getMonth()) + 1) + '/' + start.getFullYear() + '</div>')
      $('#title-details-finish').html('<div>' + weekday[end.getDay()] + '</div><div>' + end.getHours().toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
      }) + ':' + end.getMinutes().toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
      }) + '</div><div>' + end.getDate() + '/' + (parseInt(end.getMonth()) + 1) + '/' + end.getFullYear() + '</div>')

      $('#title').html(title)

      progressBar && progressBar.setValue(1);
      progressBar && progressBar.close();

      apiLoadingInterlock = false


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
