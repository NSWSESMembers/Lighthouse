import { getJsonPaginated } from './json.js';


export function search(params, userId = 'notPassed', token, StartDate, EndDate, callback, progressCallBack) {

    var url = params.host + "/Api/v1/NonIncident/Search?LighthouseFunction=GetNITCJSONfromBeacon&userId=" + userId + "&StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString();
    var s = "";
    if (typeof params.EntityIds !== "undefined") {
        params.EntityIds.split(",").forEach(function(d){
            s += "&EntityIds%5B%5D=" + d;
        });
        url += s;
    }
    if (typeof params.NonIncidentTypeIds !== "undefined") {
        params.NonIncidentTypeIds.split(",").forEach(function(d){
            s += "&NonIncidentTypeIds%5B%5D=" + d;
        });
        url += s;
    }
    if (typeof params.TagIds !== "undefined") {
        params.TagIds.split(",").forEach(function(d){
            s += "&TagIds%5B%5D=" + d;
        });
        url += s;
    }
    if (typeof params.IncludeCompleted !== "undefined") {
        url += "&IncludeCompleted=" + params.IncludeCompleted;
    }
    url += "&ViewModelType=6&SortField=Start&SortOrder=desc";

    console.log("GetJSONfromBeacon calling " + url);


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
