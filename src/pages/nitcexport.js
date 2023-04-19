import BeaconClient from '../shared/BeaconClient.js';
var $ = require('jquery');
global.jQuery = $;
var moment = require('moment');
import '../../styles/pages/nitcexport.css';

var params = getSearchParameters();

var token = params.token
var tokenexp = params.tokenexp

var timeoverride = null;

window.onerror = function(message, url, lineNumber) {
  document.getElementById("loading").style.visibility = 'visible';
  document.getElementById("loading").innerHTML = "Error loading page<br>"+message+" Line "+lineNumber;
  return true;
};


$(document).ready(function() {

  validateTokenExpiration();
  setInterval(validateTokenExpiration, 3e5);

})

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("goButton").addEventListener("click", function(){
    var element = document.querySelector('.loadprogress');
    var mp = new Object();
    mp.setValue = function(value) { //value between 0 and 1
      $('#loadprogress').css('width', (Math.round(value * 100) + '%'));
      $('#loadprogress').text(Math.round(value * 100) + '%')
    }
    mp.open = function() {
      document.getElementById("loading").style.visibility = 'visible';
      $('#loadprogress').css('width', 1 + '%');
    }
    mp.fail = function() {
      $('#loadprogress').addClass('progress-bar-striped bg-danger');
      $('#loadprogress').text('Error Loading')
    }
    mp.close = function() {
      document.getElementById("loading").style.visibility = 'hidden';
    }
    RunForestRun(mp);
  });
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
var unit = [];

function validateTokenExpiration()
  {
    moment().isAfter(moment(tokenexp).subtract(5, "minutes")) && (console.log("token expiry triggered. time to renew."),
      $.ajax({
        type: 'GET'
        , url: params.source+"/Authorization/RefreshToken"
        , beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        }
        , cache: false
        , dataType: 'json'
        , complete: function(response, textStatus) {
          token = response.responseJSON.access_token
          tokenexp = response.responseJSON.expires_at
          console.log("successful token renew.")
        }
      })
      )
  }

//Get times vars for the call
function RunForestRun(mp) {
  mp && mp.open();
  document.getElementById("loading").style.visibility = 'visible';
  HackTheMatrix(mp); // expand to include NonIncidentTypeIds, IncludeCompleted - params is global
}

//make the call to beacon
function HackTheMatrix(progressBar) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  BeaconClient.nitc.search(params, params.userId, token, start, end, function(nitcs) {
    let exports;

    if (document.getElementById("Activity").checked) {  // Activity list export
        exports = nitcs.Results.map(function(d){
            var rawSdate = new Date(d.StartDate);
            var rawEdate = new Date(d.EndDate);
            d.StartDateFixed = new Date(rawSdate.getTime() + ( rawSdate.getTimezoneOffset() * 60000 ));
            d.EndDateFixed = new Date(rawEdate.getTime() + ( rawEdate.getTimezoneOffset() * 60000 ));
            var tags = d.Tags.map(function(d){return d.Name}).join(",");
            var numParticipants = 0;
            var totalHours = 0;
            var participants = "";
            d.Participants.map(function(p) {
                numParticipants++;
                var hours = parseFloat((Math.abs(new Date(p.EndDate) - new Date(p.StartDate)) / 36e5).toFixed(2));
                totalHours += hours;
                participants +=  p.Person.FullName + "(" + hours.toString() + ") ";
            });
            var rObj = {};
            rObj["Name"] = d.Name;
            rObj["StartDate"] = d.StartDateFixed;
            rObj["EndDate"] = d.EndDateFixed;
            rObj["Unit"] = d.CreatedAt.Code;
            rObj["Tags"] = tags;
            rObj["TotalParticipants"] = numParticipants;
            rObj["TotalHours"] = totalHours;
            rObj["Participants"] = participants;

            return rObj
        });
    } else {    // Member list export
        exports = [];
        var listOfActivities = [];
        nitcs.Results.map(function(d) {
            var activities = d.Tags.map(function(t){return t.Name});
            d.Participants.map(function(p) {
                var i = 0;
                var name = p.Person.FullName;
                var hours = parseFloat((Math.abs(new Date(p.EndDate) - new Date(p.StartDate)) / 36e5).toFixed(2));
                if ((i = findInArr(exports, name)) == null) {
                    exports.push({Name: name});
                    i = exports.length - 1;
                }
                activities.forEach(function(a) {
                    if (typeof exports[i][a] === 'undefined') {
                        exports[i][a] = hours;
                    } else {
                        exports[i][a] += hours;
                    }
                    if (typeof listOfActivities[a] === 'undefined')
                        listOfActivities.push(a);       // Keep track of all the activities in this export
                });
            });
        });
        // Pad out the activities so we have the same number of columns for all members
        for (let i =0; i < exports.length; i++) {
            listOfActivities.forEach(function(a) {
                if (typeof exports[i][a] === 'undefined') {
                    exports[i][a] = 0;
                }
            });
        }
    }
    progressBar.setValue(1);
    progressBar.close();
    downloadCSV("LighthouseExport.csv", exports);

    progressBar.close();

  }, function(val,total){
    progressBar.setValue(val/total);
  });
}

function convertArrayOfObjectsToCSV(data) {
  var result, ctr, keys, columnDelimiter, lineDelimiter;

  if (data == null || !data.length) {
    return null;
  }

  columnDelimiter =  ',';
  lineDelimiter = '\n';

  keys = Object.keys(data[0]);

  result = '';
  result += keys.join(columnDelimiter);
  result += lineDelimiter;

  data.forEach(function(item) {
    ctr = 0;
    keys.forEach(function(key) {
      if (item[key] === null) {
        item[key] = ""
      }
      if (ctr > 0)
        result += columnDelimiter;
//      if (item[key] === undefined)
//        item[key] = 0;
      result += "\""+item[key]+"\"";
      ctr++;
    });
    result += lineDelimiter;
  });

  return result;
}


function downloadCSV(file,dataIn) {
  var csv = convertArrayOfObjectsToCSV(dataIn);
  if (csv == null)
    return;

  let filename = file;

  if (!csv.match(/^data:text\/csv/i)) {
    csv = 'data:text/csv;charset=utf-8,' + csv;
  }
  let data = encodeURI(csv);

  let link = document.createElement('a');
  link.setAttribute('href', data);
  link.setAttribute('download', filename);
  link.click();
}

function findInArr(arr,name) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i]['Name'] == name) {
            return i;
        }
    }
    return null;
}
