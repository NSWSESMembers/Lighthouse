var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var LighthouseResource = require('../lib/shared_resources_code.js');
var $ = require('jquery');

global.jQuery = $;

require('bootstrap');


// inject css c/o browserify-css
require('../styles/map.css');


var allMarkers = [];
var allErrors = [];
var map;
var MarkerWithLabel;
params = getSearchParameters();


document.addEventListener('DOMContentLoaded', function() {

	if (localStorage.getItem("LighthouseMapDisplayAll") === null)
	{
		localStorage.setItem("LighthouseMapDisplayAll",'yes')
	}

	if (localStorage.getItem("LighthouseDisplayUnactioned") === null)
	{
		localStorage.setItem("LighthouseDisplayUnactioned",'true')

	}

	if (localStorage.getItem("LighthouseDisplayActioned") === null)
	{
		localStorage.setItem("LighthouseDisplayActioned",'false')

	}

	if (localStorage.getItem("LighthouseDisplayClosed") === null)
	{
		localStorage.setItem("LighthouseDisplayClosed",'false')

	}

	console.log("maps ready")

	//refresh button
	$(document).ready(function() {

		$("#errorsbutton").click(function() {
			console.log("test")
			//$('#errorTable').empty()
//error.date = new Date
//error.string = "Followme error:" +response.responseJSON.Error
$.each(allErrors,function(k,v) {
	$('#errorTable tr:last').after('<tr><td>'+v.date.toISOString()+'</td><td>'+v.string+'</td></tr>');
	console.log(v)
})
$('#errormodal').modal('show');

})

		$("#refresh").click(function() {
			DoEverything(map);
		})
		$("#settings").click(function() {
			$('#settingsmodal').modal('show');
			$('#username').val(localStorage.getItem("LighthouseMapUserName"));
			$('#apikey').val(localStorage.getItem("LighthouseMapAPIKey"));
			$('input[name=displayAll]').val([localStorage.getItem("LighthouseMapDisplayAll")]);
			$('#UnactionedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayUnactioned") == "true") ? true : false);
			$('#ActionedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayActioned") == "true") ? true : false);
			$('#ClosedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayClosed") == "true") ? true : false);
		})
		$("#submitButton").click(function() {
			localStorage.setItem("LighthouseMapUserName",$('#username').val())
			localStorage.setItem("LighthouseMapAPIKey",$('#apikey').val())
			localStorage.setItem("LighthouseMapDisplayAll",$('input[name=displayAll]:checked').val())
			localStorage.setItem("LighthouseDisplayUnactioned",($('#UnactionedCheck').is(':checked') ? 'true' : 'false'))
			localStorage.setItem("LighthouseDisplayActioned",($('#ActionedCheck').is(':checked') ? 'true' : 'false'))
			localStorage.setItem("LighthouseDisplayClosed",($('#ClosedCheck').is(':checked') ? 'true' : 'false'))


			$('#settingsmodal').modal('hide');
			DoEverything(map)

		})
	});

GoogleMapsLoader = require("google-maps")
GoogleMapsLoader.KEY = 'AIzaSyA-3RPOUmctBNYFoDYuPvqfi5Cy-QLmG4s'

GoogleMapsLoader.load(function(google) {




	var mapCanvas = document.getElementById('map');

	var mapOptions = {
		center: new google.maps.LatLng(0, 0),
		zoom: 8,
		zoomControl: true,
		mapTypeControl: true,
		scaleControl: true,
		streetViewControl: false,
		rotateControl: true,
		fullscreenControl: true
	};

	map = new google.maps.Map(mapCanvas, mapOptions);

	MarkerWithLabel = require('markerwithlabel')(google.maps);


	DoEverything(map)

		  //run every X period of time the main loop.
		  display = document.querySelector('#time');
		  startTimer(60, display);
		})

})

//update every X seconds
function startTimer(duration, display) {
	var timer = duration, minutes, seconds;
	setInterval(function() {
		minutes = parseInt(timer / 60, 10)
		seconds = parseInt(timer % 60, 10);

		minutes = minutes < 10 ? "0" + minutes : minutes;
		seconds = seconds < 10 ? "0" + seconds : seconds;

		display.textContent = minutes + ":" + seconds;

    if (--timer < 0) { //when the timer is 0 run the code
    	timer = duration;
    	DoEverything(map);
    }
}, 1000);
}

function DoEverything(map) {
	LoadAllData(map,function() {

		var bounds = new google.maps.LatLngBounds();
		for (var i = 0; i < allMarkers.length; i++) {
			bounds.extend(allMarkers[i].getPosition());
		}
		map.fitBounds(bounds);
		google.maps.event.addListenerOnce(map, 'bounds_changed', function(event) {
			if (this.getZoom() > 15) {
				this.setZoom(15);
			}
		});
	});
}


function LoadAllData(map, cb) {
	//Promise.all([FindTrackables()]).then(function(result){ //no jobs
	Promise.all([FindTrackables(),FindJobs()]).then(function(result){
		console.log("All data sources have finished loading")
		CleanupDeletedTrackables(map,allTrackableIds)
		cb()
	})



	function FindTrackables() {

		allTrackableIds = [];

		return new Promise(function(resolve, reject) {
			LighthouseResource.get_unit_resouces(params.hq, params.host, function(resources) {

				trackablePromises = [];
			$.each(resources.Results,function (rk,rv) { //for every resource ifset
				console.log(rv)
				if (rv.Name.substring(0, 4) == ("LHM:")) { //if its a trackable
					console.log("Found a LHM");
					if (localStorage.getItem("LighthouseMapDisplayAll") == 'no' && rv.TeamAttachedTo === null)
					{
						console.log("Ignoring this one because of pref")
						return false;
					}
					allTrackableIds.push(rv.Description.split(":")[1])
					console.log(rv.Description.split(":")[0]);
					switch (rv.Description.split(":")[0])
					{
						case "FollowMee":
						console.log("Requesting Followmee:"+rv.Description.split(":")[1])
						description = rv.Description.split(":");
						trackablePromises.push(LoadFollowMee(description[1],rv));
						break;
						case "ViewRanger":
						console.log("Requesting ViewRanger:"+rv.Description.split(":")[1])
						description = rv.Description.split(":");
						trackablePromises.push(LoadViewRanger(description[1],description[2],rv));
						break;
						default:
							//nothing
						}
					}
				})
Promise.all(trackablePromises).then(function(pro) {
	console.log("Promises's are back")
	$.each(pro,function(k, result) {
		console.log(result)
					if ('API' in result) //the API result came back
					{
							if ('Latitude' in result) //assume its valid
							{
								drawTrackable(map,result)

							}
						} else {
							console.log(result)
							console.log("This is unusable: "+result.newItem.Original.Description)	
						}
					})
				resolve(); //promises are back so lets complete
			})
			if (trackablePromises.length == 0) //never made any promises so call complete
			{
				resolve();
			}
		})
})
}

function FindJobs() {

	return new Promise(function(resolve, reject) {
		fetchJobsFromBeacon(function(data) {
			allMarkers = allMarkers.filter(function(marker){
				if (!("DeviceID" in marker)) //if its a RFA not a thing/person
				{
					console.log("Removing Job #"+marker.JobId)
						marker.setMap(null); //remove it. no point updating as they will not really move but their stats will change

					} else 
					{
						return marker
					}

				})

			$.each(data, function(k, v) { 
				displayfilter = []
				if (localStorage.getItem("LighthouseDisplayUnactioned") == 'true')
				{
					displayfilter.push("New","Active")
				}
				if (localStorage.getItem("LighthouseDisplayActioned") == 'true')
				{
					displayfilter.push("Tasked","Referred")
				}
				if (localStorage.getItem("LighthouseDisplayClosed") == 'true')
				{
					displayfilter.push("Completed","Rejected","Finalised","Cancelled")
				}

				if (displayfilter.indexOf(v.JobStatusType.Name) != -1)
				{
					console.log("Will draw job #" +v.Id)
					if (v.Address.Latitude && v.Address.Longitude) {
						drawJob(map,v)
					}
				}
			})
			console.log("jobs complete")
			resolve();

			}, function() { //progress cb
				console.log("fetchJobsFromBeacon is progressing")
			})
})
}

}


function drawJob(map, v) {

	switch (v.JobPriorityType.Id) {
		case 1:
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="23" height="22"><path id="svg_1" fill-rule="evenodd" d="m10.499995,1.499995l9,9l-9,9l-9,-9l9,-9z" stroke-miterlimit="4" stroke-width="2" stroke="rgb(0, 0, 0)" fill="rgb(255, 0, 0)"/></svg>'
						//red diamond
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							map: map,
							title: v.Id+"",
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							JobId: v.Id,
							icon: 'data:image/svg+xml;charset=UTF-8;base64,' + btoa(svg),

							//icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0" //red
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						case 2:
						var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19"><path id="svg_1" fill-rule="evenodd" d="m1.992919,1.249204l13,0l-6.5,13l-6.5,-13z" stroke-miterlimit="4" stroke-width="2" stroke="rgb(0, 0, 0)" fill="rgb(79, 146, 255)"/></svg>'
						//blue triangle
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							map: map,
							title: v.Id+"",
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							JobId: v.Id,
							icon: 'data:image/svg+xml;charset=UTF-8;base64,' + btoa(svg),
							//icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752063_en_v0" //yellow
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						case 3:
						var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="16"><path id="svg_1" fill-rule="evenodd" d="m1.50002,1.500018l12,0l0,12l-12,0l0,-12z" stroke-miterlimit="4" stroke-width="2" stroke="rgb(0, 0, 0)" fill="rgb(255, 165, 0)"/></svg>'
						//orange square
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							map: map,
							title: v.Id+"",
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							JobId: v.Id,
							icon: 'data:image/svg+xml;charset=UTF-8;base64,' + btoa(svg),
							//icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752063_en_v0" //yellow
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						case 4:
						var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="15"><circle fill="rgb(102, 204, 0)" fill-opacity="1" stroke="rgb(0, 0, 0)" stroke-opacity="1" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4" cx="7" cy="7" r="6" fill-rule="evenodd" stroke-dasharray="none" dojoGfxStrokeStyle="solid"></circle></svg>';
						//green dot
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							title: v.Id+"",
							map: map,
							labelAnchor: new google.maps.Point(20, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							JobId: v.Id,
							//icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0" //green
							icon: 'data:image/svg+xml;charset=UTF-8;base64,' + btoa(svg),
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						default:
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							title: v.Id+"",
							map: map,
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							JobId: v.Id,
							icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0" //green
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
					}
					sis = (v.SituationOnScene === null) ? "" : v.SituationOnScene;
					var iw = new google.maps.InfoWindow({
						content: "<div align=center><a href='https://"+params.host+"/Jobs/"+v.Id+"' target='_blank'><b>#"+v.Id+"</b></a><br>"+v.Address.PrettyAddress+"<br><small>"+v.Tags.map(function(elem){return elem.Name;}).join(",")+"</small><br>"+sis+"</div>"
					});
					google.maps.event.addListener(marker, "click", function (e) { iw.open(map, this); });

					allMarkers.push(marker);

				}



				function drawTrackable(map, item) {
					found = -1;
					for (var i = 0; i < allMarkers.length; i++) { 

		if ("DeviceID" in allMarkers[i]) //if its a trackable
		{
			if (allMarkers[i].DeviceID == item.DeviceID && found == -1) //if this is the one we are drawing
			{
				console.log("Will update "+item.DeviceID+" marker")
				found = i;
				allMarkers[i].setPosition({lat: item.Latitude, lng: item.Longitude})
				if (allMarkers[i].labelContent.includes(item.Callsign) == false) //callsign change
				{
					console.log("updating call sign")
					allMarkers[i].setMap(null)
					allMarkers.splice(i,1)
					allMarkers.push(makeTrackableMarker(item));

				}
			}
		}
	}

	if (found == -1)
	{
		console.log("Will draw "+item.Callsign+" marker")
		allMarkers.push(makeTrackableMarker(item));
	}
}

function makeTrackableMarker(item)
{
	var iw = new google.maps.InfoWindow({
		content: "<div align=center>Test</div>"
	});

	var image = {
        url: '/pages/images/map_icons/SESYeam_v1.png', // image is 512 x 512
        scaledSize : new google.maps.Size(30, 34)
    };
    var theMarker =  new MarkerWithLabel({
    	position: {lat: item.Latitude, lng: item.Longitude},
    	map: map,
    	labelAnchor: new google.maps.Point(18, 0),
    	labelClass: "label",
    	labelStyle: {opacity: 0.9},
    	labelContent: '<span>'+item.Callsign+'</span>',
    	DeviceID: item.DeviceID,
    	icon: image
    })

    google.maps.event.addListener(theMarker, "click", function (e) {
    	LighthouseTeam.get_tasking(item.Original.TeamAttachedTo.Id,params.host, function(e) {
    		console.log(e);
    	})
    	console.log(iw)
    	iw.setContent("test123")
    	iw.open(map, this); 
    });


    return theMarker
}

function CleanupDeletedTrackables(map,alltrackable){
	console.log("Cleaning up trackable markers")
	allMarkers = allMarkers.filter(function(marker){
				if (("DeviceID" in marker)) //if its a RFA not a thing/person
				{
					console.log(marker+" Is Device")
			if (alltrackable.indexOf(marker.DeviceID) == -1) //and its not in the list
			{
				marker.setMap(null); //pull it from the map and dont add it to the new array
				console.log(marker.DeviceID+" will be deleted")
			} else {
				console.log(marker.DeviceID+" will NOT be deleted")
				return marker
			}
		} else
		{
			return marker //its a map marker not a trackable
		}

	})
}

function LoadViewRanger(theID,thePin,original) {
	return new Promise(function(resolve, reject) {
		console.log("Will talk to ViewRanger")		
		$.get({
			url: 'https://tdykes.com/viewranger/index.php',
			data: {username: theID, pin: thePin},
			dataType: 'jsonp',
			complete: function(response, textStatus) {

				if(textStatus == 'success')
				{
					if ("ERROR" in response.responseJSON.VIEWRANGER)
					{
						console.log(theID+" ViewRanger error:" +response.responseJSON.VIEWRANGER.ERROR.MESSAGE)
						error = {}
						error.date = new Date
						error.string = theID+" ViewRanger error: "+response.responseJSON.VIEWRANGER.ERROR.MESSAGE
						addError(error);
						newItem = {};
						newItem.Original = original
						resolve({newItem})
							resolve({}) //i dont want everything to fail because of this
						} else
						{
							{
								newItem = {};
								newItem.API = response.responseJSON.VIEWRANGER.LOCATION
								newItem.Original = original
								callsign = (newItem.Original.TeamAttachedTo === null) ? newItem.Original.Name.split(":")[1] : newItem.Original.TeamAttachedTo.Text;
								newItem.Callsign = callsign;
								newItem.DeviceID = theID;

								newItem.Altitude = Number(newItem.API.ALTITUDE);
								newItem.Latitude = Number(newItem.API.LATITUDE);
								newItem.Longitude = Number(newItem.API.LONGITUDE);
								newItem.Speed = Number(newItem.API.SPEED);
								resolve(newItem);
							}
						}
					}
				},

			});
})
}

function LoadFollowMee(theID,original) {
	return new Promise(function(resolve, reject) {
		username = localStorage.getItem("LighthouseMapUserName");
		key = localStorage.getItem("LighthouseMapAPIKey");
		if (key == "undefined" || username == "undefined")
		{
			console.log(theID+" No Followmee Key or Username. Will not talk to Followmee")
			error = {}
			error.date = new Date
			error.string = theID+" No Followmee Key or Username. Will not be able to talk to Followmee"
			addError(error);
			newItem = {};
			newItem.Original = original
			resolve({newItem})
		} else 
		{
			console.log("Will talk to Followmee with "+key)		

			$.get({
				url: 'https://www.followmee.com/api/tracks.aspx',
				data: {key: key, username: username, output: 'json', function: 'currentfordevice', deviceid: theID},
				dataType: 'jsonp',
				complete: function(response, textStatus) {

					if(textStatus == 'success')
					{
						if ("Error" in response.responseJSON)
						{
							console.log(theID+" Followme error:" +response.responseJSON.Error)
							error = {}
							error.date = new Date
							error.string = theID+" Followme error:" +response.responseJSON.Error
							addError(error);
							newItem = {};
							newItem.Original = original
							resolve({newItem})
						} else
						{
							newItem = {};
							newItem.API = response.responseJSON.Data[0]
							newItem.Original = original

							callsign = (newItem.Original.TeamAttachedTo === null) ? newItem.Original.Name.split(":")[1] : newItem.Original.TeamAttachedTo.Text;
							newItem.Callsign = callsign;
							newItem.Accuracy = newItem.API.Accuracy;
							//tmpTrackable.Altitude(m) = result.Altitude(m);
							newItem.DeviceID = newItem.API.DeviceID;
							newItem.DeviceName = newItem.API.DeviceName;
							newItem.Latitude = newItem.API.Latitude;
							newItem.Longitude = newItem.API.Longitude;
							//tmpTrackable.Speed(km/h) = result.Speed(km/h);
							resolve(newItem);
						}
					}
				},

			});
}
})
}

function LoadTeams(unit,params,cb) {

	var start = new Date(decodeURIComponent(params.start));
	var end = new Date(decodeURIComponent(params.end));
	start.setMonth(start.getMonth() - 3)
	LighthouseTeam.get_teams(unit, params.host,start,end, function(result){
		cb(result.Results);
	})
}

// fetch jobs from beacon
function fetchJobsFromBeacon(cb, cbProgress) {
	var start = new Date(decodeURIComponent(params.start));
	var end = new Date(decodeURIComponent(params.end));
	tmpUnit = {}
	tmpUnit.Id = params.hq
	host = params.host
	start.setMonth(start.getMonth() - 3)

	LighthouseJob.get_json(tmpUnit, host, start, end, function(data) {
		cb(data.Results)
	},function(val,total){cbProgress()});
}

function getSearchParameters() {
	var prmstr = window.location.search.substr(1);
	return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray( prmstr ) {
	var params = {};
	var prmarr = prmstr.split("&");
	for (var i = 0; i < prmarr.length; i++) {
		var tmparr = prmarr[i].split("=");
		params[tmparr[0]] = tmparr[1];
	}
	return params;
}

function addError(item) {
	allErrors.push(item);
	if (allErrors.length > 0)
	{
		$('#errorsbutton').css('visibility', 'visible');
	}

}

