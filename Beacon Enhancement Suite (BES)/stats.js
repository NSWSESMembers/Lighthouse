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
var jobtypeChart = dc.pieChart("#dc-jobtype-chart");
var localChart = dc.pieChart("#dc-local-chart");
var prioritiesChart = dc.pieChart("#dc-priority-chart");
var treejobtagsChart = dc.pieChart("#dc-treetags-chart");
var hazardtagsChart = dc.pieChart("#dc-hazardtags-chart");
var propertytagsChart = dc.pieChart("#dc-propertytags-chart");




jobs.Results.forEach(function(d) {
var rawdate = new Date(d.JobReceived);
rawdate = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
d.JobReceived = rawdate;
// d.CleanTags= [];
// d.Tags.forEach(function(d2) {
//     console.log(d2.Name);
// d.CleanTags.push(d2.Name);
// });

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

// time graph
  timeChart.width(1000)
    .height(250)
    .transitionDuration(500)
    .brushOn(false)
//    .mouseZoomable(true)
    .margins({top: 10, right: 10, bottom: 20, left: 40})
    .dimension(volumeByHour)
    .group(volumeByHourGroup)
//    .brushOn(false)           // added for title
    .xUnits(d3.time.hours)
    .elasticY(true)
    .x(d3.time.scale().domain(d3.extent(jobs.Results, function(d) { return d.JobReceived; })))
    .xAxis();



 // jobtype Pie Chart
  var jobtype = facts.dimension(function (d) {
    return d.Type
    });
  var jobtypeGroup = jobtype.group();

// jobtype pie chart
  jobtypeChart.width(350)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(jobtype)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(jobtypeGroup);



 // Pie Chart
  var locals = facts.dimension(function (d) {
    return d.Address.Locality
    });
  var localGroup = locals.group();



    // localities pie chart
  localChart.width(450)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(locals)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(localGroup);


// Pie Chart
  var prio = facts.dimension(function (d) {
    return d.JobPriorityType.Name
    });
  var prioGroup = prio.group();


    // priorities pie chart
  prioritiesChart.width(350)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(prio)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(prioGroup);



// time chart
  var tags = facts.dimension(function(d) {
    console.log(d.Tags);
    return d.Tags;
  });

console.log(tags);


var treetagsGroup = tags.groupAll().reduce(TreereduceAdd, TreereduceRemove, reduceInitial).value();


function TreereduceAdd(p, v) {
    
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 5) {
     p[val.Name] = (p[val.Name] || 0) + 1; //increment counts
 }
  });
  return p;
}

function TreereduceRemove(p, v) {
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 5) {
     p[val.Name] = (p[val.Name] || 0) - 1; //decrement counts
 }
  });
  return p;

}

function reduceInitial() {
  return {};  
}


// hack to make dc.js charts work
treetagsGroup.all = function() {
  var newObject = [];
  for (var key in this) {
    if (this.hasOwnProperty(key) && key != "all") {
      newObject.push({
        key: key,
        value: this[key]
      });
    }
  }
  return newObject;
}

  treejobtagsChart.width(450)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(tags)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(treetagsGroup);



var hazardtagsGroup = tags.groupAll().reduce(HazardreduceAdd, HazardreduceRemove, reduceInitial).value();


function HazardreduceAdd(p, v) {
    
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 7) {
     p[val.Name] = (p[val.Name] || 0) + 1; //increment counts
 }
  });
  return p;
}

function HazardreduceRemove(p, v) {
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 7) {
     p[val.Name] = (p[val.Name] || 0) - 1; //decrement counts
 }
  });
  return p;

}

function reduceInitial() {
  return {};  
}

hazardtagsGroup.all = function() {
  var newObject = [];
  for (var key in this) {
    if (this.hasOwnProperty(key) && key != "all") {
      newObject.push({
        key: key,
        value: this[key]
      });
    }
  }
  return newObject;
}


  hazardtagsChart.width(450)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(tags)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(hazardtagsGroup);





var propertytagsGroup = tags.groupAll().reduce(PropertyreduceAdd, PropertyreduceRemove, reduceInitial).value();


function PropertyreduceAdd(p, v) {
    
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 13) {
     p[val.Name] = (p[val.Name] || 0) + 1; //increment counts
 }
  });
  return p;
}

function PropertyreduceRemove(p, v) {
  v.Tags.forEach (function(val, idx) {
    if (val.TagGroupId == 13) {
     p[val.Name] = (p[val.Name] || 0) - 1; //decrement counts
 }
  });
  return p;

}

function reduceInitial() {
  return {};  
}

propertytagsGroup.all = function() {
  var newObject = [];
  for (var key in this) {
    if (this.hasOwnProperty(key) && key != "all") {
      newObject.push({
        key: key,
        value: this[key]
      });
    }
  }
  return newObject;
}


  propertytagsChart.width(450)
    .height(220)
    .radius(100)
    .innerRadius(0)
    .dimension(tags)
    .legend(dc.legend())
    .title(function(d){return d.value;})
    .group(propertytagsGroup);







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

if (params.hq.split(",").length == 1)
        {


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
        console.log("passed array of units");
        unitname = "group selection";
        HackTheMatrix(params.hq, unitname);
    }
    
} else {
console.log("rerun...will NOT fetch vars");

HackTheMatrix(params.hq, unitname);

}
    
    

}

//make the call to beacon
function HackTheMatrix(id, unit) {

   document.title = unitname+ " Job Statistics";


    var start = new Date(decodeURIComponent(params.start));
    var end = new Date(decodeURIComponent(params.end));

    GetJSONfromBeacon(id,start,end, function(jobs) {

            console.log(jobs)
                    document.getElementById("total").innerHTML = "Total Job Count: " + (jobs.Results.length);


    drawmelikeoneofyourfrenchgirls(jobs);


            

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