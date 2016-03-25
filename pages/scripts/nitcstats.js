var nitc = require('../lib/shared_nitc_code.js');
var $ = require('jquery');
global.jQuery = $;
var ElasticProgress = require('elastic-progress');
var d3 = require('d3');
var dc = require('dc');
var crossfilter = require('crossfilter');

// inject css c/o browserify-css
require('../styles/stats.css');

var timeoverride = null;

window.onerror = function(message, url, lineNumber) {
  document.getElementById("loading").style.visibility = 'visible';
  document.getElementById("loading").innerHTML = "Error loading page<br>"+message+" Line "+lineNumber;
  return true;
}; 

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
     $('footer').show();
   }
 });

 // main
  RunForestRun(mp)
});

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
var unit = [];

var params = getSearchParameters();

//Get times vars for the call
function RunForestRun(mp) {
  mp && mp.open();
  document.getElementById("loading").style.visibility = 'visible';
  HackTheMatrix(mp); // expand to include NonIncidentTypeIds, IncludeCompleted - params is global
}

//make the call to beacon
function HackTheMatrix(progressBar) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var activities = [];
  var activitiesExpanded = [];  // Dup activities with multiple tags

  nitc.get_json(params, start, end, function(nitcs) {
    nitcs.Results.map(function(d){
        var rObj = {};
        var numParticipants = 0;
        var totalHours = 0;
        var rawSdate = new Date(d.StartDate);
        startDateFixed = new Date(rawSdate.getTime() + ( rawSdate.getTimezoneOffset() * 60000 ));
        d.Participants.map(function(p) {
            numParticipants++;
            var hours = parseFloat((Math.abs(new Date(p.EndDate) - new Date(p.StartDate)) / 36e5).toFixed(2));
            totalHours += hours;
        });
	rObj["Type"] = d.Type.Name.trim();
        rObj["Name"] = d.Name;
        rObj["StartDate"] = startDateFixed;
        rObj["Unit"] = d.CreatedAt.Code;
        rObj["TotalParticipants"] = numParticipants;
        rObj["TotalHours"] = totalHours;
	var tags = d.Tags.map(function(t) {
		var rObjI = jQuery.extend(true, {}, rObj);
		rObjI["Tag"] = t.Name;
		activitiesExpanded.push(rObjI);		// Individual copy for each tag
		return t.Name;
	}).join(",");
        rObj["Tags"] = tags;
        activities.push(rObj);
    });
    
    progressBar.setValue(1);
    progressBar.close();
    prepareData(activities, activitiesExpanded, start, end);
    dc.renderAll();

  }, function(val,total){
    progressBar.setValue(val/total);
  });
}

// Prepare & build the charts
function prepareData(activities, activitiesExpanded, start, end) {
  var timeOpts = {weekday: "short", year: "numeric", month: "2-digit", day: "numeric", hour12: false};
  // Page headings
  document.title = "NITC Statistics";
  $('.stats header h2').text('NITC statistics');
  $('.stats header h4').text(
    start.toLocaleDateString("en-au", timeOpts) + " to " +
      end.toLocaleDateString("en-au", timeOpts)
    );

  // Pie charts
  var ndx = crossfilter(activities);
  var typeDimension = ndx.dimension(function(a) {return a.Type;});
  var typeGroup = typeDimension.group().reduceSum(function(a) {return a.TotalHours;});
  var typeChart = makePie("#dc-type-chart", 300, 300, typeDimension, typeGroup);

  var ndx = crossfilter(activitiesExpanded);
  var typeDimension = ndx.dimension(function(a) {return a.Type;});
  var train = typeDimension.filter("Training");
  var trainingDimension = ndx.dimension(function(a) {
	return (a.Tag);
  });
  var trainingGroup = trainingDimension.group().reduceSum(function(a) {
        return (a.TotalHours);
  });
  var trainingChart = makePie("#dc-training-chart", 300, 300, trainingDimension, trainingGroup);

  var ndx2 = crossfilter(activitiesExpanded);
  var typeDimension = ndx2.dimension(function(a) {return a.Type;});
  var other = typeDimension.filter("Other");
  var otherDimension = ndx2.dimension(function(a) {
        return (a.Tag);
  });
  var otherGroup = otherDimension.group().reduceSum(function(a) {
        return (a.TotalHours);
  });
  var otherChart = makePie("#dc-other-chart", 300, 300, otherDimension, otherGroup);

  // Bar charts
  var ndx3 = crossfilter(activitiesExpanded);
  var typeDimension = ndx3.dimension(function(a) {return a.Type;});
  var train = typeDimension.filter("Training");
  var timeDimension = ndx3.dimension(function(a) {
	return d3.time.day(a.StartDate);
  });
  var trainTimeGroup = timeDimension.group().reduceSum(function(a) {
        return (a.TotalHours);
  });
  var trainingTimeChart = makeBar("#dc-traintime-chart", 600, 300, timeDimension, trainTimeGroup, start, end);

  var ndx4 = crossfilter(activities);
  var typeDimension = ndx4.dimension(function(a) {return a.Type;});
  var other = typeDimension.filter("Other");
  var timeDimension = ndx4.dimension(function(a) {
        return d3.time.day(a.StartDate);
  });
  var otherTimeGroup = timeDimension.group().reduceSum(function(a) {
        return a.TotalHours;
  });
  var otherTimeChart = makeBar("#dc-othertime-chart", 600, 300, timeDimension, otherTimeGroup, start, end);
}

// Make a pie chart
function makePie(elem, w, h, dimension, group) {
  var pc = dc.pieChart(elem);
  pc.width(w)
  .height(h)
  .radius(100)
  .innerRadius(0)
  .dimension(dimension)
  .legend(dc.legend().x(50).y(250))
  .group(group)
  .data(function(group) {
	return group.all().filter(function(kv) {return kv.value > 0;});
  })
  .renderLabel(false);
  return pc;
}

// Make a bar chart
function makeBar(elem, w, h, dimension, group, start, end) {
  var bc = dc.barChart(elem);
  bc.width(w)
  .height(h)
  .brushOn(true)
  .dimension(dimension)
  .group(group)
  .x(d3.time.scale().domain([new Date(start), new Date(end)]))
  .xUnits(d3.time.days)
  .elasticY(true)
  .xAxis();
  return bc;
}
