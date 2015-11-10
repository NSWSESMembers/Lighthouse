var timeoverride = null;



//on DOM load
document.addEventListener('DOMContentLoaded', function() {

        //run every X period of time the main loop.
        display = document.querySelector('#time');
        startTimer(180, display);

    RunForestRun()



});


$(document).on('change', 'input[type=radio][name=slide]', function () {
        console.log(this.value);
            timeoverride = this.value;

            
            RunForestRun();
    });


function myScript() {
    console.log("radio");
}

function getSearchParameters() {
      var prmstr = window.location.search.substr(1);
      return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray( prmstr ) {
    var params = {};
    var prmarr = prmstr.split("&");
    for ( var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = tmparr[1];
    }
    return params;
}

var timeperiod;
var unitname = "";


var params = getSearchParameters();

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



//Get times vars for the call
function RunForestRun() {

if (timeoverride !== null) { //we are using a time override

var end = new Date();

            var start = new Date();
            start.setDate(start.getDate() - (timeoverride/24));


            starttime = start.toISOString();
            endtime = end.toISOString();

            console.log(starttime);
            console.log(endtime);

            params.start = starttime;
            params.end = endtime;

}


    if (unitname == "") {

console.log("firstrun...will fetch vars");



if (typeof params.hq !== 'undefined') {


var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
        results = JSON.parse(xhttp.responseText);
        unitname = results.Name;
        HackTheMatrix(params.hq,unitname);
    }
  }
  
  xhttp.open("GET", "https://beacon.ses.nsw.gov.au/Api/v1/Entities/"+params.hq, true);
  xhttp.send();

} else { //no hq was sent, get them all
   HackTheMatrix(params.hq, unitname); 
}

} else {
console.log("rerun...will NOT fetch vars");

HackTheMatrix(params.hq, unitname);

}
    
    

}

//make the call to beacon
function HackTheMatrix(id, unit) {

   document.title = unitname+ " Job Summary";


    var start = new Date(decodeURIComponent(params.start));
    var end = new Date(decodeURIComponent(params.end));

console.log(start);
            console.log(end);

    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            //console.log(xhttp.responseText);

            try {
                var jobs = JSON.parse(xhttp.responseText);
            } catch (e) {
                document.getElementById("loading").innerHTML = "Error talking with beacon. Are you logged in?";
                throw new Error('Error talking with beacon. JSON result isnt valid');
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

            var dates = [];

            for (entry in jobs.Results) {
                console.log(jobs.Results[entry].JobStatusType.Name);
                console.log(jobs.Results[entry].Type);


                var rawdate = new Date(jobs.Results[entry].JobReceived);
                rawdate = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));

                dates.push(js_yyyy_mm_dd_hh_mm_ss(rawdate));
                console.log(js_yyyy_mm_dd_hh_mm_ss(rawdate));
                //job status ids
                //1 = new
                //2 = ack
                //3 = reject
                //4 = tasked
                //5 = ref
                //6 = comp
                //7 = can
                //8 = fin


                switch (jobs.Results[entry].JobStatusType.Id) {

                    case 1:
                        newJob = newJob + 1;
                        break;
                    case 2:
                        ackJob = ackJob + 1;
                        break;
                    case 3:
                        rejJob = rejJob + 1;
                        break;
                    case 4:
                        tskJob = tskJob + 1;
                        break;
                    case 5:
                        refJob = refJob + 1;
                        break;
                    case 6:
                        completeJob = completeJob + 1;
                        break;
                    case 7:
                        canJob = canJob + 1;
                        break;
                    case 8:
                        finJob = finJob + 1;
                        break;
                }


                //Parent Types
                //Storm = 1
                //Support = 2
                //Flood Assistance  = 4
                //Rescue = 5


console.log(jobs.Results[entry].JobType.ParentId);
                switch (jobs.Results[entry].JobType.ParentId) {
                    case 2:
                        support = support +1;
                        break;
                    case 1:
                        storm = storm +1;
                        break;
                    case 5:
                        rescue = rescue +1;
                        break;               
                    case 4:
                        flood = flood +1;
                        break;             
                }


            }



console.log(dates);






            

            document.getElementById("loading").style.visibility = 'hidden';



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

            var options = {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric"
            };

            document.getElementById("banner").innerHTML = "<h2>Job summary for " + unit + "</h2><h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "</h4>";

        } else if (xhttp.readyState == 4 && xhttp.status !== 200) {
            document.getElementById("loading").innerHTML = "Error talking with beacon. Are you logged in?";
                throw new Error('Error talking with beacon. xhttp gave non 200 result');

        }


    }
    if (typeof id !== 'undefined') {

    //console.log(id)
    xhttp.open("GET","https://beacon.ses.nsw.gov.au/Api/v1/Jobs/Search?Q=&StartDate="+start.toISOString()+"&EndDate="+end.toISOString()+"&Hq="+id+"&ViewModelType=2&PageIndex=1&PageSize=1000&SortField=Id&SortOrder=desc", true);

    } else {
            unit = "State wide";
            xhttp.open("GET","https://beacon.ses.nsw.gov.au/Api/v1/Jobs/Search?Q=&StartDate="+start.toISOString()+"&EndDate="+end.toISOString()+"&ViewModelType=2&PageIndex=1&PageSize=1000&SortField=Id&SortOrder=desc", true);

    } 
    xhttp.send();
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


function js_yyyy_mm_dd_hh_mm_ss (input) {
  now = new Date(input);
  year = "" + now.getFullYear();
  month = "" + (now.getMonth() + 1); if (month.length == 1) { month = "0" + month; }
  day = "" + now.getDate(); if (day.length == 1) { day = "0" + day; }
  hour = "" + now.getHours(); if (hour.length == 1) { hour = "0" + hour; }
  minute = "" + now.getMinutes(); if (minute.length == 1) { minute = "0" + minute; }
  second = "" + now.getSeconds(); if (second.length == 1) { second = "0" + second; }
  return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
}