var timeoverride = null;
var timeperiod;
var unitname = "";

// window.onerror = function(message, url, lineNumber) {  
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message+"<br> line:"+lineNumber;
//   return true;
// }; 


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
function fetchFromBeacon(id, host, unit, cb) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  GetJSONfromBeacon(id, host, start, end, function(data) {
    GetNotificationJSONfromBeacon(id, host, start, end, function(data2) {
    cb && cb(data, data2);
  });
});
  

}

// render the page using the data provided
function renderPage(unit, jobs, notifications ) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  document.title = unit + " Job Statistics";

  $('#total').html("Total Job Count: " + (jobs.Results.length));


  prepareData(jobs,notifications, start, end);
  dc.renderAll();

  $('#loading').hide();
  $('#results').show();

  var options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
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
function prepareData(jobs, notifications, start, end) {

  // convert timestamps to Date()s

 var avgOpenCount =0;
 var avgOpenTotal =0;
 var avgAckCount =0;
 var avgAckTotal =0; 

  jobs.Results.forEach(function(d) {
    var thisJobisAck = false;
//console.log("ID:"+d.Id+" Locality:"+d.Address.Locality);
    if (d.LGA == null)
    {
      d.LGA = "N/A";
    }

    if (d.SituationOnScene == null)
    {
      d.SituationOnScene = "N/A";
    }

    if (d.Address.Locality == null)
    {
      d.Address.Locality = "N/A";
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
    d.JobOpenFor=0;
    d.JobCompleted=new Date(0);
    notifications.Results.forEach(function (d2){ //match notifications with jobs
      if (d2.JobId == d.Id) { //if the jobs match
        if (d2.Text == "Job "+d.Identifier+" Completed"){ //if its a completion note
          var rawdate = new Date(d2.CreatedOn);
          d.JobCompleted = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
          d.JobOpenFor = Math.abs((new Date(d.JobCompleted)) - (new Date(d.JobReceivedFixed)))/1000;
          ++avgOpenCount;
          avgOpenTotal=avgOpenTotal+d.JobOpenFor;

        }
        if (d2.Text.indexOf("Acknowledged") != -1 && thisJobisAck == false){ //if its a ack note
          thisJobisAck = true;
          ++avgAckCount;
          var rawdate = new Date(d2.CreatedOn);
          var fixeddate = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
          avgAckTotal=avgAckTotal+(Math.abs(fixeddate - (new Date(d.JobReceivedFixed)))/1000);
        }
      }


    })

if (thisJobisAck == false) {console.log(d.Id+" NO ACK!!!!!!!!!!!!!")}

  });

console.log(avgOpenCount);
console.log(avgAckCount);

  var jobavg = Math.round(avgOpenTotal/avgOpenCount).toString();
  var ackavg = Math.round(avgAckTotal/avgAckCount).toString();

console.log(jobavg);
console.log(ackavg);

  $('#avg').html("Average job time: " + jobavg.toHHMMSS() + " | Average time to acknowledge: "+ackavg.toHHMMSS());

  
  
prepareCharts(jobs, start, end);


makeCloud(jobs);

}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
}


