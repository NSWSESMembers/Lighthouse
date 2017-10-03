var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

inject('messages/create.js');

function renderCheckBox() {
	var selected = (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) ? "fa-check-square-o" : "fa-square-o";
	return (
		<span class="pull-right h6">
		<span style="vertical-align:text-top" id="lighthouseEnabled" class={"fa fa-lg "+selected}></span> 
		<img style="width:16px;vertical-align:bottom;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} /> Prefill With Home LHQ & Select Default Recipients
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

var hqTeamsgroup = renderHQTeams()
$(hqTeamsgroup).hide() // hide it untill there is something to show
$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(1)').after(hqTeamsgroup);

function renderHQNitc() {
	return (
		<fieldset id="HQNitcSet">
		<legend><img style="width:16px;vertical-align:baseline;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} />NITC Events At HQ</legend>
		<div class="panel panel-default"  id="lighthousenitcpanel">
		<div class="panel-heading"><span id="nitchq">NITC Events</span><span id="nitccount" class="pull-right badge">0</span></div>
		<div id="lighthousenitc" class="panel-body">
		</div>
		</div>
		</fieldset>
		);
}

var hqNitcgroup = renderHQNitc()
$(hqNitcgroup).hide() // hide it untill there is something to show

$(hqTeamsgroup).after(hqNitcgroup);


function renderCollections() {
	return (
		<fieldset>
		<legend><img style="width:16px;vertical-align:baseline;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} />Lighthouse Recipient Collections</legend>
		<div class="panel panel-default">
		<div class="panel-heading"><span>Lighthouse Recipient Collections</span><span id="collectionscount" class="pull-right badge">0</span></div>
		<div id="lighthousecollections" class="panel-body">
		</div>
		</div>
		</fieldset>
		);
}

$(hqNitcgroup).after(renderCollections);





