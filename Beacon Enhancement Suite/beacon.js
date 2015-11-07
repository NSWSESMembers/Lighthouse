// Checking page title
var ul = document.getElementsByClassName("nav navbar-nav");

var li = document.createElement("li");
li.classList.add("dropdown");

var summaryUrl = chrome.extension.getURL("summary.html");
var settingsUrl = chrome.extension.getURL("options.html"); 


li.innerHTML =     "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\"><span class=\"nav-text admin-nav\">BES</span></a><ul class=\"dropdown-menu\"><li role=\"presentation\" class=\"dropdown-header\">Summary Screens</li><li><a href=\""+summaryUrl+"\">Job Summary Screen</a></li><li role=\"presentation\" class=\"divider\"></li><li><a href=\""+settingsUrl+"\">Options</a></li>";


ul[0].appendChild(li);

