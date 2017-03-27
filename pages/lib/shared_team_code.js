var LighthouseJson = require('./shared_json_code.js');

function GetTaskingfromBeacon(Id, host, token, callback) {
  console.log("GetTaskingfromBeacon called with:" + Id+", "+host);

    LighthouseJson.get_json(
    host+"/Api/v1/Tasking/Search?TeamIds=" + Id, token,
    function(res){
      console.log("Progress CB");
    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetJSONfromBeacon call back");
      var obj = {
        "Results": results
      }
      callback(obj);
    }
  );

}

//make the call to beacon
function GetJSONTeamsfromBeacon(unit, host, StartDate, EndDate, token, callback) {
  console.log("GetJSONTeamsfromBeacon called with:" + unit + "," + host+", "+StartDate + "," + EndDate);
  var url = "";

  if (unit !== null || typeof unit == undefined) {
    if (Array.isArray(unit) == false) {
      url = host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&AssignedToId=" + unit.Id + "&CreatedAtId=" + unit.Id + "&SortField=CreatedOn&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function(d){
        hqString=hqString+"&AssignedToId="+d.Id+"&CreatedAtId="+d.Id
      });
      console.log(hqString)
      url =  host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + hqString + "&SortField=CreatedOn&SortOrder=desc";
    }
  } else {
    url = host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&SortField=CreatedOn&SortOrder=desc";
  }
    
  LighthouseJson.get_json(
    url, token,
    function(res){
      console.log("Progress CB");
    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetJSONfromBeacon call back");
      var obj = {
        "Results": results
      }
      callback(obj);
    }
  );

}

module.exports = {
  get_tasking: GetTaskingfromBeacon,
  get_teams: GetJSONTeamsfromBeacon
}

