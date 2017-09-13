const $ = require('jquery');
const LighthouseJson = require('./shared_json_code.js');

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
      };
      callback(obj);
    }
  );

}

//make the call to beacon
function GetJSONTeamsfromBeacon(unit, host, StartDate, EndDate, token, callback, statusTypes = []) {
  console.debug("GetJSONTeamsfromBeacon called with:" + unit + "," + host+", "+StartDate + "," + EndDate);
  let params = {};
  params['StatusStartDate'] = StartDate.toISOString();
  params['StatusEndDate'] = EndDate.toISOString();
  params['SortField'] = 'CreatedOn';
  params['SortOrder'] = 'desc';
  params['StatusTypeId'] = statusTypes;

  if (unit !== null || typeof unit == undefined) {
    if (Array.isArray(unit) == false) {
      params['AssignedToId'] = unit.Id;
      params['CreatedAtId'] = unit.Id;
    } else {
      let assignedToId = [];
      let createdAtId = [];

      unit.forEach(function(d){
        assignedToId.push(d.Id);
        createdAtId.push(d.Id);
      });

      params['AssignedToId'] = assignedToId;
      params['CreatedAtId'] = createdAtId;
    }
  }

  var url = host+"/Api/v1/Teams/Search?" + $.param(params, true);
    
  LighthouseJson.get_json(
    url, token,
    function(res){
      console.debug("Progress CB");
    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.debug("GetJSONfromBeacon call back");
      var obj = {
        "Results": results
      };
      callback(obj);
    }
  );

}

module.exports = {
  get_tasking: GetTaskingfromBeacon,
  get_teams: GetJSONTeamsfromBeacon
};

