// Checking page title
var ul = document.getElementsByClassName("nav navbar-nav");

var li = document.createElement("li");
li.classList.add("dropdown");

var popupUrl = chrome.extension.getURL("summary.html"); 

li.innerHTML =     "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\"><span class=\"nav-text admin-nav\">BES</span></a><ul class=\"dropdown-menu\"><li role=\"presentation\" class=\"dropdown-header\">Summary Screens</li><li><a href=\""+popupUrl+"\">Job Summary Screen</a></li></ul>";


ul[0].appendChild(li);
