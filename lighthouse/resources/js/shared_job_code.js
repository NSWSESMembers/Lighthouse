//make the call to beacon
function GetJSONfromBeacon(unit, host, StartDate, EndDate, callback, progressCallBack) {

  var url = "";
  console.log("GetJSONfromBeacon called with:" + StartDate + "," + EndDate + ", " + host);
  console.log("telling the keep alive system we are still active");
  chrome.runtime.sendMessage({
    activity: true
  }, function(response) {
    console.log(response)
  });

  if (unit !== null || typeof unit == undefined) {
    if (Array.isArray(unit) == false) {
      url = "https://" + host + "/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&Hq=" + unit.Id + "&ViewModelType=6&SortField=Id&SortOrder=desc";
    } else {
      var hqString = "";
      unit.forEach(function(d) {
        hqString = hqString + "&Hq=" + d.Id
      });
      console.log(hqString)
      url = "https://" + host + "/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString + "&ViewModelType=6&SortField=Id&SortOrder=desc";
    }
  } else {
      url = "https://" + host + "/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&ViewModelType=6&SortField=Id&SortOrder=desc";

  }

  var lastDisplayedVal = 0 ;
  goGetMeSomeJSONFromBeacon(
    url,
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
      console.log(obj)
      callback(obj);
    }
  );

}
