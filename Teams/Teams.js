//add summary button
var bar = document.getElementsByClassName("widget-header");
console.log(bar);


var summarybutton = document.createElement("a");
summarybutton.id = "lighthouseTeamSummaryButton";
summarybutton.classList.add("btn");
summarybutton.classList.add("btn-sm");
summarybutton.classList.add("btn-default");
summarybutton.style.marginLeft = "20px";
summarybutton.style.background = "blue";
summarybutton.style.color = "white";
summarybutton.href = "#"

summarybutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png") + "\">Summary Screen";
bar[0].appendChild(summarybutton);
//




//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/Teams/content/Teams.js');
(document.head || document.documentElement).appendChild(s)

//set the extension code var into the head
var summaryUrl = chrome.extension.getURL("/lighthouse/");
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var summaryUrl = \"" + summaryUrl + "\"";
(document.head || document.documentElement).appendChild(s)

