var timeoverride = null;
var timeperiod;
var unitname = "";

window.onerror = function(message, url, lineNumber) {  
  document.getElementById("loading").innerHTML = "Error loading page<br>"+message+"<br> line:"+lineNumber;
  return true;
}; 


// init
$(function() {

  //run every X period of time the main loop.
  startTimer(180, $('#time'));

  // main
  RunForestRun()
});

// redraw when the slide radio buttons change
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

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray( prmstr ) {
  var params = {};
  var prmarr = prmstr.split("&");
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split("=");
    params[tmparr[0]] = tmparr[1];
  }
  return params;
}

var params = getSearchParameters();

//update every X seconds
function startTimer(duration, display) {
  var timer = duration, minutes, seconds;
  setInterval(function () {
    minutes = parseInt(timer / 60, 10)
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    $(display).text(minutes + ":" + seconds);

    if (--timer < 0) { //when the timer is 0 run the code
      timer = duration;
      RunForestRun();
    }
  }, 1000);
}

// fetch jobs from beacon
function fetchJobsFromBeacon(id, unit, cb) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  GetJSONfromBeacon(id, start, end, function(data) {
    cb && cb(data);
  });
}

// render the page using the data provided
function renderPage(unit, jobs) {
  console.log(jobs);

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  document.title = unit + " Job Statistics";

  $('#total').html("Total Job Count: " + (jobs.Results.length));

  prepareData(jobs, start, end);
  dc.renderAll();

  $('#loading').hide();
  $('#results').show();

  var options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric"
  };

  var html = "<h2>Job statistics for " +
    unit + "</h2><h4>" + start.toLocaleTimeString("en-au", options) +
    " to " + end.toLocaleTimeString("en-au", options) + "</h4>";
  $('#banner').html(html);
}

// make pie chart using our standard parameters
function makePie(elem, w, h, dimension, group) {
  var chart = dc.pieChart(elem);
  chart.width(w)
       .height(h)
       .radius(100)
       .innerRadius(0)
       .dimension(dimension)
       .legend(dc.legend())
      // .title(function(d) { return d.value; })
       .group(group);
  return chart;
}

// gather and organise all of the data
// build charts and feed data
// render
function prepareData(jobs, start, end) {

  // convert timestamps to Date()s
  jobs.Results.forEach(function(d) {

    if (d.LGA == null)
    {
      d.LGA = "N/A";
    }


    var rawdate = new Date(d.JobReceived);
    d.JobReceivedFixed = new Date(
      rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 )
    );
d.hazardTags = [];
d.treeTags = [];
d.propertyTags = [];
    d.Tags.forEach(function(d2){
      switch (d2.TagGroupId)
      {
        case 5:
          d.treeTags.push(d2.Name);
          break;
        case 7:
          d.hazardTags.push(d2.Name);
          break
        case 13:
          d.propertyTags.push(d2.Name);
          break;
      }
    });
  });

  
  
  prepareCharts(jobs, start, end);
}




