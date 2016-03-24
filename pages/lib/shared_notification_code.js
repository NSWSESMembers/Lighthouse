//make the call to beacon
function GetNotificationJSONfromBeacon(Id, host, StartDate, EndDate, callback) {
  var limit = 20000;
  console.log("GetNotificationJSONfromBeacon called with:" + Id + "," + StartDate + "," + EndDate+", "+host);

  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      //console.log(xhttp.responseText);
      try {
        var messages = JSON.parse(xhttp.responseText);
        messages.Results.length == limit && alert("That was a big request! the maximum number of notifications you can return is "+limit+". try selecting a smaller time period");
      } catch (e) {
        throw new Error('Error talking with beacon. JSON result isnt valid');
      };
      // Make sure the callback is a function​
      if (typeof callback === "function") {
        console.log("GetNotificationJSONfromBeacon call back with: ");
        console.log(messages);
        callback(messages);
      }
    } else if (xhttp.readyState == 4 && xhttp.status !== 200) {
      throw new Error('Error talking with beacon. xhttp gave a  non 200 result. Are you logged in?');
    }
  }

  if (Id !== null || typeof unit == undefined) {
    if (Id.split(",").length == 1) {
      xhttp.open("GET", "https://"+host+"/Api/v1/Notifications/Search?CreatedStartDate=" + StartDate.toISOString() + "&CreatedEndDate=" + EndDate.toISOString() + "&Hq=" + Id + "&PageIndex=1&PageSize="+limit+"&SortField=CreatedOn&SortOrder=desc", true);
    } else {
      var hqString = "";
      Id.split(",").forEach(function(d){
        hqString=hqString+"&Hq="+d
      });
      console.log(hqString)
      xhttp.open("GET", "https://"+host+"/Api/v1/Notifications/Search?CreatedStartDate=" + StartDate.toISOString() + "&CreatedEndDate=" + EndDate.toISOString() + hqString + "&PageIndex=1&PageSize="+limit+"&SortField=CreatedOn&SortOrder=desc", true);

    }
  } else {
    xhttp.open("GET", "https://"+host+"/Api/v1/Notifications/Search?CreatedStartDate=" + StartDate.toISOString() + "&CreatedEndDate=" + EndDate.toISOString() + "&PageIndex=1&PageSize="+limit+"&SortField=CreatedOn&SortOrder=desc", true);
  }
  xhttp.send();
}
