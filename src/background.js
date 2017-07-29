// This background script is initialised and executed once and exists
// separate to all other pages.


//Sit Aware Map Data Feeds
const rfsMajorIncidentsFeed = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json"
const transportFeed = "https://api.transport.nsw.gov.au/"
const openSkyFeed = "https://opensky-network.org/api/states/all"

//block message js core request, fetch the file, inject our vars then serve it back to the requestor. :-)
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		console.log("blocking message js request")
		var javascriptCode = loadSynchronously(details.url);
		var replaced = "var msgsystem;"+javascriptCode.replace("CreateMessageViewModel,f,t,i,r,u;","CreateMessageViewModel,f,t,i,r,u;msgsystem = n;");
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
	["blocking"]
	);

//block job create js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		console.log("blocking jobs create js request")
		var javascriptCode = loadSynchronously(details.url);
		var replaced = "var jobsystem;"+javascriptCode.replace("var n=this,t,i;n.MessageTemplateManager","var n=this,t,i;jobsystem=n;n.MessageTemplateManager");
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/jobs/create?v=*"] },
	["blocking"]
	);

//block job register js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
// Reaplce the date picker with more options
chrome.webRequest.onBeforeRequest.addListener(
	function (details) {
		console.log("blocking jobs register js request")
		var javascriptCode = loadSynchronously(details.url);
		var replaced = javascriptCode.replace('"Last Month":[utility.dateRanges.LastMonth.StartDate(),utility.dateRanges.LastMonth.EndDate()]','"Last Month":[utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()],"This Calendar Year":[moment().startOf(\'year\'), moment().endOf(\'year\')],"All":\n [utility.minDate, moment().endOf(\'year\')]');
		return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
	},
	{ urls: ["https://*.ses.nsw.gov.au/js/jobs/register?v=*","https://*.ses.nsw.gov.au/js/jobs/tasking?v=*"] },
	["blocking"]
	);


chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		console.log(request);
		if (request.type === "asbestos") {
			checkAsbestosRegister(request.address,function(result,colour,bool,url){
				sendResponse({result: result, colour: colour, resultbool: bool, requrl: url})
			});
			return true;
		} else if (request.type === 'rfs') {
			fetchRfsIncidents(function(data) {
                sendResponse(data);
            });
            return true;
		} else if (request.type === 'transport-incidents') {
            fetchTransportResource('v1/live/hazards/incident/open', function(data) {
            	sendResponse(data);
			}, request.params.apiKey);
            return true;
		} else if (request.type === 'transport-flood-reports') {
            fetchTransportResource('v1/live/hazards/flood/open', function(data) {
                sendResponse(data);
            }, request.params.apiKey);
            return true;
		} else if (request.type === 'helicopters') {
            fetchHelicopterLocations(request.params, function(data) {
                sendResponse(data);
            });
            return true;
		}
	});

//block so that the code can come back before letting the page load
//possibly should rewrite this so its not blocking but that will have ramifications
function loadSynchronously(url) {
	var request = new XMLHttpRequest();
	request.open('GET', url, false);  // `false` makes the request synchronous
	request.send(null);
	if (request.status === 200) {
		return(request.responseText);
	} else {
		console.log("error downloading resource")
	}
}

/**
 * Fetches the current RFS incidents from their JSON feed.
 *
 * @param callback the callback to send the data to.
 */
function fetchRfsIncidents(callback) {
	console.info('fetching RFS incidents');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            callback(JSON.parse(xhttp.responseText));
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('GET', rfsMajorIncidentsFeed, true);
    xhttp.send();
}

/**
 * Fetches a resource from the transport API.
 *
 * @param path the path to the resource, e.g. ''.
 * @param callback the callback to send the data to.
 * @param apiKey the transport.nsw.gov.au API key.
 */
function fetchTransportResource(path, callback, apiKey) {
    console.info('fetching transport resource: ' + path);
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            callback(JSON.parse(xhttp.responseText));
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('GET', transportFeed + path, true);
    xhttp.setRequestHeader('Authorization', 'apikey ' + apiKey);
    xhttp.send();
}

/**
 * Fetches the current rescue helicopter locations.
 *
 * @param params the HTTP URL parameters to add.
 * @param callback the callback to send the data to.
 */
