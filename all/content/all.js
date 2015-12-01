
var waiting = setInterval(function(){ //run every 1sec until we have loaded the page (dont hate me Sam)

if (typeof user != "undefined")
{
clearInterval(waiting); //stop timer
var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            results = JSON.parse(xhttp.responseText);
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


var vars = "?host="+location.hostname+"&hq="+user.currentHqId+"&start="+encodeURIComponent(thismorning.toISOString())+"&end="+encodeURIComponent(tonight.toISOString());

var jobsummaryUrl = lighthouseUrl+"lighthouse/summary.html"+vars;
var jobstatsUrl = lighthouseUrl+"lighthouse/stats.html"+vars; 
var jobexportUrl = lighthouseUrl+"lighthouse/advexport.html"+vars;

var teamsummaryUrl = lighthouseUrl+"lighthouse/teamsummary.html"+vars; 

var aboutURL = "https://github.com/OSPFNeighbour/Lighthouse/blob/master/README.md"//chrome.extension.getURL("lighthouse/about.html");


li.innerHTML =     "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\"><span class=\"nav-text\"><img width=\"16px\" style=\"vertical-align: text-bottom;margin-right:5px\" src=\"" + lighthouseUrl+"lh.png"+"\">Lighthouse</span></a><ul class=\"dropdown-menu\"><li role=\"presentation\" class=\"dropdown-header\">Jobs</li><li><a href=\""+jobsummaryUrl+"\">Job Summary ("+results.Code+" Today)</a></li><li><a href=\""+jobstatsUrl+"\">Job Statistics ("+results.Code+" Today)</a></li><li><a href=\""+jobexportUrl+"\">Job Export ("+results.Code+" Today)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">Teams</li><li><a href=\""+teamsummaryUrl+"\">Team Summary ("+results.Code+" Today)</a></li><li role=\"presentation\" class=\"divider\"></li><li role=\"presentation\" class=\"dropdown-header\">About</li><li><a href=\""+aboutURL+"\">About Lighthouse</a></li>";


ul[0].appendChild(li);




        }
    }

    xhttp.open("GET", "https://"+location.hostname+"/Api/v1/Entities/" + user.currentHqId, true);
    xhttp.send();



}

}, 1000)