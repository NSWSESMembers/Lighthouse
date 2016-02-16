var inject = require('../../../lib/inject.js');
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
xhttp.open("GET", "https://beacon.ses.nsw.gov.au/js/messages/create#", true);
xhttp.send();