var timeoverride = null;
var timeperiod;
var unit = null;

// window.onerror = function(message, url, lineNumber) {  
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message+"<br> line:"+lineNumber;
//   return true;
// }; 


// init
$(function() {
  var element = document.querySelector('.loadprogress');

  var mp = new ElasticProgress(element, {
    buttonSize: 60,
    fontFamily: "Montserrat",
    colorBg: "#ccb2e6",
    colorFg: "#4c2673",
    onClose:function(){
       $('#loading').hide();
       $('#results').show();
    }
  });

  //run every X seconds the main loop.
  startTimer(180, $('#time'));

  // main
  RunForestRun(mp)
});

// redraw when the slide radio buttons change
$(document).on('change', 'input[name=slide]:radio', function() {
  console.log(this.value);
  timeoverride = (this.value == "reset" ? null : this.value);
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
function fetchFromBeacon(unit, host, cb, progressBar) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  GetJSONfromBeacon(unit, host, start, end, function(data) {
    cb && cb(data,progressBar);
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
function renderPage(unit, jobs) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  prepareData(jobs, unit, start, end);
  dc.renderAll();

  $( ".total" ).click(function() {
    console.log("clicky clicky")
    dc.filterAll();
    dc.renderAll();
  });

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
    .group(group);
    return chart;
}

// gather and organise all of the data
// build charts and feed data
// render
function prepareData(jobs, unit, start, end) {

  // convert timestamps to Date()s

  var avgOpenCount =0;
  var avgOpenTotal =0;
  var avgAckCount =0;
  var avgAckTotal =0; 
  var EventwordCounts = [];

  jobs.Results.forEach(function(d) {
    var thisJobisAck = false;
    var thisJobisComp = false;

    if (d.Event) {
      var words = d.Event.Identifier +" - "+ d.Event.Description;
      EventwordCounts[words] = (EventwordCounts[words] || 0) + 1;
    }

    if (d.LGA == null) {
      d.LGA = "N/A";
    }

    if (d.SituationOnScene == null) {
      d.SituationOnScene = "N/A";
    }

    if (d.Address.Locality == null) {
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
      switch (d2.TagGroupId) {
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

    for(var counter=d.JobStatusTypeHistory.length - 1; counter >= 0;counter--){
      switch (d.JobStatusTypeHistory[counter].Type) {
        case 1: // New
          break;
        case 2: // Acknowledged
          if (thisJobisAck == false) {
            thisJobisAck = true;
            ++avgAckCount;
            var rawdate = new Date(d.JobStatusTypeHistory[counter].Timelogged);
            var fixeddate = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
            d.TimeToAck = Math.abs(fixeddate - (new Date(d.JobReceivedFixed)))/1000;
            avgAckTotal=avgAckTotal+(Math.abs(fixeddate - (new Date(d.JobReceivedFixed)))/1000);
          }          
          break;
        case 6: // Complete
          if (thisJobisComp == false) {
            thisJobisComp = true;
            ++avgOpenCount;
            var rawdate = new Date(d.JobStatusTypeHistory[counter].Timelogged);
            d.JobCompleted = new Date(rawdate.getTime() + ( rawdate.getTimezoneOffset() * 60000 ));
            avgOpenTotal=avgOpenTotal+(Math.abs(d.JobCompleted - (new Date(d.JobReceivedFixed)))/1000);
          }
          break;
        case 7: // Cancelled
          break;
      }
    }
  });


  var options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };

  if (unit.length == 0) { //whole nsw state
    document.title = "NSW Job Statistics";
    $('.stats header h2').text('Job statistics for NSW');
  } else {
    if (Array.isArray(unit) == false) { //1 lga
      document.title = unit.Name + " Job Statistics";
      $('.stats header h2').text('Job statistics for '+unit.Name);
    }
    if (unit.length == 1) { //more than one
      document.title = "Group Job Statistics";
      $('.stats header h2').text('Job statistics for Group');
    }
  }

  $('.stats header h4').text(
    start.toLocaleTimeString("en-au", options) + " to " +
    end.toLocaleTimeString("en-au", options)
  );

  console.log(avgOpenCount);
  console.log(avgAckCount);

  var jobavg = Math.round(avgOpenTotal/avgOpenCount).toString();
  var ackavg = Math.round(avgAckTotal/avgAckCount).toString();

  console.log(jobavg);
  console.log(ackavg);

  var banner = "";

  for (var i = 0; i < Object.keys(EventwordCounts).length; ++i) {
    banner = i == 0 ? banner + Object.keys(EventwordCounts)[i] : banner + " | " + Object.keys(EventwordCounts)[i] ;
  }


  $('.events').html(banner);

  $('.events').marquee();

  prepareCharts(jobs, start, end);

  makeSituationOnSceneCloud(jobs);
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


function walkSituationOnSceneWords(jobs){ //take array and make word:frequency array

  var wordCount = {};

  jobs.Results.forEach(function(d) {
    var strings = d.SituationOnScene.removeStopWords();

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
  });

  var wordCountArr = [];

  for(var prop in wordCount) {
    wordCountArr.push({text: prop, weight: wordCount[prop]});
  }

  return wordCountArr;

}

function makeSituationOnSceneCloud(jobs) {
  calculateSituationOnSceneCloud(walkSituationOnSceneWords(jobs));

  function calculateSituationOnSceneCloud(wordCount) {
    var purdyColor = tinygradient('black', 'red', 'orange', 'blue', 'LightBlue');

    $('#cloud').jQCloud(wordCount, {
      width: 500,
      height: 350,
      colors: purdyColor.rgb(10)
    });

    console.log("Total word count: "+wordCount.length);
  };
}


// draw all of the pie charts
function prepareCharts(jobs, start, end) {
  var facts = crossfilter(jobs.Results);
  var all = facts.groupAll();

  //display totals
  var countchart = dc.dataCount(".total");

  // jobs per hour time chart
  var timeOpenChart = dc.barChart("#dc-timeopen-chart");
  var timeClosedChart = dc.barChart("#dc-timeclosed-chart");
  var dataTable = dc.dataTable("#dc-table-graph");


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
  console.log(timeDifference);

  if (timeDifference <= 1) {
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

  $('#receivedTitle').html("Jobs received per "+timePeriodWord);
  $('#completedTitle').html("Jobs completed per "+timePeriodWord);

  var volumeClosedByPeriodGroup = volumeClosedByPeriod.group().reduceCount(function(d) { return d.JobCompleted; });
  var volumeOpenByPeriodGroup = volumeOpenByPeriod.group().reduceCount(function(d) { return d.JobReceivedFixed; });

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

  countchart
    .dimension(facts)
    .group(all)
    .html({
      some:"%filter-count selected out of %total-count",
      all:"%total-count job(s) total"
    });

  var options = {
     year: "numeric",
     month: "2-digit",
     day: "numeric",
     hour12: false
   };

  // Table of  data
  dataTable
    .width(1200)
    .height(800)
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


  // produces a pie chart for displaying tags
  function makeTagPie(elem, fact, location) {
    var dimension = facts.dimension(function (d) {
      return fact(d);
    });

    var group = makeTagGroup(dimension,location);
    var chart = makePie(elem, 450, 220, dimension, group);

    chart.slicesCap(10);

    chart.filterHandler (function (dimension, filters) {
      dimension.filter(null);   
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
  }

  // produces a simple pie chart
  function makeSimplePie(elem, w, h, selector) {
    var dimension = facts.dimension(function (d) {
      return selector(d);
    });
    var group = dimension.group();
    var chart = makePie(elem, w, h, dimension, group);
    chart.slicesCap(10);
  }

  makeSimplePie("#dc-jobtype-chart", 350, 220, function(d) {
    return d.Type;
  });

  makeSimplePie("#dc-local-chart", 450, 220, function(d) {
    if (unit.length == 0) { //whole nsw state
      return d.LGA;
    }
    if (Array.isArray(unit) == false) { //1 lga
      return d.Address.Locality;
    }
    if (unit.length == 1) { //more than one
      return d.LGA;
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
function RunForestRun(mp) {
  mp && mp.open();

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
  } else {
    params = getSearchParameters();
  }

  function fetchComplete(jobsData, progressBar) {
    console.log("Done fetching from beacon, rendering graphs...");
    renderPage(unit, jobsData);
    console.log("Graphs rendered.");
    progressBar &&  progressBar.setValue(1);
    progressBar && progressBar.close();
  }

  if (unit == null) {
    console.log("firstrun...will fetch vars");

    if (typeof params.hq !== 'undefined') { //HQ was sent (so no filter)

      if (params.hq.split(",").length == 1) { //if only one HQ

        GetUnitNamefromBeacon(params.hq, params.host, function(result) {
          unit = result;

          fetchFromBeacon(unit, params.host, fetchComplete, mp);
        });

      } else { //if more than one HQ
        unit = []; 
        console.log("passed array of units");
        var hqsGiven = params.hq.split(",");
        console.log(hqsGiven);
        hqsGiven.forEach(function(d){
          GetUnitNamefromBeacon(d, params.host, function(result) {
            unit.push(result);
            if (unit.length == params.hq.split(",").length) {
              fetchFromBeacon(unit, params.host, fetchComplete, mp);
            }
          });
        });
      }
    } else { //no hq was sent, get them all
      unit = [];
      fetchFromBeacon(unit, params.host, fetchComplete, mp);
    }
  } else {
    console.log("rerun...will NOT fetch vars");
    fetchFromBeacon(unit, params.host, fetchComplete, mp);
  }
}

(function($) {

  $.fn.textWidth = function(){
    var calc = '<span style="display:none">' + $(this).text() + '</span>';
    $('body').append(calc);
    var width = $('body').find('span:last').width();
    $('body').find('span:last').remove();
    return width;
  };

  $.fn.marquee = function(args) {
    var that = $(this);
    var textWidth = that.textWidth(),
        offset = that.width(),
        width = offset,
        css = {
          'text-indent' : that.css('text-indent'),
          'overflow' : that.css('overflow'),
          'white-space' : that.css('white-space')
        },
        marqueeCss = {
          'text-indent' : width,
          'overflow' : 'hidden',
          'white-space' : 'nowrap'
        },
        args = $.extend(true, { count: -1, speed: 1e1, leftToRight: false }, args),
        i = 0,
        stop = textWidth*-1,
        dfd = $.Deferred();

    function go() {
      if(!that.length)
        return dfd.reject();
      if(width == stop) {
        i++;
        if(i == args.count) {
          that.css(css);
          return dfd.resolve();
        }
        if(args.leftToRight) {
          width = textWidth*-1;
        } else {
          width = offset;
        }
      }
      that.css('text-indent', width + 'px');
      if(args.leftToRight) {
        width++;
      } else {
        width--;
      }
      setTimeout(go, args.speed);
    }

    if(args.leftToRight) {
      width = textWidth*-1;
      width++;
      stop = offset;
    } else {
      width--;            
    }
    that.css(marqueeCss);
    go();
    return dfd.promise();
  }

})(jQuery);
