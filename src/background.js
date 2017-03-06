// This background script is initialised and executed once and exists
// separate to all other pages.


//block message js core requests
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		var javascriptCode = loadSynchronously(details.url);
		var replaced = "var msgsystem;"+javascriptCode.replace("CreateMessageViewModel,f,t,i,r,u;","CreateMessageViewModel,f,t,i,r,u;msgsystem = n;");
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
	["blocking"]);


chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {

		console.log(request)
		if (request.type == "asbestos") {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (xhr.readyState == XMLHttpRequest.DONE) {
					alert(xhr.responseText);
					sendResponse({result: xhr.responseText});

				}
			}
			xhr.open('GET', 'http://www.fairtrading.nsw.gov.au/ftw/Tenants_and_home_owners/Loose_fill_asbestos_insulation/Public_Search/LFAI_Public_Register.page', true);
			xhr.send(null);

		}
	});

function loadSynchronously(url) {
	var request = new XMLHttpRequest();
	request.open('GET', url, false);  // `false` makes the request synchronous
	request.send(null);
	if (request.status === 200) {
		return(request.responseText);
	}
}
