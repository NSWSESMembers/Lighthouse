function GetUnitNamefromBeacon(Id,host, callback) {
    console.log("GetUnitNamefromBeacon called with:" + Id+", "+host);

    console.log("telling the keep alive system we are still active")
    chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)});

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            results = JSON.parse(xhttp.responseText);

            if (typeof callback === "function") {
                console.log("GetUnitNamefromBeacon call back with:" + results.Name);

                callback(results.Name);

            }


        }
    }

    xhttp.open("GET", "https://"+host+"/Api/v1/Entities/" + params.hq, true);
    xhttp.send();
}

function GetTaskingfromBeacon(Id,host, callback) {
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
function GetJSONfromBeacon(Id, host, StartDate, EndDate, callback) {

    console.log("GetJSONfromBeacon called with:" + Id + "," + host+", "+StartDate + "," + EndDate);


    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            //console.log(xhttp.responseText);

            try {
                var teams = JSON.parse(xhttp.responseText);
            } catch (e) {
                document.getElementById("loading").innerHTML = "Error talking with beacon. Are you logged in?";
                throw new Error('Error talking with beacon. JSON result isnt valid');
            };

            // Make sure the callback is a function​
            if (typeof callback === "function") {
                console.log("GetJSONfromBeacon call back with: ");
                console.log(teams);

                callback(teams);

            }


        } else if (xhttp.readyState == 4 && xhttp.status !== 200) {
            throw new Error('Error talking with beacon. xhttp gave a  non 200 result. Are you logged in?');

        }


    }

    if (Id !== null || typeof unit == undefined) {

                if (Id.split(",").length == 1)
                {
                    xhttp.open("GET", "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&CreatedAtId=" + Id + "&PageIndex=1&PageSize=20000&SortField=CreatedOn&SortOrder=desc", true);
                } else {
                    var hqString = "";
                    Id.split(",").forEach(function(d){
                        hqString=hqString+"&CreatedAtId="+d
                    });
                    console.log(hqString)
                    xhttp.open("GET", "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + hqString + "&PageIndex=1&PageSize=20000&SortField=CreatedOn&SortOrder=desc", true);

                }
    } else {
        xhttp.open("GET", "https://"+host+"/Api/v1/Teams/Search?StatusStartDate=" + StartDate.toISOString() + "&StatusEndDate=" + EndDate.toISOString() + "&PageIndex=1&PageSize=20000&SortField=CreatedOn&SortOrder=desc", true);

    }
    xhttp.send();
};