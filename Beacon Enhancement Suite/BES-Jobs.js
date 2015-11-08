//JOB Screen specific Code

console.log("Job code");
var bar = document.getElementsByClassName("btn-group pull-left text-left");

var button = document.createElement("button");
button.classList.add("btn");
button.classList.add("btn-sm");
button.classList.add("btn-default");
button.style.marginLeft = "20px";
button.style.background = "blue";

button.setAttribute("onclick","BESOpenSummaryScreen()");
button.onclick = "BESOpenSummaryScreen()";

button.innerHTML = "Summary Screen";
bar[0].appendChild(button);


var summaryUrl = chrome.extension.getURL("summary.html");


var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "var summaryUrl = \""+summaryUrl+"\"";
    (document.head || document.documentElement).appendChild(s)



var s = document.createElement('script');
s.src = chrome.extension.getURL('BES-JobsContent.js');
(document.head || document.documentElement).appendChild(s)