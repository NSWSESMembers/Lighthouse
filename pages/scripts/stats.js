var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseChrome = require('../lib/shared_chrome_code.js');
var LighthouseWordCloud = require('../lib/stats/wordcloud.js');
var LighthouseStatsJobsCleanup = require('../lib/stats/jobparsing.js');



var $ = require('jquery');
global.jQuery = $;

var ElasticProgress = require('elastic-progress');
var crossfilter = require('crossfilter');
var d3 = require('d3');
var dc = require('dc');

// inject css c/o browserify-css
require('../styles/stats.css');

var timeoverride = null;
var timeperiod;
var unit = null;
var facts = null;
var firstrun = true; 

//get passed page params
var params = getSearchParameters();



// init
$(function() {


  if (chrome.manifest.name.includes("Development")) {
    $('body').addClass("watermark");
  }



  var element = document.querySelector('.loadprogress');

  var mp = new ElasticProgress(element, {
    buttonSize: 60,
    fontFamily: "Montserrat",
    colorBg: "#ccb2e6",
    colorFg: "#4c2673",
    onClose:function(){
     $('#loading').hide();
     $('#results').show();
     $('footer').show();

   }
 });

  //run every X seconds the main loop.
  startTimer(180, $('#time'));

  // main
  RunForestRun(mp)

});

// redraw when the slide radio buttons change
$(document).on('change', 'input[name=slide]:radio', function() {
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

//refresh button
$(document).ready(function() {
  $("#refresh").click(function($e) {
    $e.preventDefault();
    RunForestRun();
  })
});

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};

  function transformToAssocArray( prmstr ) {
    var params = {};
    var prmarr = prmstr.split("&");
    for (var i = 0; i < prmarr.length; i++) {
      var tmparr = prmarr[i].split("=");
      params[tmparr[0]] = tmparr[1];
    }
    return params;
  }

}



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

//Get times vars for the call
function RunForestRun(mp) {

  mp && mp.open();

  if (timeoverride !== null) { //we are using a time override
    var end = new Date();
    var start = new Date();

    start.setDate(start.getDate() - (timeoverride/24));

    starttime = start.toISOString();
    endtime = end.toISOString();

    params.start = starttime;
    params.end = endtime;
  } else {
    params = getSearchParameters();
  }

  function fetchComplete(jobsData, progressBar, firstrun) {
    console.log("Done fetching from beacon, rendering graphs...");
    renderPage(unit, jobsData, firstrun);
    console.log("Graphs rendered.");
    progressBar &&  progressBar.setValue(1);
    progressBar && progressBar.close();
  }

  if (firstrun) {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') { //HQ was sent (so no filter)

      if (params.hq.split(",").length == 1) { //if only one HQ

        LighthouseUnit.get_unit_name(params.hq, params.host, params.token, function(result) {
          unit = result;

          fetchFromBeacon(unit, params.host, params.token, fetchComplete, mp, firstrun);
        });

      } else { //if more than one HQ
        unit = []; 
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        console.log(hqsGiven);
        hqsGiven.forEach(function(d){
          LighthouseUnit.get_unit_name(d, params.host, params.token, function(result) {
            unit.push(result);
            if (unit.length == params.hq.split(",").length) {
              fetchFromBeacon(unit, params.host, params.token, fetchComplete, mp, firstrun);
            }
          });
        });
      }
    } else { //no hq was sent, get them all
      unit = [];
      fetchFromBeacon(unit, params.host, params.token, fetchComplete, mp, firstrun);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    $('#loadinginline').css('visibility', 'visible');
    fetchFromBeacon(unit, params.host, params.token, fetchComplete, mp, firstrun);
  }
}



// fetch jobs from beacon
function fetchFromBeacon(unit, host, token, cb, progressBar, firstrun) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  LighthouseJob.get_json(unit, host, start, end, token, function(data) {
    cb && cb(data,progressBar,firstrun);
  },function(val,total){
    if (progressBar) { //if its a first load
      if (val == -1 && total == -1) {
        progressBar.fail();
      } else {
        progressBar.setValue(val/total)
      }
    }
  });
}

