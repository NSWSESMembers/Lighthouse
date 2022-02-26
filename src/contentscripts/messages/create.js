var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');
var $ = require('jquery');

inject('messages/create.js');

function renderPrefillCheckBox() {
	console.log(localStorage.getItem("LighthousePrefillLHQEnabled"))
	var selected = (localStorage.getItem("LighthousePrefillLHQEnabled") == "true" || localStorage.getItem("LighthousePrefillLHQEnabled") == null) ? "fa-check-square-o" : "fa-square-o";
	return (
		<span class="pull-right h6">
		<span style="vertical-align:text-top" id="lighthousePrefillEnabled" class={"fa fa-lg "+selected}></span>
		<img style="width:16px;vertical-align:bottom;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} /> Prefill Home LHQ
		</span>
		);
}

$('#content > div > div > div:nth-child(2) fieldset:nth-child(1) legend').append(renderPrefillCheckBox);

function renderRememberReplyCheckBox() {
	var selected = (localStorage.getItem("LighthouseReplyRemember") == "true" || localStorage.getItem("LighthouseReplyRemember") == null) ? "fa-check-square-o" : "fa-square-o";
	return (
		<span class="pull-right h6">
		<span style="vertical-align:text-top" id="lighthouseReplyRemember" class={"fa fa-lg "+selected}></span>
		<img style="width:16px;vertical-align:bottom;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} /> Remember Reply Address
		</span>
		);
}

$('#content > div > div > div:nth-child(2) fieldset:nth-child(6) legend').append(renderRememberReplyCheckBox);

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
$('#content > div > div > div:nth-child(2) fieldset:nth-child(1)').after(hqTeamsgroup);

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

$('#content > div > div > div:nth-child(2) fieldset:nth-child(2)').after(hqNitcgroup);
