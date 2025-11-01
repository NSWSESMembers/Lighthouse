import $ from 'jquery';
import { getJsonPaginated } from './json.js';

export function search(unit, host, StartDate, EndDate, userId = 'notPassed', token, callback, progressCallBack, viewmodel) {

  if (typeof viewmodel === 'undefined') //if they dont specify a viewmodel to load, pull the big one down.
   {
    viewmodel = "6";
  }

  var url = "";
  console.log("Client.job.search() called with:" + StartDate + "," + EndDate + ", " + host);

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) == false) {
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&Hq=" + unit.Id + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function(d) {
        hqString = hqString + "&Hq=" + d.Id
      });
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    }
  } else {
    url = host + "/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";

  }

  var lastDisplayedVal = 0 ;
  getJsonPaginated(
    url, token, 0, 100,
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

export function summary(unit, host, StartDate, EndDate, userId = 'notPassed', token, callback, progressCallBack) {
    var url = "";
    console.log("Client.job.summary() called with:" + StartDate + "," + EndDate + ", " + host);

    if (unit !== null || typeof unit === 'undefined') {
        if (Array.isArray(unit) == false) {
            url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&EntityIds=" + unit.Id;
        } else {
            var hqString = "";
            unit.forEach(function (d) {
                hqString = hqString + "&EntityIds=" + d.Id;
            });
            console.log(hqString)
            url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString;
        }
    } else {
        url = host + "/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString();

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

export function get(id, viewModelType = 1, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Jobs/" + id + "?LighthouseFunction=GetJobfromBeacon&userId=" + userId + "&viewModelType="+viewModelType,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          callback(results);
        }
      }
    }
  })
}

export function getTasking(id, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Tasking/Search?LighthouseFunction=GetJobTaskingFromBeacon&userId=" + userId +"&JobIds%5B%5D=" + id,
    beforeSend: function (n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        callback(response.responseJSON);
      }
    }
  });
}

export function searchwithStatusFilter(unit, host, StartDate, EndDate, userId = 'notPassed', token, callback, progressCallBack, viewmodel, statusTypes = []) {

  if (typeof viewmodel === 'undefined') //if they dont specify a viewmodel to load, pull the big one down.
   {
    viewmodel = "6";
  }

  var url = "";
  console.log("Client.job.searchwithStatusFilter() called with:" + StartDate + "," + EndDate + ", " + host);

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) == false) {
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=searchwithStatusFilter&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&Hq=" + unit.Id + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function(d) {
        hqString = hqString + "&Hq=" + d.Id
      });
      var statusString = ""
      statusTypes.forEach(function(s) {
        statusString = statusString + "&JobStatusTypeIds=" + s
      })
      url = host + "/Api/v1/Jobs/Search?LighthouseFunction=searchwithStatusFilter&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString + statusString + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";
    }
  } else {
    url = host + "/Api/v1/Jobs/Search?LighthouseFunction=searchwithStatusFilter&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + statusString + "&ViewModelType="+viewmodel+"&SortField=Id&SortOrder=desc";

  }

  var lastDisplayedVal = 0 ;
  getJsonPaginated(
    url, token, 0, 100,
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