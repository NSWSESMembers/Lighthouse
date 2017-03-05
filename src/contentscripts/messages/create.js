var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

var xhttp = new XMLHttpRequest();


xhttp.onreadystatechange = function() {
	if (xhttp.readyState == 4 && xhttp.status == 200) {
		var result = xhttp.responseText;
		var replaced = result.replace("CreateMessageViewModel,f,t,i,r,u;","CreateMessageViewModel,f,t,i,r,u;msgsystem = n;");
		var script = document.createElement("script");
		script.innerHTML = "var msgsystem;"+replaced;
		document.head.appendChild(script);
		//inject our JS resource
		inject('messages/create.js');
	}
};

function findMessageUrl(cb) {
	$('script').each(function(){
		if(this.src.indexOf("/js/messages/create?v=") != -1){
			cb(this.src.replace(/^[^\?]+\??/,''));
		}
	});
}

findMessageUrl(function(url){
	console.log("Fetching "+window.location.origin+"/js/messages/create#?"+url);
	xhttp.open("GET", window.location.origin+"/js/messages/create#?"+url, true);
	xhttp.send();
})




function renderCheckBox() {
	var selected = (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) ? "fa-check-square-o" : "fa-square-o";
	return (
		<span class="pull-right h6">
		<span style="vertical-align:text-top" id="lighthouseEnabled" class={"fa fa-lg "+selected}></span> 
		<img style="width:16px;vertical-align:bottom;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} /> Prefill With LHQ & Select Default Recipients
		</span>
		);
}


$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(1) legend').append(renderCheckBox);


function recipientsButtons() {
	return (
		<div class="panel-footer">
		<button id="recipientsdel" class="btn btn-default">
		<img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh.png")} />
		Remove All Recipients</button>
		<button style="margin-left: 5px" id="collectionsave" class="btn btn-default">
		<img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh.png")} />
		Save As Collection</button>
		</div>
		);
}

$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(2) div.panel.panel-default').append(recipientsButtons);

function renderHQTeams() {
	return (
		<fieldset id="HQTeamsSet" >
		<legend><img style="width:16px;vertical-align:baseline;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} />Teams Attached to HQ</legend>
		<div class="panel panel-default">
		<div class="panel-heading"><span id="teamshq">HQ Teams</span><span id="teamscount" class="pull-right badge">0</span></div>
		<div id="lighthouseteams" class="panel-body">
		</div>
		</div>
		</fieldset>
		);
}

hqgroup = renderHQTeams()
$(hqgroup).hide()


$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(1)').after(hqgroup);

function renderCollections() {
	return (
		<fieldset>
		<legend><img style="width:16px;vertical-align:baseline;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} />Lighthouse Collections</legend>
		<div class="panel panel-default">
		<div class="panel-heading"><span>Lighthouse Collections</span><span id="collectionscount" class="pull-right badge">0</span></div>
		<div id="lighthousecollections" class="panel-body">
		</div>
		</div>
		</fieldset>
		);
}

$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(2)').after(renderCollections);





