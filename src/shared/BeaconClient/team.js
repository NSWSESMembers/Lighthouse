import $ from 'jquery';
import { getJsonPaginated } from './json.js';

//limited to single page result
export function getTasking(id, host, userId = 'notPassed', token, callback) {
  console.log("GetTaskingfromBeacon called with:" + id + ", " + host);

    getJsonPaginated(
    host+"/Api/v1/Tasking/Search?LighthouseFunction=GetTaskingfromBeacon&ViewModelType=1&userId=" + userId + "&TeamIds=" + id, token, 0, 100,
    function(_res) {
      console.log("Progress CB");
    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetTaskingfromBeacon call back");
      var obj = {
        "Results": results
      };
      callback(obj);
    }
  );
}

//limited to single page result
export function getHistory(id, host, userId = 'notPassed', token, callback) {
  console.log("GetHistoryfromBeacon called with:" + id+", "+host);
    getJsonPaginated(
    host+"/Api/v1/Teams/"+id+"/History?LighthouseFunction=GetHistoryfromBeacon&userId=" + userId, token, 1, 20,
    function(_res) {
      console.log("Progress CB");
    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.log("GetHistoryfromBeacon call back");
      var obj = {
        "Results": results
      };
      callback(obj);
    }
  );

}

export function get(id, viewModelType = 1, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Teams/" + id + "?LighthouseFunction=GetTeamfromBeacon&userId=" + userId + "&viewModelType=" + viewModelType,
    beforeSend: function (n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          callback(results);
        }
      }
    }
  })
}


//make the call to beacon
export function teamSearch(unit, host, StartDate, EndDate, userId = 'notPassed', token, callback, progressCallBack, statusTypes = [], onPage) {
  console.debug("teamSearch called");
  let params = {};
  params['StatusStartDate'] = StartDate.toISOString();
  params['StatusEndDate'] = EndDate.toISOString();
  params['SortField'] = 'callsign';
  params['SortOrder'] = 'asc';
  params['StatusTypeId'] = statusTypes;
  params['IncludeDeleted'] = false;

  if (unit !== null || typeof unit === 'undefined') {
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

  var url = host+"/Api/v1/Teams/Search?LighthouseFunction=GetJSONTeamsfromBeacon&userId=" + userId + "&" + $.param(params, true);
  var lastDisplayedVal = 0 ;
  getJsonPaginated(
    url, token, 0, 50,
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
      console.debug("GetJSONfromBeacon call back");
      var obj = {
        "Results": results
      };
      callback(obj);
    }, function (pageResult) {
      if (typeof onPage === 'function') {
        onPage(pageResult);
      }
    }
  );

}

/**
 * Gets team positions as GeoJson based off the last tasking update.
 *
 * @param hqs the units to filter on.
 * @param startDate the date to limit the tasking search from.
 * @param endDate the date to limit the tasking search till.
  * @param userId the users id
 * @param token the authorisation token.
 * @param callback the callback to send the data to after it is fetched.
 */
export function getTeamGeoJson(hqs, host, startDate, endDate, userId = 'notPassed', token, callback) {
    console.debug('fetching SES teams geoJson');

    let lastDay = new Date();
    lastDay.setDate(lastDay.getDate() - 1);

    // Grab teams from the last year
    let teamStartRange = new Date();
    teamStartRange.setFullYear(teamStartRange.getFullYear() - 1);
    let teamEndRange = new Date();
    let statusTypes = [3]; // Only get activated teams

    teamSearch(hqs, host, teamStartRange, teamEndRange, userId, token, function (teams) {

        // Make a promise to collect all the team details in promises
        new Promise((mainResolve) => {
            let promises = [];

            teams.Results.forEach(function (team) {

                // Create a promise for this team to check its tasking and details
                promises.push(new Promise((resolve) => {
                    getTasking(team.Id, host, userId, token, function (teamTasking) {
                        let latestTasking = null;
                        let latestTime = null;

                        // Find the latest tasking
                        teamTasking.Results.forEach(function (task) {
                            let rawStatusTime = new Date(task.CurrentStatusTime);
                            let taskTime = new Date(rawStatusTime.getTime());

                            if (startDate != null && endDate != null) { //not null when viewing a date range, so all jobs are in play
                                if (taskTime < startDate || taskTime > endDate) {
                                    // Filter any tasking outside the start / end date range
                                    return;
                                }
                            } else { //viewing "current" which means finalised are hidden
                                if (task.Job.JobStatusType.Name == "Complete" || task.Job.JobStatusType.Name == "Finalised" || task.Job.JobStatusType.Name == "Cancelled" || task.Job.JobStatusType.Name == "Rejected") {
                                    return;
                                }
                            }

                            // it wasn't an un-task or a tasking (so its a action the team made like on route or onsite)
                            if (latestTime < taskTime && task.CurrentStatus !== "Tasked" && task.CurrentStatus !== "Untasked") {
                                latestTasking = task;
                                latestTime = taskTime;
                            }
                        });

                        // If valid tasking was found, add that into a geoJson feature
                        if (latestTasking !== null) {
                            let feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': [
                                        latestTasking.Job.Address.Longitude,
                                        latestTasking.Job.Address.Latitude
                                    ]
                                },
                                'properties': {
                                    'teamId': latestTasking.Team.Id,
                                    'teamCallsign': latestTasking.Team.Callsign,
                                    'onsite': latestTasking.Onsite,
                                    'offsite': latestTasking.Offsite,
                                    'currentStatusTime': latestTasking.CurrentStatusTime,
                                    'jobId': latestTasking.Job.Id,
                                }
                            };

                            if (latestTasking.PrimaryTaskType) {
                                feature.properties.primaryTask = latestTasking.PrimaryTaskType.Name;
                            }

                            resolve(feature);
                        }

                        // No relevant tasking for this team
                        resolve(null);
                    });
                }));
            });

            console.debug(`Found ${promises.length} teams to query tasking for`);
            mainResolve(promises);

        }).then((promises) => {

            // Wait for all the team tasking promises to complete
            Promise.all(promises).then(function (features) {

                let geoJson = {
                    'type': 'FeatureCollection',
                    'features': []
                };

                // Collect all non-null features
                features.forEach(function (feature) {
                    if (feature) {
                        geoJson.features.push(feature);
                    }
                });

                console.debug('Found ' + geoJson.features.length + ' teams');
                callback(geoJson);

            }, function (error) {
                callback(error);
            });
        });
    }, function(p) {console.log('teamSearch progress',p)}, statusTypes);
}
