// This background script is initialised and executed once and exists
// separate to all other pages.

var tj = require('@mapbox/togeojson');


  // Check whether new version is installed
chrome.runtime.onInstalled.addListener(function(details){
    const reason = details.reason
       switch (reason) {
          case 'install':
             console.log('New User installed the extension.')
             chrome.tabs.create({ url: 'https://lighthouse.ses.nsw.gov.au/#whatsnew' });
             break;
          case 'update':
             console.log('User has updated their extension.')
             chrome.tabs.create({ url: 'https://lighthouse.ses.nsw.gov.au/#whatsnew' });
             break;
          case 'chrome_update':
          case 'shared_module_update':
          default:
             console.log('Other install events within the browser')
             break;
       }
});


//Sit Aware Map Data Feeds
const rfsMajorIncidentsFeed = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json";
const transportFeed = "https://api.transport.nsw.gov.au/";
const openSkyFeed = "https://opensky-network.org/api/states/all";
const essentialEnergyOutagesFeed = 'https://www.essentialenergy.com.au/Assets/kmz/current.kml';
const endeavourEnergyOutagesFeed = 'https://www.endeavourenergy.com.au/mobileapp/outage/outages/listBoth/current';
const ausgridBaseUrl = 'https://www.ausgrid.com.au/';

//external libs

//block message js core request, fetch the file, inject our vars then serve it back to the requestor. :-)
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        let replaced;
        console.log("blocking message js request")
        var javascriptCode = loadSynchronously(details.url);
        if (javascriptCode.includes("CreateMessageViewModel,t;")) {
          replaced = "var msgsystem;"+javascriptCode.replace("CreateMessageViewModel,t;","CreateMessageViewModel,t;msgsystem = n;");
          return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
        } else if (javascriptCode.includes("var viewModel = new CreateMessageViewModel();")) {
          replaced = "var msgsystem;\r\n"+javascriptCode.replace("var viewModel = new CreateMessageViewModel();","var viewModel = new CreateMessageViewModel();\r\nmsgsystem = viewModel;");
          return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
        }

    },
    { urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
    ["blocking"]
    );

//block job create js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        let replaced;
        console.log("blocking jobs create js request")
        var javascriptCode = loadSynchronously(details.url);
        if (javascriptCode.includes("var n=this,t,i;n.MessageTemplateManager")) {
        replaced = "var jobsystem;"+javascriptCode.replace("var n=this,t,i;n.MessageTemplateManager","var n=this,t,i;jobsystem=n;n.MessageTemplateManager");
        return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
      } else if (javascriptCode.includes("vm = new CreateJobViewModel();")) {
        replaced = "var jobsystem;\r\n"+javascriptCode.replace("vm = new CreateJobViewModel();","vm = new CreateJobViewModel();\r\njobsystem=vm;");
        return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
      }
    },
    { urls: ["https://*.ses.nsw.gov.au/js/jobs/create?v=*"] },
    ["blocking"]
    );

//block job register js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
// Reaplce the date picker with more options
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        let replaced;
        console.log("blocking jobs register js request")
        var javascriptCode = loadSynchronously(details.url);
        if (javascriptCode.includes('"Last Month":[utility.dateRanges.LastMonth.StartDate(),utility.dateRanges.LastMonth.EndDate()]')) {
        replaced = javascriptCode.replace('"Last Month":[utility.dateRanges.LastMonth.StartDate(),utility.dateRanges.LastMonth.EndDate()]','"Last Month":[utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()],"This Calendar Year":[moment().startOf(\'year\'), moment().endOf(\'year\')],"All":\n [utility.minDate, moment().endOf(\'year\')]');
        return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
      } else if (javascriptCode.includes("'Last Month': [utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()]")) {
        replaced = javascriptCode.replace("'Last Month': [utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()]",'"Last Month":[utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()],"This Calendar Year":[moment().startOf(\'year\'), moment().endOf(\'year\')],"All":\n [utility.minDate, moment().endOf(\'year\')]');
        return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
      }
    },
    { urls: ["https://*.ses.nsw.gov.au/js/jobs/register?v=*","https://*.ses.nsw.gov.au/js/jobs/tasking?v=*"] },
    ["blocking"]
    );

