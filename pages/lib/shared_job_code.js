var LighthouseJson = require('./shared_json_code.js');
var $ = require('jquery');

//make the call to beacon
function GetJSONfromBeacon(unit, host, StartDate, EndDate, token, callback, progressCallBack, viewmodel) {

  if (typeof viewmodel === 'undefined') //if they dont specify a viewmodel to load, pull the big one down.
   {
    viewmodel = "6";
  }

  var url = "";
  console.log("GetJSONfromBeacon called with:" + StartDate + "," + EndDate + ", " + host);

  if (unit !== null || typeof unit == undefined) {
    if (Array.isArray(unit) == false) {
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&Hq=" + unit.Id + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function(d) {
        hqString = hqString + "&Hq=" + d.Id
      });
      console.log(hqString)
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    }
  } else {
    url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";

  }

  var lastDisplayedVal = 0 ;
  LighthouseJson.get_json(
    url, token,
    function(count,total){
      if (count > lastDisplayedVal) { //buffer the output to that the progress alway moves forwards (sync loads suck)
        lastDisplayedVal = count;
        progressCallBack(count,total);
      }
      if (count == -1 && total == -1) { //allow errors
        progressCallBack(count,total);
      }

    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetJSONfromBeacon call back with: ");
      var obj = {
        "Results": results
      }
      callback(obj);
    }
    );

}

function GetSummaryJSONfromBeacon(unit, host, StartDate, EndDate, token, callback, progressCallBack) {
    var url = "";
    console.log("GetSummaryJSONfromBeacon called with:" + StartDate + "," + EndDate + ", " + host);

    if (unit !== null || typeof unit == undefined) {
        if (Array.isArray(unit) == false) {
            url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&EntityIds=" + unit.Id;
        } else {
            var hqString = "";
            unit.forEach(function (d) {
                hqString = hqString + "&EntityIds=" + d.Id;
            });
            console.log(hqString)
            url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString;
        }
    } else {
        url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString();

    }

    $.ajax({
        type: 'GET',
        url: url,
        beforeSend: function (n) {
            n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function (response, textStatus) {
            if (textStatus == 'success') {
                callback(response.responseJSON);
            } else {
                console.log("Sending back a fail");
                typeof progressCallBack === 'function' && progressCallBack(-1, -1);
            }
        }
    });
}

module.exports = {
  get_json: GetJSONfromBeacon,
  get_summary_json: GetSummaryJSONfromBeacon
}
