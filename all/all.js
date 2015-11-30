// notify keep alive system that a new page has been loaded (and therefore the
// user's session has been refreshed)
console.log("telling the keep alive system we are still active")
chrome.runtime.sendMessage({activity: true});

// notify keep alive system whenever we click on something. We let the event
// propagate because we don't want to interfere with regular operation of <a>
$('a').click(function(e) {
  chrome.runtime.sendMessage({activity: true});
});

// inject JS that is to run on every page in page context
$.getScript(chrome.extension.getURL('/all/content/all.js'));

// // attach a Lighthouse stamp bottom right
// imageUrl = chrome.extension.getURL("lighthouse40.png");
// $('body').css('background-image', 'url(' + imageUrl + ')')
//          .css('background-repeat', 'no-repeat')
//          .css('background-attachment', 'fixed')
//          .css('background-position', 'right bottom');



var ul = document.getElementsByClassName("nav navbar-nav");

var li = document.createElement("li");
li.classList.add("dropdown");

var tonight = new Date();

tonight = new Date(tonight.getTime() + ( tonight.getTimezoneOffset() * 60000 )); //DST offset because beacon has stupid times

tonight.setHours(23,59,59,0);


var thismorning = new Date();
thismorning.setDate(thismorning.getDate()); //then

thismorning = new Date(thismorning.getTime() + ( thismorning.getTimezoneOffset() * 60000 )); //DST offset because beacon has stupid times

thismorning.setHours(0,0,0,0);


var vars = "?host="+location.hostname+"&start="+encodeURIComponent(thismorning.toISOString())+"&end="+encodeURIComponent(tonight.toISOString());

var jobsummaryUrl = chrome.extension.getURL("lighthouse/summary.html"+vars);
var jobstatsUrl = chrome.extension.getURL("lighthouse/stats.html"+vars); 
var jobexportUrl = chrome.extension.getURL("lighthouse/advexport.html"+vars);

var teamsummaryUrl = chrome.extension.getURL("lighthouse/teamsummary.html"+vars); 

var aboutURL = "https://github.com/OSPFNeighbour/Lighthouse/blob/master/README.md"//chrome.extension.getURL("lighthouse/about.html");


li.innerHTML =     "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\"><span class=\"nav-text\"><img width=\"16px\" style=\"vertical-align: text-bottom;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png")+"\">Lighthouse</span></a><ul class=\"dropdown-menu\"><li role=\"presentation\" class=\"dropdown-header\">Jobs</li><li><a href=\""+jobsummaryUrl+"\">Job Summary (NSW)</a></li><li><a href=\""+jobstatsUrl+"\">Job Statistics (NSW)</a></li><li><a href=\""+jobexportUrl+"\">Job Export (NSW)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">Teams</li><li><a href=\""+teamsummaryUrl+"\">Team Summary (NSW)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">About</li><li><a href=\""+aboutURL+"\">About Lighthouse</a></li>";


ul[0].appendChild(li);