var inject = require('../../../lib/inject.js');
var $ = require('jquery');
var xhttp = new XMLHttpRequest();
var DOM = require('jsx-dom-factory');


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
	console.log("Fetching https://beacon.ses.nsw.gov.au/js/messages/create#?"+url);
	xhttp.open("GET", "https://beacon.ses.nsw.gov.au/js/messages/create#?"+url, true);
	xhttp.send();
})




function renderCheckBox() {
	var selected = (localStorage.getItem("LighthouseMessagesEnabled") == "true") ? "fa-check-square-o" : "fa-square-o";
	return (
		<span class="pull-right h6">
		<span id="lighthouseEnabled" class={"fa fa-lg "+selected}></span> 
		<img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
		src={chrome.extension.getURL("icons/lh-black.png")} /> Prefill With LHQ & Default Recipients
		</span>
		);
}


$('#content div.row div.col-md-10.col-lg-9 div fieldset:nth-child(1) legend').append(renderCheckBox);
