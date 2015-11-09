//JOB Screen specific Code

console.log("Job code");
var bar = document.getElementsByClassName("btn-group pull-left text-left");
console.log(bar);
var summarybutton = document.createElement("button");
summarybutton.classList.add("btn");
summarybutton.classList.add("btn-sm");
summarybutton.classList.add("btn-default");
summarybutton.style.marginLeft = "20px";
summarybutton.style.background = "blue";

summarybutton.setAttribute("onclick","BESOpenSummaryScreen()");
summarybutton.onclick = "BESOpenSummaryScreen()";

summarybutton.innerHTML = "<img width=\"16px\" style=\"vertical-align: top\" src=\""+chrome.extension.getURL("tv.png")+"\"> Summary Screen";
bar[0].appendChild(summarybutton);



var summaryUrl = chrome.extension.getURL("summary.html");


var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "var summaryUrl = \""+summaryUrl+"\"";
    (document.head || document.documentElement).appendChild(s)



var s = document.createElement('script');
s.src = chrome.extension.getURL('BES-JobsContent.js');
(document.head || document.documentElement).appendChild(s)