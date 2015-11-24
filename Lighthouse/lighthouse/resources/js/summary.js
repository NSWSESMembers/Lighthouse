var timeoverride = null;

window.onerror = function(message, url, lineNumber) {  
  document.getElementById("loading").innerHTML = "Error loading page<br>"+message+" Line "+lineNumber;
  return true;
}; 



//on DOM load
document.addEventListener('DOMContentLoaded', function() {

    //run every X period of time the main loop.
    startTimer(180);

    RunForestRun()

});


$(document).on('change', 'input[name=slide]:radio', function() {
    console.log(this.value);
    timeoverride = this.value;


    RunForestRun();
});



//refresh button
$(document).ready(function() {
document.getElementById("refresh").onclick = function() {
RunForestRun();
}
});


function myScript() {
    console.log("radio");
}

function getSearchParameters() {
    var prmstr = window.location.search.substr(1);
    return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = tmparr[1];
    }
    return params;
}

var timeperiod;
var unitname = "";


var params = getSearchParameters();

//update every X seconds
function startTimer(duration) {

var display = document.querySelector('#time');
    var timer = duration,
        minutes, seconds;
    setInterval(function() {
        minutes = parseInt(timer / 60, 10)
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.innerText = minutes + ":" + seconds;

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
        start.setDate(start.getDate() - (timeoverride / 24));


        starttime = start.toISOString();
        endtime = end.toISOString();

        console.log(starttime);
        console.log(endtime);

        params.start = starttime;
        params.end = endtime;

    }

    //IF TRAIN BEACON

    if (params.host == "trainbeacon.ses.nsw.gov.au")
    {
        document.body.style.backgroundColor = "green";
    }



    if (unitname == "") {

        console.log("firstrun...will fetch vars");

        

        if (typeof params.hq !== 'undefined') {

        if (params.hq.split(",").length == 1)
            {

            GetUnitNamefromBeacon(params.hq, params.host, function(returnedunitname) {
                unitname = returnedunitname;
                HackTheMatrix(params.hq, params.host, returnedunitname);
            });

            } else {
        console.log("passed array of units");
        unitname = "group selection";
        HackTheMatrix(params.hq, params.host, unitname);
    }

        } else { //no hq was sent, get them all
            unitname = "NSW";
            HackTheMatrix(null, params.host, unitname);
        }


    


    } else {
        console.log("rerun...will NOT fetch vars");
        if (typeof params.hq == 'undefined') {
            HackTheMatrix(null, unitname);
        } else {
            HackTheMatrix(params.hq, params.host, unitname);
        }

    }




}

//make the call to beacon
function HackTheMatrix(id,host, unit) {

    document.title = unitname + " Job Summary";


    var start = new Date(decodeURIComponent(params.start));
    var end = new Date(decodeURIComponent(params.end));

    GetJSONfromBeacon(id, host, start, end, function(jobs) {


        var facts = crossfilter(jobs.Results);
        var all = facts.groupAll();

        var JobStatus = facts.dimension(function(d) {
            return d.JobStatusType.Name;
        });

        var JobType = facts.dimension(function(d) {
            return d.JobType.ParentId;
        });

        var JobStatusGroup = JobStatus.group().reduceCount(function(d) {
            return d.JobStatusType.Name;
        });
        var JobTypeGroup = JobType.group().reduceCount(function(d) {
            return d.JobType.ParentId;
        });

        var completeJob = 0;
        var newJob = 0;
        var ackJob = 0;
        var refJob = 0;
        var finJob = 0;
        var canJob = 0;
        var rejJob = 0;
        var tskJob = 0;


        JobStatusGroup.top(Infinity).forEach(function(d) {
            console.log(d.key + " " + d.value);
            switch (d.key) {
                case "New":
                    newJob = d.value;
                    break;
                case "Acknowledged":
                    ackJob = d.value;
                    break;
                case "Tasked":
                    tskJob = d.value;
                    break;
                case "Complete":
                    completeJob = d.value;
                    break;
                case "Finalised":
                    finJob = d.value;
                    break;
                case "Referred":
                    refJob = d.value;
                    break;
                case "Rejected":
                    rejJob = d.value;
                    break;
                case "Cancelled":
                    canJob = d.value;
                    break;
            }

        });

        var storm = 0;
        var flood = 0;
        var rescue = 0;
        var support = 0;
        //Parent Types
        //Storm = 1
        //Support = 2
        //Flood Assistance  = 4
        //Rescue = 5

        JobTypeGroup.top(Infinity).forEach(function(d) {




            switch (d.key) {
                case 1:
                    storm = d.value;
                    break;
                case 2:
                    support = d.value;
                    break;
                case 4:
                    flood = d.value;
                    break;
                case 5:
                    rescue = d.value;
                    break;
            }

        });


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
        var open = jobs.Results.length - finJob - rejJob - canJob - refJob - completeJob;
        var closed = refJob + canJob + completeJob + finJob;

        document.getElementById("open").innerHTML = open;
        document.getElementById("closed").innerHTML = closed;
        document.getElementById("totalnumber").innerHTML = jobs.Results.length;

        //document.getElementById("total").innerHTML = "Total Job Count: " + (jobs.Results.length);

        document.getElementById("results").style.visibility = 'visible';

        var options = {
            weekday: "short",
            year: "numeric",
            month: "2-digit",
            day: "numeric",
            hour12: false
        };

        document.getElementById("banner").innerHTML = "<h2>Job summary for " + unit + "</h2><h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "</h4>";




    });
}