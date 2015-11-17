//JOB Screen specific Code
//add summary button
var bar = document.getElementsByClassName("btn-group pull-left text-left");
console.log(bar);


var summarybutton = document.createElement("a");
summarybutton.id = "lighthouseSummaryButton";
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

var statsbutton = document.createElement("a");
statsbutton.id = "lighthouseStatsButton";
statsbutton.classList.add("btn");
statsbutton.classList.add("btn-sm");
statsbutton.classList.add("btn-default");
statsbutton.style.marginLeft = "20px";
statsbutton.style.background = "rebeccapurple";
statsbutton.style.color = "white";
statsbutton.href = "#"

statsbutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png") + "\">Statistics Screen";
bar[0].appendChild(statsbutton);



//set the extension code var into the head
var summaryUrl = chrome.extension.getURL("");
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var summaryUrl = \"" + summaryUrl + "\"";
(document.head || document.documentElement).appendChild(s)



//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('lighthouse-JobsContent.js');
(document.head || document.documentElement).appendChild(s)