function walkCloudData(jobs){ //take array and make word:frequency array

var wordCount = {};

  jobs.Results.forEach(function(d) {
//console.log(d);
  var strings = d.SituationOnScene.removeStopWords();
    
    //
    // strip stringified objects and punctuations from the string

    strings = strings.toLowerCase().replace(/object Object/g, '').replace(/\//g,' ').replace(/[\+\.,\/#!$%\^&\*{}=_`~]/g,'').replace(/[0-9]/g, '');
    
    // convert the str back in an array 
    strings = strings.split(' '); 

    // Count frequency of word occurance

    for(var i = 0; i < strings.length; i++) {
        if(!wordCount[strings[i]])
            wordCount[strings[i]] = 0;

        wordCount[strings[i]]++; // {'hi': 12, 'foo': 2 ...}
    }
   // console.log(wordCount);
  })

    var wordCountArr = [];

    for(var prop in wordCount) {
      wordCountArr.push({text: prop, size: wordCount[prop]});
    }
    
    return wordCountArr;

}



   //console.log(wordCount);
function makeCloud(jobs) {

calculateCloud(walkCloudData(jobs));



  function calculateCloud(wordCount) {

    console.log("Total word length: "+wordCount.length);

    var width = 800;
    var height = 800;
    var minFontSize = 24;
    var typeFace = 'Impact';

//console.log(wordCount);
var fill = d3.scale.category20();

  d3.layout.cloud().size([width, height])
      .words(wordCount)
      //.spiral("rectangular")
      .rotate(function() { return ~~(Math.random() * 2) * 90; })
      .font(typeFace)
      .fontSize(function(d) { return d.size * minFontSize; })
      .on("end", draw)
      .start();

  function draw(words) {
$("#cloud").html("");
   var svg = d3.select("#cloud").insert("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
      .attr('transform', 'translate('+width/2+', '+height/2+')')
      .selectAll("text")
        .data(words)
      .enter().append("text")
        .style("font-size", function(d) { return d.size + "px"; })
        .style("font-family", typeFace)
        .style("fill", function(d, i) { return fill(i); })
        .attr("text-anchor", "middle")
        .attr("transform", function(d) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        })
        .text(function(d) { return d.text; });
  }


};
}


// draw all of the pie charts
function prepareCharts(jobs, start, end) {

  var facts = crossfilter(jobs.Results);

  var all = facts.groupAll();


  //display totals

  var countchart = dc.dataCount("#total");

  // jobs per hour time chart
  var timeOpenChart = dc.barChart("#dc-timeopen-chart");
  var timeClosedChart = dc.barChart("#dc-timeclosed-chart");
  var dataTable = dc.dataTable("#dc-table-graph");

  //table 
 // var dataTable = dc.dataTable("#dc-table-graph");

   var closeTimeDimension = facts.dimension(function (d) {
    return d.JobCompleted;
  });


  //closeTimeDimension.filter(function(d) { return d !> 'undefined'; });

    var volumeClosedByHour = facts.dimension(function(d) {
    return d3.time.hour(d.JobCompleted);
  });

  var volumeClosedByHourGroup = volumeClosedByHour.group().reduceCount(function(d) { return d.JobCompleted; });

  timeClosedChart.width(800)
    .height(250)
    .transitionDuration(500)
    .brushOn(true)
    .mouseZoomable(false)
    .margins({top: 10, right: 10, bottom: 20, left: 40})
    .dimension(closeTimeDimension)
    .group(volumeClosedByHourGroup)
    //.brushOn(false)           // added for title
    .xUnits(d3.time.hours)
    .x(d3.time.scale().domain([new Date(start), new Date(end)]))
    .elasticY(true)
    //.x(d3.time.scale().domain(d3.extent(jobs.Results, function(d) {
    //return d.JobReceived; })))
    .xAxis();



//console.log(total);
//console.log(count);


// Create datatable dimension
  var timeOpenDimension = facts.dimension(function (d) {
    return d.JobReceivedFixed;
  });



  var volumeOpenByHour = facts.dimension(function(d) {
    return d3.time.hour(d.JobReceivedFixed);
  });

  var volumeOpenByHourGroup = volumeOpenByHour.group().reduceCount(function(d) { return d.JobReceivedFixed; });


  timeOpenChart.width(800)
    .height(250)
    .transitionDuration(500)
    .brushOn(true)
    .mouseZoomable(false)
    .margins({top: 10, right: 10, bottom: 20, left: 40})
    .dimension(timeOpenDimension)
    .group(volumeOpenByHourGroup)
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

 var options = {
   // weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };




 // Table of  data
  dataTable.width(1200).height(800)
  .dimension(timeOpenDimension)
  .group(function(d) { return "First 10"  })
  .size(10)
    .columns([
      function(d) { return "<a href=\"https://beacon.ses.nsw.gov.au/Jobs/"+d.Id+"\" target=\"_blank\">"+d.Identifier+"</a>"; },
      function(d) { return d.Type; },
      function(d) { return d.JobReceivedFixed.toLocaleTimeString("en-au", options); },
      function(d) { return (new Date(d.JobCompleted).getTime() !== new Date(0).getTime() ? d.JobCompleted.toLocaleTimeString("en-au", options):"") },
      function(d) { return d.Address.PrettyAddress; },
      ])
    .sortBy(function(d){ return d.JobReceivedFixed; })
    .order(d3.ascending);

// Table of  data
  // dataTable.width(960).height(800)
  //   .dimension(timeDimension)
  // .group(function(d) { return ""
  //  })
  // .size(10)
  //   .columns([
  //     function(d) { return d.Id; },
  //     function(d) { return d.Address.PrettyAddress; },
  //     function(d) { return d.Address.Locality; },
  //     function(d) { return d.Type; }])
  //   .sortBy(function(d){ return d.dtg; })
  //   .order(d3.ascending);



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

      //IF TRAIN BEACON

    if (params.host == "trainbeacon.ses.nsw.gov.au")
    {
        document.body.style.backgroundColor = "green";
    }


  function fetchComplete(jobsData,notificationData) {
    console.log("Done fetching from beacon, rendering graphs...");
    renderPage(unitname, jobsData,notificationData);
    console.log("Graphs rendered.");
  }




  if (unitname == "") {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') {

      if (params.hq.split(",").length == 1) {

        GetUnitNamefromBeacon(params.hq, params.host, function(result) {
          unitname = result;

          fetchFromBeacon(params.hq, params.host,result, fetchComplete);
        });

      } else {
        console.log("passed array of units");
        unitname = "group selection";
        fetchFromBeacon(params.hq, params.host, unitname, fetchComplete);
      }
    } else { //no hq was sent, get them all
      unitname = "NSW";
      fetchFromBeacon(null, params.host, unitname, fetchComplete);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    if (typeof params.hq == 'undefined') {
      fetchFromBeacon(null, params.host, unitname, fetchComplete);
    } else {
      fetchFromBeacon(params.hq, params.host, unitname, fetchComplete);
    }
  }
}
