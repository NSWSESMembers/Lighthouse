function GetUnitNamefromBeacon(Id, host, callback) {
  console.log("GetUnitNamefromBeacon called with:" + Id+", "+host);
  console.log("telling the keep alive system we are still active")
  chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)});

  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      results = JSON.parse(xhttp.responseText);
      if (typeof callback === "function") {
        console.log("GetUnitNamefromBeacon call back with:");
        console.log(results);//.Results);
        callback(results);
      }
    }
  }

  xhttp.open("GET", "https://"+host+"/Api/v1/Entities/" + Id, true);
  xhttp.send();

}
