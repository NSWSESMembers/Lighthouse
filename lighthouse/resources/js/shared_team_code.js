function GetTaskingfromBeacon(Id, host, callback) {
    console.log("GetTaskingfromBeacon called with:" + Id+", "+host);

    console.log("telling the keep alive system we are still active")
    chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)});   

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            results = JSON.parse(xhttp.responseText);

            if (typeof callback === "function") {
                console.log("GetTaskingfromBeacon call back with:");
                console.log(results);
                callback(results);

            }


        }
    }

    xhttp.open("GET", "https://"+host+"/Api/v1/Tasking/Search?TeamIds=" + Id, true);
    xhttp.send();
}

//make the call to beacon
function GetJSONTeamsfromBeacon(unit, host, StartDate, EndDate, callback) {

    console.log("GetJSONTeamsfromBeacon called with:" + unit + "," + host+", "+StartDate + "," + EndDate);

    var url = ""
    

    if (unit !== null || typeof unit == undefined) {

                if (Array.isArray(unit) == false)
                {
                    url = "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&AssignedToId=" + unit.Id + "&CreatedAtId=" + unit.Id + "&SortField=CreatedOn&SortOrder=desc";
                } else {
                    var hqString = "";
                    unit.forEach(function(d){
                        hqString=hqString+"&AssignedToId="+d.Id+"&CreatedAtId="+d.Id
                    });
                    console.log(hqString)
                    url =  "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + hqString + "&SortField=CreatedOn&SortOrder=desc";

                }
    } else {
        url = "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&SortField=CreatedOn&SortOrder=desc";

    }
    
    goGetMeSomeJSONFromBeacon(url, function(results) { //call for the JSON, rebuild the array and return it when done.

        console.log("GetJSONfromBeacon call back with: ");
        var obj = {
            "Results": results
        }
        console.log(obj)
        callback(obj);

    })


};