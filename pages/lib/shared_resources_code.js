function GetResourcesfromBeacon(Id, host, callback) {
  console.log("GetResourcesfromBeacon called with:" + Id+", "+host);
  console.log("telling the keep alive system we are still active")
  chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)});

  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      results = JSON.parse(xhttp.responseText);
      if (typeof callback === "function") {
        console.log("GetResourcesfromBeacon call back with:");
        console.log(results);//.Results);
        callback(results);
      }
    }
  }

  xhttp.open("GET", "https://"+host+"/Api/v1/Resources/Search?EntityId="+Id+"&AssignedToId="+Id+"&PageIndex=1", true);
  xhttp.send();
}

module.exports = {
  get_unit_resouces: GetResourcesfromBeacon
}