// render the page using the data provided
function renderPage(unit, jobs, firstrunlocal) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  cleanJobs = LighthouseStatsJobsCleanup.prepareData(jobs, unit, start, end);

  prepareCharts(cleanJobs, start, end, firstrun);

  LighthouseWordCloud.makeSituationOnSceneCloud(cleanJobs,'#cloud');

  if (firstrunlocal) {
    console.log("First Run - We Will Render All")

    dc.renderAll();


  } else {
    console.log("NOT first run - Will Redraw All")
    dc.redrawAll();
    $('#loadinginline').css('visibility', 'hidden');
  }

  //WE ARE DONE WILL ALL LOADING

  if (firstrunlocal)
  {
    firstrun = false
  }

    //click to reset the filters that are applied
    $( ".total" ).click(function($e) {
      $e.preventDefault();
      dc.filterAll();
      dc.renderAll();
    });



  }




  String.prototype.toHHMMSS = function () {
  var sec_num = parseInt(this, 10); // don't forget the second param
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {
    hours = "0"+hours;
  }
  if (minutes < 10) {
    minutes = "0"+minutes;
  }
  if (seconds < 10) {
    seconds = "0"+seconds;
  }
  var time = hours+':'+minutes+':'+seconds;
  return time;
}




//null these at this scope so they persist and we can refresh the data display
var timeOpenChart = null;
var runningChart = null;
var timeClosedChart = null;
var dataTable = null;
var statusChart = null;
var agencyChart = null;
var eventChart = null;
var priorityChart = null;
var jobTypeChart = null;
var hazardChart = null;
var propertyChart = null;
var jobtypeChart = null;
var localChart = null;

