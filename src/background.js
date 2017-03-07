// This background script is initialised and executed once and exists
// separate to all other pages.


//block message js core request, fetch the file, inject our vars then serve it back to the requestor. :-)
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		var javascriptCode = loadSynchronously(details.url);
		var replaced = "var msgsystem;"+javascriptCode.replace("CreateMessageViewModel,f,t,i,r,u;","CreateMessageViewModel,f,t,i,r,u;msgsystem = n;");
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
	["blocking"]);

//block so that the code can come back before letting the page load
//possibly should rewrite this so its not blocking but that will have ramifications
function loadSynchronously(url) {
	var request = new XMLHttpRequest();
	request.open('GET', url, false);  // `false` makes the request synchronous
	request.send(null);
	if (request.status === 200) {
		return(request.responseText);
	}
}
