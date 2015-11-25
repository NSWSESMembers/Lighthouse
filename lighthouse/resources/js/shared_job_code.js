function GetUnitNamefromBeacon(Id, host, callback) {
    console.log("GetUnitNamefromBeacon called with:" + Id+", "+host);


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


//make the call to beacon
function GetJSONfromBeacon(Id, host, StartDate, EndDate, callback) {

    var limit = 5000;

    console.log("GetJSONfromBeacon called with:" + Id + "," + StartDate + "," + EndDate+", "+host);


    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            //console.log(xhttp.responseText);

            try {
                var jobs = JSON.parse(xhttp.responseText);
                jobs.Results.length == limit && alert("That was a big request! the maximum number of jobs you can return is "+limit+". try selecting a smaller time period");
            } catch (e) {
                document.getElementById("loading").innerHTML = "Error talking with beacon. Are you logged in?";
                throw new Error('Error talking with beacon. JSON result isnt valid');
            };

            // Make sure the callback is a function​
            if (typeof callback === "function") {
                console.log("GetJSONfromBeacon call back with: ");
                console.log(jobs);

                callback(jobs);

            }


        } else if (xhttp.readyState == 4 && xhttp.status !== 200) {
            throw new Error('Error talking with beacon. xhttp gave a  non 200 result. Are you logged in?');

        }


    }

    if (Id !== null || typeof unit == undefined) {

                if (Id.split(",").length == 1)
                {
                    xhttp.open("GET", "https://"+host+"/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&Hq=" + Id + "&ViewModelType=6&PageIndex=1&PageSize="+limit+"&SortField=Id&SortOrder=desc", true);
                } else {
                    var hqString = "";
                    Id.split(",").forEach(function(d){
                        hqString=hqString+"&Hq="+d
                    });
                    console.log(hqString)
                    xhttp.open("GET", "https://"+host+"/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + hqString + "&ViewModelType=6&PageIndex=1&PageSize="+limit+"&SortField=Id&SortOrder=desc", true);

                }
    } else {
        xhttp.open("GET", "https://"+host+"/Api/v1/Jobs/Search?StartDate=" + StartDate.toISOString() + "&EndDate=" + EndDate.toISOString() + "&ViewModelType=6&PageIndex=1&PageSize="+limit+"&SortField=Id&SortOrder=desc", true);

    }
    xhttp.send();
};