// draw all of the pie charts
function prepareCharts(jobs, start, end) {

  var facts = crossfilter(jobs.Results);

  var all = facts.groupAll();


  //display totals

  var countchart = dc.dataCount("#total");

  // jobs per hour time chart
  var timeChart = dc.barChart("#dc-time-chart");
  var volumeByHour = facts.dimension(function(d) {
    return d3.time.hour(d.JobReceivedFixed);
  });

  var volumeByHourGroup = volumeByHour.group().reduceCount(function(d) { return d.JobReceivedFixed; });

  timeChart.width(1000)
    .height(250)
    .transitionDuration(500)
    .brushOn(true)
    .mouseZoomable(false)
    .margins({top: 10, right: 10, bottom: 20, left: 40})
    .dimension(volumeByHour)
    .group(volumeByHourGroup)
    //.brushOn(false)           // added for title
    .xUnits(d3.time.hours)
    .x(d3.time.scale().domain([new Date(start), new Date(end)]))
    .elasticY(true)
    //.x(d3.time.scale().domain(d3.extent(jobs.Results, function(d) {
    //return d.JobReceived; })))
    .xAxis();


countchart
.dimension(facts)
.group(all)
.html({
some:"%filter-count selected out of total of %total-count",
all:"%total-count job(s) total"
});


  // produces a 'group' for tag pie charts, switch on the key in the object that needs to be walked
  function makeTagGroup(dim, targetfact) {

      switch (targetfact) {
          case "treeTags":
              var group = dim.groupAll().reduce(
                  function(p, v) {
                      v.treeTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) + 1; //increment counts
                      });
                      return p;
                  },
                  function(p, v) {
                      v.treeTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) - 1; //decrement counts
                      });
                      return p;
                  },
                  function() {
                      return {};
                  }
              ).value()
              group.all = function() {
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
              };
              // group.top = function(count) {
              //     var newObject = this.all();
              //     newObject.sort(function(a, b) {
              //         return b.value - a.value
              //     });
              //     return newObject.slice(0, count);
              // };
              return group;
              break;
          case "hazardTags":
              var group = dim.groupAll().reduce(
                  function(p, v) {
                      v.hazardTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) + 1; //increment counts
                      });
                      return p;
                  },
                  function(p, v) {
                      v.hazardTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) - 1; //decrement counts
                      });
                      return p;
                  },
                  function() {
                      return {};
                  }
              ).value()
              group.all = function() {
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
              };
              // group.top = function(count) {
              //     var newObject = this.all();
              //     newObject.sort(function(a, b) {
              //         return b.value - a.value
              //     });
              //     return newObject.slice(0, count);
              // };
             return group;
              break;
          case "propertyTags":
              var group = dim.groupAll().reduce(
                  function(p, v) {
                      v.propertyTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) + 1; //increment counts
                      });
                      return p;
                  },
                  function(p, v) {
                      v.propertyTags.forEach(function(val, idx) {
                          p[val] = (p[val] || 0) - 1; //decrement counts
                      });
                      return p;
                  },
                  function() {
                      return {};
                  }
              ).value()
              group.all = function() {
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
              };
              // group.top = function(count) {
              //     var newObject = this.all();
              //     newObject.sort(function(a, b) {
              //         return b.value - a.value
              //     });
              //     return newObject.slice(0, count);
              // };
              return group;
              break;              
      }

  };



  // produces a pie chart for displaying tags
  function makeTagPie(elem, fact, location) {
    var dimension = facts.dimension(function (d) {
      return fact(d);
    });

    var group = makeTagGroup(dimension,location);

    var chart = makePie(elem, 450, 220, dimension, group);

    chart.filterHandler (function (dimension, filters) {
   dimension.filter(null);   
    if (filters.length === 0)
        dimension.filter(null);
    else
        dimension.filterFunction(function (d) {
            for (var i=0; i < d.length; i++) {
                if (filters.indexOf(d[i]) >= 0) return true;
            }
            return false; 
        });
  return filters; 
  }
);
  }

  // produces a simple pie chart
  function makeSimplePie(elem, w, h, selector) {
    var dimension = facts.dimension(function (d) {
      return selector(d);
    });
    var group = dimension.group();

    var chart = makePie(elem, w, h, dimension, group);
    chart.slicesCap(10)

  }

  makeSimplePie("#dc-jobtype-chart", 350, 220, function(d) {
    return d.Type;
  });

  makeSimplePie("#dc-local-chart", 450, 220, function(d) {
    switch(unitname)
    {
      case "NSW":
        return d.LGA;
        break;
      case "group selection":
        return d.LGA;
        break;
      default:
        return d.Address.Locality;
        break;
    }
    
  });

  makeSimplePie("#dc-priority-chart", 350, 220, function(d) {
    return d.JobPriorityType.Name;
  });

  makeTagPie('#dc-treetags-chart', function(d) {
    return d.treeTags;
  },"treeTags");

  makeTagPie('#dc-hazardtags-chart', function(d) {
    return d.hazardTags;
  },"hazardTags");

  makeTagPie('#dc-propertytags-chart', function(d) {
    return d.propertyTags;
  },"propertyTags");


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

  function fetchComplete(data) {
    console.log("Done fetching from beacon, rendering graphs...");
    renderPage(unitname, data);
    console.log("Graphs rendered.");
  }

  if (unitname == "") {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') {

      if (params.hq.split(",").length == 1) {

        GetUnitNamefromBeacon(params.hq, function(result) {
          unitname = result;

          fetchJobsFromBeacon(params.hq, result, fetchComplete);
        });

      } else {
        console.log("passed array of units");
        unitname = "group selection";
        fetchJobsFromBeacon(params.hq, unitname, fetchComplete);
      }
    } else { //no hq was sent, get them all
      unitname = "NSW";
      fetchJobsFromBeacon(null, unitname, fetchComplete);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    if (typeof params.hq == 'undefined') {
      fetchJobsFromBeacon(null, unitname, fetchComplete);
    } else {
      fetchJobsFromBeacon(params.hq, unitname, fetchComplete);
    }
  }
}