function prepareCharts(jobs, start, end, firstRun) {

  if (firstRun) //if its the first run expect everything to not exist, and draw it all
  {
    facts = crossfilter(jobs.Results)

    var all = facts.groupAll();


  //display totals
  countchart = dc.dataCount(".total");

  // jobs per hour time chart
  timeOpenChart = dc.barChart("#dc-timeopen-chart");
  runningChart = dc.compositeChart("#dc-running-chart");

  timeClosedChart = dc.barChart("#dc-timeclosed-chart");
  dataTable = dc.dataTable("#dc-table-graph");

  var closeTimeDimension = facts.dimension(function (d) {
    return d.JobCompleted;
  });

  var timeOpenDimension = facts.dimension(function (d) {
    return d.JobReceivedFixed;
  });




  var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
  var timeDifference = (Math.round(Math.abs((start.getTime() - end.getTime())/(oneDay))));
  var timePeriodWord;
  var timePeriodUnits;

  if (timeDifference <= 7) {
    timePeriodWord = "hour";
    timePeriodUnits = d3.time.hours;
    var volumeClosedByPeriod = facts.dimension(function(d) {
      return d3.time.hour(d.JobCompleted);
    });
    var volumeOpenByPeriod = facts.dimension(function(d) {
      return d3.time.hour(d.JobReceivedFixed);
    });
  } else {
    timePeriodWord = "day";
    timePeriodUnits = d3.time.days;
    var volumeClosedByPeriod = facts.dimension(function(d) {
      return d3.time.day(d.JobCompleted);
    });
    var volumeOpenByPeriod = facts.dimension(function(d) {
      return d3.time.day(d.JobReceivedFixed);
    });
  }

  $('#receivedTitle').html("Jobs Received Per "+timePeriodWord);
  $('#completedTitle').html("Jobs Completed Per "+timePeriodWord);
  $('#runningTitle').html("Running Totals Per "+timePeriodWord);



  var volumeClosedByPeriodGroup = volumeClosedByPeriod.group().reduceCount(function(d) { return d.JobCompleted; });

  var volumeOpenByPeriodGroup = volumeOpenByPeriod.group().reduceCount(function(d) { return d.JobReceivedFixed; });

  
  var runningtotalGroup = accumulate_group(volumeOpenByPeriodGroup) 

  var runningclosedGroup = accumulate_group(volumeClosedByPeriodGroup) 


  function accumulate_group(source_group) {
    return {
      all:function () {
        var cumulate = 0;
        return source_group.all().map(function(d) {
          if (new Date(d.key).getTime() != new Date(0).getTime()) //ignore jobs not completed
          {
            cumulate += d.value;
          }
          return {key:d.key, value:cumulate};
        });
      }
    };
  }


  timeOpenChart
  .width(800)
  .height(250)
  .transitionDuration(500)
  .brushOn(true)
  .mouseZoomable(false)
  .margins({top: 10, right: 10, bottom: 20, left: 40})
  .dimension(timeOpenDimension)
  .group(volumeOpenByPeriodGroup)
  .xUnits(timePeriodUnits)
  .x(d3.time.scale().domain([new Date(start), new Date(end)]))
  .elasticY(true)
  .xAxis();

  timeClosedChart
  .width(800)
  .height(250)
  .transitionDuration(500)
  .brushOn(true)
  .mouseZoomable(false)
  .margins({top: 10, right: 10, bottom: 20, left: 40})
  .dimension(closeTimeDimension)
  .group(volumeClosedByPeriodGroup)
  .xUnits(timePeriodUnits)
  .x(d3.time.scale().domain([new Date(start), new Date(end)]))
  .elasticY(true)
  .xAxis();


  runningChart
  .width(1200)
  .height(250)
  .transitionDuration(500)
  .mouseZoomable(false)
  .margins({top: 10, right: 10, bottom: 20, left: 40})
  .legend(dc.legend().x(80).y(20).itemHeight(13).gap(5))
  .renderHorizontalGridLines(true)
  .xUnits(timePeriodUnits)
  .renderlet(function(chart) {
    chart.svg().selectAll('.chart-body').attr('clip-path', null)
  })
  .compose([
    dc.lineChart(runningChart)
    .dimension(timeOpenDimension)
    .colors('red')
    .renderDataPoints({radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8})
    .group(runningtotalGroup, "Accumulative Job Count"),
    dc.lineChart(runningChart)
    .dimension(closeTimeDimension)
    .colors('blue')
    .group(runningclosedGroup, "Accumulative Jobs Closed")
    .dashStyle([5,1])
    .xyTipsOn(true)
    .renderDataPoints({radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8})
    ])
  .x(d3.time.scale().domain([new Date(start), new Date(end)]))
  .elasticY(true)
  .brushOn(false)
  .xAxis();


  countchart
  .dimension(facts)
  .group(all)
  .html({
    some:"%filter-count selected out of %total-count",
    all:"%total-count job(s) total"
  });

  var options = {
   year: "2-digit",
   month: "2-digit",
   day: "numeric",
   hour12: false
 };

  // Table of  data
  dataTable
  .width(1200)
  .height(800)
  .dimension(timeOpenDimension)
  .group(function(d) { return "Filtered Results (15 Max)"  })
  .size(15)
  .columns([
    function(d) { return "<a href=\""+params.host+"/Jobs/"+d.Id+"\" target=\"_blank\">"+d.Identifier+"</a>"; },
    function(d) { return d.Type; },
    function(d) { return d.JobReceivedFixed.toLocaleTimeString("en-au", options); },
    function(d) { return (new Date(d.JobCompleted).getTime() !== new Date(0).getTime() ? d.JobCompleted.toLocaleTimeString("en-au", options):"") },
    function(d) { return d.Address.PrettyAddress; },
    function(d) { return d.SituationOnScene; },
    ])
  .sortBy(function(d){ return d.JobReceivedFixed; })
  .order(d3.descending);


  


  jobtypeChart = makeSimplePie("#dc-jobtype-chart", 460, 240, function(d) {
    return d.Type;
  });

  localChart = makeSimplePie("#dc-local-chart", 460, 240, function(d) {
    if (unit.length == 0) { //whole nsw state
      return d.LGA;
    }
    if (Array.isArray(unit) == false) { //1 lga
      return d.Address.Locality;
    }
    if (unit.length > 1) { //more than one
      return d.LGA;
    }
  });

  statusChart = makeSimplePie("#dc-jobstatus-chart", 460, 240, function(d) {
    return d.JobStatusType.Name;
  });

  agencyChart = makeSimplePie("#dc-agency-chart", 460, 240, function(d) {
    return d.ReferringAgencyID;
  });

  eventChart = makeSimplePie("#dc-event-chart", 460, 240, function(d) {
    return d.EventID;
  });

  priorityChart = makeSimplePie("#dc-priority-chart", 460, 240, function(d) {
    return d.JobPriorityType.Name;
  });

  jobTypeChart = makeSimplePieAbrev("#dc-tasktype-chart", 460, 240, function(d) {
    return d.jobtype;
  });

  hazardChart = makeTagPie('#dc-hazardtags-chart', function(d) {
    return d.hazardTags;
  },"hazardTags");

  propertyChart = makeTagPie('#dc-propertytags-chart', function(d) {
    return d.propertyTags;
  },"propertyTags");

  } else { //its not the first run so things will exists, just refresh the data


    //remember the set filters
    statusChartFilters = statusChart.filters();
    agencyChartFilters = agencyChart.filters();
    eventChartFilters = eventChart.filters();
    priorityChartFilters = priorityChart.filters();
    jobTypeChartFilters = jobTypeChart.filters();
    hazardChartFilters = hazardChart.filters();
    propertyChartFilters = propertyChart.filters();
    jobtypeChartFilters = jobtypeChart.filters();
    localChartFilters = localChart.filters();


    //remove the filters
    statusChart.filter(null)
    agencyChart.filter(null)
    eventChart.filter(null)
    priorityChart.filter(null)
    jobTypeChart.filter(null)
    hazardChart.filter(null)
    propertyChart.filter(null)
    jobtypeChart.filter(null)
    localChart.filter(null)

    //flush all the jobs stored in the facts
    facts.remove();


    //reapply the filters
    statusChart.filter([statusChartFilters])
    agencyChart.filter([agencyChartFilters])
    eventChart.filter([eventChartFilters])
    priorityChart.filter([priorityChartFilters])
    jobTypeChart.filter([jobtypeChartFilters])
    hazardChart.filter([hazardChartFilters])
    propertyChart.filter([propertyChartFilters])
    jobtypeChart.filter([jobtypeChartFilters])
    localChart.filter([localChartFilters])



    //add the data back in
    facts.add(jobs.Results)
  };

}


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
        ).value();
      group.all = function() {
        var newObject = [];
        for (var key in this) {
          if (this.hasOwnProperty(key) && key != "all" && key != "top") {
            newObject.push({
              key: key,
              value: this[key]
            });
          }
        }
        return newObject;
      };
      group.top = function(count) {
        var newObject = this.all();
        newObject.sort(function(a, b) {
          return b.value - a.value
        });
        return newObject.slice(0, count);
      };
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
          if (this.hasOwnProperty(key) && key != "all" && key != "top") {
            newObject.push({
              key: key,
              value: this[key]
            });
          }
        }
        return newObject;
      };
      group.top = function(count) {
        var newObject = this.all();
        newObject.sort(function(a, b) {
          return b.value - a.value
        });
        return newObject.slice(0, count);
      };
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
          if (this.hasOwnProperty(key) && key != "all" && key != "top") {
            newObject.push({
              key: key,
              value: this[key]
            });
          }
        }
        return newObject;
      };
      group.top = function(count) {
        var newObject = this.all();
        newObject.sort(function(a, b) {
          return b.value - a.value
        });
        return newObject.slice(0, count);
      };
      return group;
      break;              
    }

  }

  


