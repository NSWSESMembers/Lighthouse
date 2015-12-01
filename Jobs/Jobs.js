//JOB Screen specific Code
//add summary button
var bar = document.getElementsByClassName("btn-group pull-left text-left");



var summarybutton = document.createElement("a");
summarybutton.id = "lighthouseSummaryButton";
summarybutton.classList.add("btn");
summarybutton.classList.add("btn-sm");
summarybutton.classList.add("btn-default");
summarybutton.style.marginLeft = "20px";
summarybutton.style.background = "blue";
summarybutton.style.color = "white";
summarybutton.href = "#"

summarybutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png") + "\">Summary (Filtered)";
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

statsbutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png") + "\">Statistics (Filtered)";
bar[0].appendChild(statsbutton);

var exportbutton = document.createElement("a");
exportbutton.id = "lighthousExportButton";
exportbutton.classList.add("btn");
exportbutton.classList.add("btn-sm");
exportbutton.classList.add("btn-default");
exportbutton.style.marginLeft = "20px";
exportbutton.style.background = "#B80000";
exportbutton.style.color = "white";
exportbutton.href = "#"

exportbutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh.png") + "\">Advanced Export (Filtered)";
bar[0].appendChild(exportbutton);

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/Jobs/content/Jobs.js');
(document.head || document.documentElement).appendChild(s)