function fetchHelicopterLocations(params, callback) {
    console.info('fetching helicopter locations');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            callback(JSON.parse(xhttp.responseText));
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('GET', openSkyFeed + params, true);
    xhttp.send();
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

	console.log("loading cache")
	var ftCache = JSON.parse(localStorage.getItem("lighthouseFTCache"));
	var needToWriteChange = false;
	if (ftCache) {

		//walk the cache and clean it up first
		
		var foundinCache = false
		ftCache.forEach(function(item) {

			if (item.url == formAddress)
			{
				console.log("found url in the cache")
				foundinCache = true
				console.log( 'cache is '+((new Date().getTime() - new Date(item.timestamp).getTime())/1000/60)+'mins old')
				if (((new Date().getTime() - new Date(item.timestamp).getTime())/1000/60) < 4320) //3 days
				{
						//its in the cache
						console.log( 'using it');
						processResult(item.result)
					} else {
						//oooooold
						console.log("cached item is stale. fetching new result")
						ftCache.splice(ftCache.indexOf(item),1) //remove this item from the cache
						needToWriteChange = true
						pullFTRegister(function(result){
							if (result != 0) //dont cache error results
							{
								var cacheItem = {}
								cacheItem.url = formAddress
								cacheItem.timestamp = (new Date().toString())
								cacheItem.result = result
								ftCache.push(cacheItem)
								needToWriteChange = true
							}
							//return result
							processResult(result)

						})

					}
				} else {
					if (((new Date().getTime() - new Date(item.timestamp).getTime())/1000/60) > 4320) //3 days
					{
						console.log("cleaning stale cache item "+item.url+" age:"+((new Date().getTime() - new Date(item.timestamp).getTime())/1000/60)+'mins old')
		ftCache.splice(ftCache.indexOf(item),1) //remove this item from the cache
		needToWriteChange = true
	}
}
})

if (foundinCache == false)
{
	console.log("did not find url in the cache")
	pullFTRegister(function(result){
		if (result != 0) //dont cache error results
		{
			var cacheItem = {}
			cacheItem.url = formAddress
			cacheItem.timestamp = (new Date().toString())
			cacheItem.result = result
			ftCache.push(cacheItem)
			needToWriteChange = true
		}
		//return result
		processResult(result)
	})
}
} else {
	//there is no cache so make one
	console.log("no cache object. creating a new one")
	var ftCache = []
	pullFTRegister(function(result){
		if (result != 0) //dont cache error results
		{
			var cacheItem = {}
			cacheItem.url = formAddress
			cacheItem.timestamp = (new Date().toString())
			cacheItem.result = result
			ftCache.push(cacheItem)
			needToWriteChange = true
		}
		//return result
		processResult(result)

	})
}

//if we never call processResult we should write the changes out here.
if (needToWriteChange)
{
	console.log("writing out lighthouseFTCache")
	localStorage.setItem("lighthouseFTCache", JSON.stringify(ftCache));
}


function processResult(result){
	switch(result) {
		case 0: //error
		console.log( 'Error searching' );
		cb("Error Searching The Asbestos Register<i class='fa fa-external-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>","",false,formAddress)
		break
		case 1: //positive/found
		console.log( 'On the Register' );
		cb(inAddressObject.PrettyAddress+" was FOUND on the loose fill insulation asbestos register<i class='fa fa-external-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>","red",true,formAddress)
		break
		case 2: //negative/not found
		console.log( 'Not the Register' );
		cb(inAddressObject.PrettyAddress+" was not found on any register.","",false,formAddress)
		break
	}
	if (needToWriteChange)
	{
		needToWriteChange = false;
		console.log("writing out lighthouseFTCache")
		localStorage.setItem("lighthouseFTCache", JSON.stringify(ftCache));
	}
}


function pullFTRegister(cb){
	var xhttp = new XMLHttpRequest();
	xhttp.onloadend = function(){
		if( this.readyState == 4 && this.status == 200 ){
			if (!( /No\sMatch\sFound/.test( this.responseText ) ) && !( /Confirmed\sMatch/.test( this.responseText ))){
				cb(0) //error
			}
			if( /Confirmed\sMatch/.test( this.responseText ) ){
				cb(1) //found
			}
			if( /No\sMatch\sFound/.test( this.responseText ) ){
				cb(2) //not found
			}
		} else {
			cb(0) //error
		}
	};
	xhttp.open("GET", formAddress, true);
	xhttp.send();
}

}
