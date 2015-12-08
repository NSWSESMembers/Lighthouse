var inject = require('../../../lib/inject.js');

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
summarybutton.href = "#";

summarybutton.innerHTML = "<img width='16px' style='width:16px;vertical-align: top;margin-right:5px' src='" + chrome.extension.getURL("icons/lh.png") + "'>Summary Screen";
bar[0].appendChild(summarybutton);

//inject our JS resource
inject('teams/teams.js');
