//NITC Screen specific Code
//add export button
var bar = document.getElementsByClassName("btn-group pull-left text-left");

var exportbutton = document.createElement("a");
exportbutton.id = "lighthouseExportButton";
exportbutton.classList.add("btn");
exportbutton.classList.add("btn-sm");
exportbutton.classList.add("btn-default");
exportbutton.style.marginLeft = "20px";
exportbutton.style.background = "#d2322d";
exportbutton.style.borderColor = "#edadab";
exportbutton.style.color = "white";
exportbutton.href = "#"

exportbutton.innerHTML = "<img width='16px' style='width:16px;vertical-align: top;margin-right:5px' src='" + chrome.extension.getURL("lh.png") + "'>Export (Filtered)";
bar[0].appendChild(exportbutton);

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/nitc/content/nitc.js');
(document.head || document.documentElement).appendChild(s)
