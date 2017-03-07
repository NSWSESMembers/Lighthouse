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
	["blocking"]
);

//block job create js core requests
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		var javascriptCode = loadSynchronously(details.url);
		var replaced = "var jobsystem;"+javascriptCode.replace("var n=this,t,i;n.MessageTemplateManager","var n=this,t,i;jobsystem=n;n.MessageTemplateManager");
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/jobs/create?v=*"] },
	["blocking"]
);


chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		console.log(request)
		if (request.type == "asbestos"){
			checkAsbestosRegister(request.address,function(result,colour,bool,url){
				sendResponse({result: result, colour: colour, resultbool: bool, requrl: url})
			})
			return true;
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


function checkAsbestosRegister( inAddressObject, cb ){
	var AddressParts = /^(.+)\s(.+)$/.exec( inAddressObject.Street );
	if( !inAddressObject.Flat )
		inAddressObject.Flat = "";
	var formAddress = "http://www.fairtrading.nsw.gov.au/ftw/Tenants_and_home_owners/Loose_fill_asbestos_insulation/Public_Search/LFAI_Public_Register.page?"+
	"idol_totalhits=0&currentPage=1&"+
	"form-unit="+encodeURI(inAddressObject.Flat)+"&"+
	"form-streetno="+encodeURI(inAddressObject.StreetNumber)+"&"+
	"form-street="+encodeURI(AddressParts[1])+"&"+
	"form-streettype="+encodeURI(AddressParts[2])+"&"+
	"form-suburb="+encodeURI(inAddressObject.Locality)+"&"+
	"propertyaddress=Property%3A%28"+encodeURI(inAddressObject.Flat+" "+inAddressObject.StreetNumber+" "+inAddressObject.Street+" "+inAddressObject.Locality)+"%29";

	var xhttp = new XMLHttpRequest();
	xhttp.onloadend = function(){
		if( this.readyState == 4 && this.status == 200 ){
			if (!( /No\sMatch\sFound/.test( this.responseText ) ) && !( /Confirmed\sMatch/.test( this.responseText ))){
				console.log( 'Error searching' );
				cb("Error Searching The Asbestos Register<i class='fa fa-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>","",false,formAddress)
			}
			if( /Confirmed\sMatch/.test( this.responseText ) ){
				console.log( 'On the Register' );
				cb(inAddressObject.PrettyAddress+" Is On Loose Fill Asbestos Register<i class='fa fa-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>","red",true,formAddress)
			}
			if( /No\sMatch\sFound/.test( this.responseText ) ){
				console.log( 'Not the Register' );
				cb(inAddressObject.PrettyAddress+" Was Not Found On The Loose Fill Asbestos Register<i class='fa fa-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>","",false,formAddress)
			}
		} else {
			console.log( 'Error searching' );
			cb("Error Searching The Asbestos Register","",false,formAddress)
		}
	};
	xhttp.open("GET", formAddress, true);
	xhttp.send();
}