// make pie chart using our standard parameters
function makePie(elem, w, h, dimension, group) {
  var chart = dc.pieChart(elem);
  chart.width(w)
  .height(h)
  .radius(110)
  .innerRadius(0)
  .dimension(dimension)
  .group(group);
  return chart;
}



  // produces a pie chart for displaying tags
  function makeTagPie(elem, fact, location) {
    var dimension = facts.dimension(function (d) {
      return fact(d);
    });

    var group = makeTagGroup(dimension,location);
    var chart = makePie(elem, 460, 240, dimension, group);

    chart.slicesCap(10);
    chart.legend(dc.legend().legendText(function(d) { return d.name + ' (' +d.data+')'; }).x(0).y(20))

    chart.filterHandler (function (dimension, filters) {
      if (filters.length === 0)
        dimension.filter(null);
      else
        dimension.filterFunction(function (d) {
          for (var i=0; i < d.length; i++) {
            if (filters.indexOf(d[i]) >= 0)
              return true;
          }
          return false; 
        });
      return filters; 
    });
    return chart
  }

  // produces a simple pie chart
  function makeSimplePie(elem, w, h, selector) {
    var dimension = facts.dimension(function (d) {
      return selector(d);
    });
    var group = dimension.group();
    var chart = makePie(elem, w, h, dimension, group);
    chart
    .slicesCap(10);
    chart.legend(dc.legend().legendText(function(d) { return d.name + ' (' +d.data+')'; }).x(0).y(20))
    return chart
  }

  function makeSimplePieAbrev(elem, w, h, selector) {
    var dimension = facts.dimension(function (d) {
      return selector(d);
    });
    var group = dimension.group();
    var chart = makePie(elem, w, h, dimension, group);
    chart
    .slicesCap(10);
    chart.label(function(d) {
      var matches = d.key.match(/\b(\w|\+)/g);              // ['J','S','O','N']
      var acronym = matches.join(''); 
      return acronym;
    })
    chart.legend(dc.legend().legendText(function(d) { return d.name + ' (' +d.data+')';}).x(0).y(20))
    return chart
  }




