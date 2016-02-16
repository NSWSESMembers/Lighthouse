var inject = require('../../../lib/inject.js');
var $ = require('jquery');


var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function() {
	if (xhttp.readyState == 4 && xhttp.status == 200) {
		var result = xhttp.responseText;
		var replaced = result.replace("CreateMessageViewModel,f,t,i,r,u;","CreateMessageViewModel,f,t,i,r,u;msgsystem = n;");
		replaced = "var msgsystem;\n"+replaced;
		var script = document.createElement("script");
		script.innerHTML = replaced;
		document.head.appendChild(script);
		//inject our JS resource
		inject('messages/create.js');
	}
};
xhttp.open("GET", "https://beacon.ses.nsw.gov.au/js/messages/create#?v=icWAQaQuZ4SzREKuZm80jZ-ZIjzHZ9shhwkWjUD-ajM1", true);
xhttp.send();