import { getJsonPaginated } from './json.js';
import $ from 'jquery';


export function search(unit, host, userId = 'notPassed', token, callback, progressCallBack) {


  var url = "";

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) == false) {
      url = host + "/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + "&Statusids=1&EntityIds=" + unit.Id + "&SortField=Id&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function (d) {
        hqString = hqString + "&EntityIds=" + d
      });
      url = host + "/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + hqString + "&Statusids=1&SortField=Id&SortOrder=desc";
    }
  } else {
    url = host + "/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=" + userId + "&Statusids=1&SortField=Id&SortOrder=desc";

  }

  var lastDisplayedVal = 0;
  getJsonPaginated(
    url, token, 0, 100,
    function (count, total) {
      if (count > lastDisplayedVal) { //buffer the output to that the progress alway moves forwards (sync loads suck)
        lastDisplayedVal = count;
        progressCallBack(count, total);
      }
      if (count == -1 && total == -1) { //allow errors
        progressCallBack(count, total);
      }

    },
    function (results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetJSONfromBeacon call back with: ");
      var obj = {
        "Results": results
      }
      callback(obj);
    }
  );
}


export function setSector(jobId, sectorId, host, userId, token, callback) {
  $.ajax({
    type: 'PUT',
    url: host + '/Api/v1/Sectors/' + sectorId + '/Jobs?LighthouseFunction=SetSectorForJob',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: JSON.stringify({ IdsToAdd: [jobId], userId: userId }),
    cache: false,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        callback(true)
        }
    },
  });
}

export function unSetSector(jobId, host, userId, token, callback) {
  $.ajax({
    type: 'PUT',
    url: host + '/Api/v1/Sectors/RemoveJobFromSector/' + jobId + '?LighthouseFunction=unSetSectorForJob',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: JSON.stringify({ userId: userId }),
    cache: false,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        callback(true)
        }
    },
  });
}