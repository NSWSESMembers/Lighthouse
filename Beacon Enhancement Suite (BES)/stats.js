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


function drawmelikeoneofyourfrenchgirls(jobs) {

var timeChart = dc.barChart("#dc-time-chart");
var islandChart = dc.pieChart("#dc-island-chart");
var localChart = dc.pieChart("#dc-local-chart");
var prioritiesChart = dc.pieChart("#dc-priority-chart");


jobs.Results.forEach(function(d) {
var rawdate = new Date(d.JobReceived);
rawdate = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
d.JobReceived = rawdate
});

var facts = crossfilter(jobs.Results);

var all = facts.groupAll();



// time chart
  var JobStatus = facts.dimension(function(d) {
    return d.JobStatusType.Name;
  });

var JobStatusGroup = JobStatus.group()
    .reduceCount(function(d) { return d.JobStatusType.Name; });




// time chart
  var volumeByHour = facts.dimension(function(d) {
    return d3.time.hour(d.JobReceived);
  });


  var volumeByHourGroup = volumeByHour.group()
    .reduceCount(function(d) { return d.JobReceived; });



 // Pie Chart
  var islands = facts.dimension(function (d) {
    return d.Type
    });
  var islandsGroup = islands.group();


 // Pie Chart
  var locals = facts.dimension(function (d) {
    return d.Address.Locality
    });
  var localGroup = locals.group();

// Pie Chart
  var prio = facts.dimension(function (d) {
    return d.JobPriorityType.Name
    });
  var prioGroup = prio.group();




// time graph
  timeChart.width(1000)
    .height(150)
    .transitionDuration(500)
//    .mouseZoomable(true)
    .margins({top: 10, right: 10, bottom: 20, left: 40})
    .dimension(volumeByHour)
    .group(volumeByHourGroup)
//    .brushOn(false)           // added for title
    .xUnits(d3.time.hours)
    .elasticY(true)

    .x(d3.time.scale().domain(d3.extent(jobs.Results, function(d) { return d.JobReceived; })))
    .xAxis();

// // time graph
//   timeChart.width(1000)
//     .height(150)
//     .transitionDuration(500)
// //    .mouseZoomable(true)
//     .margins({top: 10, right: 10, bottom: 20, left: 40})
//     .dimension(volumeByHour)
//     .group(volumeByHourGroup)
// //    .brushOn(false)           // added for title
//     .xUnits(d3.time.hours)
//     .dotRadius(10)
//     .elasticY(true)

//     .x(d3.time.scale().domain(d3.extent(jobs.Results, function(d) { return d.JobReceived; })))
//     .xAxis();



// islands pie chart
  islandChart.width(350)
    .height(220)
    .radius(100)
    .innerRadius(20)
    .dimension(islands)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(islandsGroup);

    // islands pie chart
  localChart.width(450)
    .height(220)
    .radius(100)
    .innerRadius(20)
    .dimension(locals)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(localGroup);


    // islands pie chart
  prioritiesChart.width(350)
    .height(220)
    .radius(100)
    .innerRadius(20)
    .dimension(prio)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(prioGroup);
dc.renderAll();    






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


GetUnitNamefromBeacon(params.hq, function(returnedunitname) {
    unitname = returnedunitname;
    HackTheMatrix(params.hq, returnedunitname);
});

} else { //no hq was sent, get them all
    unitname = "NSW";
   HackTheMatrix(null, unitname); 
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

    GetJSONfromBeacon(id,start,end, function(jobs) {


    drawmelikeoneofyourfrenchgirls(jobs);

            console.log(jobs)

            

            document.getElementById("loading").style.visibility = 'hidden';


            document.getElementById("results").style.visibility = 'visible';

            var options = {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric"
            };

            document.getElementById("banner").innerHTML = "<h2>Job statistics for " + unit + "</h2><h4>" + start.toLocaleTimeString("en-au", options) + " to " + end.toLocaleTimeString("en-au", options) + "</h4>";




    });
}