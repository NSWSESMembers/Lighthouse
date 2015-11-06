//update every X seconds
function startTimer(duration, display) {
    var timer = duration, minutes, seconds;
    setInterval(function () {
        minutes = parseInt(timer / 60, 10)
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) { //when the timer is 0 run the code
            timer = duration;
            RunForestRun();
        }
    }, 1000);
}

//because
document.addEventListener('DOMContentLoaded', function() {

        //run every X period of time the main loop.
        display = document.querySelector('#time');
        startTimer(120, display);
        
    RunForestRun()
});

//Get times vars for the call
function RunForestRun() {


    var id;
    var timeperiod;
    var unitname;
    chrome.storage.sync.get({
        unitid: '199',
        time: 'today',
        unitname: 'Parramatta'
    }, function(items) {
        id = items.unitid;
        unitname = items.unitname;
        timeperiod = items.time;


        HackTheMatrix(id, timeperiod,unitname);
    });

}

//make the call to beacon
function HackTheMatrix(id, timeperiod, unit) {

    var starttime;
    var endtime;

    switch (timeperiod) {

        case "today":

            var end = new Date();

            var start = new Date();
            start.setHours(0, 0, 0, 0);


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            break;

        case "24hrs":

            var end = new Date();

            var start = new Date();
            start.setDate(start.getDate() - 1);


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            break;

        case "3d":

            var end = new Date();

            var start = new Date();
            start.setDate(start.getDate() - 3);


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            break;

        case "7d":

            var end = new Date();

            var start = new Date();
            start.setDate(start.getDate() - 7);


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            break;

        case "30d":

            var end = new Date();

            var start = new Date();
            start.setDate(start.getDate() - 30);


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            break;

    }




    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            var jobs = CSVToArray(xhttp.responseText);

            //assume theres a problem because this isnt the cvs we are looking for
            if (jobs[0][0] !== "Region") {
                document.getElementById("status").innerHTML = "Error talking with beacon. Are you logged in? do you have report permissions?";
                throw new Error('Error talking with beacon. cvs file isnt right');
            };



            //walk the csv and count the jobs

            console.log(jobs)

            var completeJob = 0;
            var newJob = 0;
            var ackJob = 0;
            var refJob = 0;
            var finJob = 0;
            var canJob = 0;
            var rejJob = 0;
            var tskJob = 0;

            var storm = 0;
            var flood = 0;
            var rescue = 0;
            var support = 0;

            jobs.forEach(function(entry) {
                console.log(entry[12]);

                switch (entry[12]) {
                    case "Complete":
                        completeJob = completeJob + 1;
                        break;
                    case "New":
                        newJob = newJob + 1;
                        break;
                    case "Acknowledged":
                        ackJob = ackJob + 1;
                        break;
                    case "Referred":
                        refJob = refJob + 1;
                        break;
                    case "Finalised":
                        finJob = finJob + 1;
                        break;
                    case "Cancelled":
                        canJob = canJob + 1;
                        break;
                    case "Rejected":
                        rejJob = rejJob + 1;
                        break;
                    case "Tasked":
                        tskJob = tskJob + 1;
                        break;
                }

                switch (entry[3]) {
                    case "Support":
                        support = support +1;
                        break;
                    case "Storm":
                        storm = storm +1;
                        break;
                    case "Rescue":
                        rescue = rescue +1;
                        break;
                    case "RCR":
                        rescue = rescue +1;
                        break;
                    case "Flood":
                        flood = flood +1;
                        break;
                    case "Flood Misc":
                        flood = flood +1;
                        break;                
                }


            });

            console.log(completeJob);

            document.getElementById("status").style.visibility = 'hidden';



            document.getElementById("new").innerHTML = newJob;
            document.getElementById("ack").innerHTML = ackJob;
            document.getElementById("comp").innerHTML = completeJob;
            document.getElementById("ref").innerHTML = refJob;
            document.getElementById("can").innerHTML = canJob;
            document.getElementById("rej").innerHTML = rejJob;
            document.getElementById("tsk").innerHTML = tskJob;
            document.getElementById("fin").innerHTML = finJob;

            document.getElementById("support").innerHTML = support;
            document.getElementById("flood").innerHTML = flood;
            document.getElementById("rescue").innerHTML = rescue;
            document.getElementById("storm").innerHTML = storm;

            document.getElementById("total").innerHTML = "Total Job Count: "+(newJob+ackJob+completeJob+refJob+canJob+finJob+tskJob);

            document.getElementById("results").style.visibility = 'visible';

            var s = new Date(starttime);
            var e = new Date(endtime);

            var options = {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric"
            };

            document.getElementById("banner").innerHTML = "<h2>Job summary for " + unit + "</h2><h4>" + s.toLocaleTimeString("en-au", options) + " to " + e.toLocaleTimeString("en-au", options) + "</h4>";

        }
    }
    console.log(id)
    xhttp.open("POST", "https://beacon.ses.nsw.gov.au/Reports/DetailedJobListing", true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send("{\"StartDate\":\"" + starttime + "\",\"EndDate\":\"" + endtime + "\",\"ReportId\":9,\"EventId\":null,\"EntityIds\":[" + id + "],\"EquipmentLeftOnly\":false}");


};




// ref: http://stackoverflow.com/a/1293163/2343
// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
function CSVToArray(strData, strDelimiter) {
    // Check to see if the delimiter is defined. If not,
    // then default to comma.
    strDelimiter = (strDelimiter || ",");

    // Create a regular expression to parse the CSV values.
    var objPattern = new RegExp(
        (
            // Delimiters.
            "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

            // Standard fields.
            "([^\"\\" + strDelimiter + "\\r\\n]*))"
        ),
        "gi"
    );


    // Create an array to hold our data. Give the array
    // a default empty first row.
    var arrData = [
        []
    ];

    // Create an array to hold our individual pattern
    // matching groups.
    var arrMatches = null;


    // Keep looping over the regular expression matches
    // until we can no longer find a match.
    while (arrMatches = objPattern.exec(strData)) {

        // Get the delimiter that was found.
        var strMatchedDelimiter = arrMatches[1];

        // Check to see if the given delimiter has a length
        // (is not the start of string) and if it matches
        // field delimiter. If id does not, then we know
        // that this delimiter is a row delimiter.
        if (
            strMatchedDelimiter.length &&
            strMatchedDelimiter !== strDelimiter
        ) {

            // Since we have reached a new row of data,
            // add an empty row to our data array.
            arrData.push([]);

        }

        var strMatchedValue;

        // Now that we have our delimiter out of the way,
        // let's check to see which kind of value we
        // captured (quoted or unquoted).
        if (arrMatches[2]) {

            // We found a quoted value. When we capture
            // this value, unescape any double quotes.
            strMatchedValue = arrMatches[2].replace(
                new RegExp("\"\"", "g"),
                "\""
            );

        } else {

            // We found a non-quoted value.
            strMatchedValue = arrMatches[3];

        }


        // Now that we have our value string, let's add
        // it to the data array.
        arrData[arrData.length - 1].push(strMatchedValue);
    }

    // Return the parsed data.
    return (arrData);
}