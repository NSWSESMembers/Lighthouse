// This background script is initialised and executed once and exists
// separate to all other pages.


//block message js core requests
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		return {cancel: true};
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
	["blocking"]);


chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {

		console.log(request)
		if (request.type == "asbestos"){
			checkAsbestosRegister(request.address,function(result,colour){
				sendResponse({result: result, colour: colour})
			})
			return true;
		}
	});


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
	xhttp.onreadystatechange = function(){
		if( this.readyState == 4 && this.status == 200 ){
			if( /Confirmed\sMatch/.test( this.responseText ) ){
				console.log( 'On the Register' );
				cb("Address Has Confirmed Asbestos Contamination","red")
			}else{
				console.log( 'Not the Register' );
				cb("Address Not Found On The Asbestos Register","")
			}
		}
	};
	xhttp.open("GET", formAddress, true);
	xhttp.send();
}