//block tasking  js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
// Reaplce the date picker with more options
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        console.log("blocking teams register js request")
        var javascriptCode = loadSynchronously(details.url);
        var replaced = javascriptCode.replace('"Last Month":[utility.dateRanges.LastMonth.StartDate(),utility.dateRanges.LastMonth.EndDate()]','"Last Month":[utility.dateRanges.LastMonth.StartDate(), utility.dateRanges.LastMonth.EndDate()],"This Calendar Year":[moment().startOf(\'year\'), moment().endOf(\'year\')],"All":\n [utility.minDate, moment().endOf(\'year\')]');
        return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
    },
    { urls: ["https://*.ses.nsw.gov.au/js/teams/index?v=*","https://*.ses.nsw.gov.au/js/teams/index?v=*"] },
    ["blocking"]
    );


    //block team create js core requests, fetch the original file async, replace some stuff, serve the file back to the requestor.
    chrome.webRequest.onBeforeRequest.addListener(
        function (details) {
            let replaced;
            console.log("blocking team create js request")
            var javascriptCode = loadSynchronously(details.url);
            if (javascriptCode.includes("var n=new TeamViewModel;")) {
            replaced = "var vm;"+javascriptCode.replace("var n=new TeamViewModel;","var n=new TeamViewModel;vm=n;");
            return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
          } else if (javascriptCode.includes("var vm = new TeamViewModel();")) {
            replaced = "var vm;"+javascriptCode.replace("var vm = new TeamViewModel();","vm = new TeamViewModel();");
            return { redirectUrl: "data:text/javascript,"+encodeURIComponent(replaced) };
          }
        },
        { urls: ["https://*.ses.nsw.gov.au/js/teams/create?v=*"] },
        ["blocking"]
        );


chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.type === "asbestos") {
            checkAsbestosRegister(request.address,function(result,colour,bool,url){
                sendResponse({result: result, colour: colour, resultbool: bool, requrl: url})
            });
            return true;
        } else if (request.type === 'API_TOKEN_UPDATE') {
          localStorage.setItem('beaconAPIToken-'+request.host, JSON.stringify(request.token));
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
        } else if (request.type === 'transport-cameras') {
            fetchTransportResource('v1/live/cameras', function(data) {
                sendResponse(data);
            }, request.params.apiKey);
            return true;
        } else if (request.type === 'helicopters') {
            fetchHelicopterLocations(request.params, function(data) {
                sendResponse(data);
            });
            return true;
        } else if (request.type === 'power-outages') {
            fetchPowerOutages(function(data) {
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

/**
 * Fetches the current power outage details.
 *
 * @param callback the callback to send the data to.
 */
 function fetchPowerOutages(callback) {
    console.info('fetching power outage locations');
    var finalData = {}

    fetchEssentialEnergyOutages(function(essentialEnergyData) {
        finalData.essential = essentialEnergyData
        merge("EssentialEnergy")
    })

    fetchEndeavourEnergyOutages(function(endeavourEnergyData) {
        finalData.endeavour = endeavourEnergyData
        merge("EndeavourEnergy")
    })

    fetchAusgridOutages(function(AusgridData){
        finalData.ausgrid = AusgridData
        merge("Ausgrid")
    });



    function merge(name) {
        console.log(name+" is back," +"checking if all power outage data is back")
        if (finalData.essential && finalData.endeavour && finalData.ausgrid)
        {
            console.log("merging all power outages")
            var merged = {}
            merged.features = []
            //if you just push you end up with an array of the array not a merged array like you might want.
            merged.features.push.apply(merged.features,finalData.essential.features)
            merged.features.push.apply(merged.features,finalData.endeavour.features)
            merged.features.push.apply(merged.features,finalData.ausgrid.features)
            callback(merged);
        } else {
            console.log("missing some power outage data")
        }
    }
}

/**
 * Fetches the current power outages for Ausgrid.
 *
 * @param callback the callback to send the data to.
 */
 function fetchAusgridOutages(callback) {
    console.info('fetching ausgrid power outage locations');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            let ausgridGeoJson = {
                'type': 'FeatureCollection',
                'features': []
            };

            var result = JSON.parse(xhttp.responseText)

            var expectCount = 0

            result.d.Data.forEach(function(item) {
                if (item.WebId != 0)
                {
                    expectCount++
                }
            })

            if (expectCount == 0) //call back if theres none.
            {
                callback(ausgridGeoJson)
            }

            result.d.Data.forEach(function(item) {
                if (item.WebId != 0)
                {
                    //build up some geojson from normal JSON
                    var feature = {}
                    feature.geometry = {}
                    feature.geometry.type = "GeometryCollection"
                    feature.geometry.geometries = []

                    //make a polygon from each set
                    var polygon = {}
                    polygon.type = "Polygon"
                    polygon.coordinates = []

                    var ords = []
                    item.Coords.forEach(function(point){
                        ords.push([point.lng,point.lat])
                    })

                    ords.push([item.Coords[0].lng,item.Coords[0].lat]) //push the first item again at the end to complete the polygon

                    polygon.coordinates.push(ords)

                    feature.geometry.geometries.push(polygon)

                    //make a point to go with the polygon //TODO - center this in the polygon - geo maths centroid
                    var point = {}
                    point.type = "Point"
                    point.coordinates = []
                    point.coordinates.push(item.Coords[0].lng,item.Coords[0].lat)

                    feature.geometry.geometries.push(point)

                    fetchAusgridOutage(item.WebId,item.OutageDisplayType, function(outageresult){ //for each outage ask their API for the deatils of the outage
                        if (typeof(outageresult.error) === 'undefined') //if no error
                        {
                            feature.owner = "Ausgrid"
                            feature.type = "Feature"
                            feature.properties = {}
                            feature.properties.numberCustomerAffected = outageresult.d.Data.Customers
                            feature.properties.incidentId = outageresult.d.Data.WebId
                            feature.properties.reason = outageresult.d.Data.Cause
                            feature.properties.status = outageresult.d.Data.Status
                            feature.properties.type = "Outage"
                            feature.properties.startDateTime = outageresult.d.Data.StartDateTime
                            feature.properties.endDateTime = outageresult.d.Data.EstRestTime
                            ausgridGeoJson.features.push(feature)
                        } else {
                            expectCount--
                        }
                        if (ausgridGeoJson.features.length == expectCount) //return once all the data is back
                        {
                            callback(ausgridGeoJson)
                        }
                    })
}
})
} else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('POST', ausgridBaseUrl + 'services/Outage/Outage.asmx/GetOutages', true);
    xhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    var blob = new Blob(['{"box":{"bottomleft":{"lat":-33.77499909311501,"lng":149.5178374449364},"topright":{"lat":-33.08275780283044,"lng":152.50337211290514},"zoom":9}}'], {type: 'text/plain'});
    xhttp.send(blob);
}

/**
 * Fetche Ausgrid power outage detail.
 * @param webId web ID
 * @param type OutageDisplayType
 * @param callback the callback to send the data to.
 */
 function fetchAusgridOutage(id,type,callback) {
    console.info('fetching ausgrid power outage detail');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            let json;
            try {
                json = JSON.parse(xhttp.responseText);
            } catch(err) {
                console.log("ausgrid feed is invalid. discarding")
                json = []

            }
            callback(json)
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('POST', ausgridBaseUrl + 'services/Outage/Outage.asmx/GetOutage', true);
    xhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    var blob = new Blob(['{"id":{"WebId":"'+id+'","OutageDisplayType":"'+type+'"}}'], {type: 'text/plain'});
    xhttp.send(blob);
}


/**
 * Fetches the current power outages for Endeavour Energy.
 *
 * @param callback the callback to send the geoJSON data to.
 */
 function fetchEndeavourEnergyOutages(callback) {
    console.info('fetching endeavour energy power outage locations');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            let json;
            try {
                json = JSON.parse(xhttp.responseText);
            } catch(err) {
                console.log("endeavour energy feed is invalid. discarding")
                json = []

            }
            let endeavourGeoJson = {
                'type': 'FeatureCollection',
                'features': []
            };

            // Convert the feed to geoJSON
            for (var i = 0; i < json.length; i++) {
                var incident = json[i];

                var feature = {
                    'type': 'Feature',
                    'owner': 'EndeavourEnergy',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [
                        incident.longitude,
                        incident.latitude
                        ]
                    },
                    'properties': {
                        'creationDateTime': incident.creationDateTime,
                        'endDateTime': incident.endDateTime,
                        'incidentId': incident.incidentId,
                        'numberCustomerAffected': incident.numberCustomerAffected,
                        'outageType': incident.outageType,
                        'postcode': incident.postcode,
                        'reason': incident.reason,
                        'startDateTime': incident.startDateTime,
                        'status': incident.status,
                        'streetName': incident.streetName,
                        'suburb': incident.suburb
                    }
                };

                endeavourGeoJson.features.push(feature);
            }

            callback(endeavourGeoJson);
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('GET', endeavourEnergyOutagesFeed, true);
    xhttp.send();
}

/**
 * Fetches the current power outages for Essential Energy.
 *
 * @param callback the callback to send the geoJSON data to.
 */
 function fetchEssentialEnergyOutages(callback) {
    console.info('fetching essential energy power outage locations');
    var xhttp = new XMLHttpRequest();
    xhttp.onloadend = function () {
        if (this.readyState === 4 && this.status === 200) {
            var kml = xhttp.responseXML;
            var essentialGeoJson = tj.kml(kml);
            for (var i = 0; i < essentialGeoJson.features.length; i++) {
                essentialGeoJson.features[i].owner='EssentialEnergy'
            }
            callback(essentialGeoJson);
        } else {
            // error
            var response = {
                error: 'Request failed',
                httpCode: this.status
            };
            callback(response);
        }
    };
    xhttp.open('GET', essentialEnergyOutagesFeed, true);
    xhttp.send();
}

function checkAsbestosRegister( inAddressObject, cb ){
    var AddressParts = /^(.+)\s(.+)$/.exec( inAddressObject.Street );
    if( !inAddressObject.Flat )
        inAddressObject.Flat = "";
    var formAddress = "https://www.fairtrading.nsw.gov.au/loose-fill-asbestos-insulation-register?"+
    "unit="+encodeURI(inAddressObject.Flat)+"&"+
    "number="+encodeURI(inAddressObject.StreetNumber)+"&"+
    "street="+encodeURI(AddressParts[1])+"&"+
    "suburb="+encodeURI(inAddressObject.Locality)+"&"+
    "type="+encodeURI(AddressParts[2])+"&"

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
    ftCache = []
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
