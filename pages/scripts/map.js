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
var map;
var MarkerWithLabel;
document.addEventListener('DOMContentLoaded', function() {

	if (localStorage.getItem("LighthouseMapDisplayAll") === null)
	{
		localStorage.setItem("LighthouseMapDisplayAll",'yes')
	}

	console.log("maps ready")

	//refresh button
	$(document).ready(function() {
		$("#refresh").click(function() {
			DoEverything(map);
		})
		$("#settings").click(function() {
			$('#settingsmodal').modal('show');
			$('#username').val(localStorage.getItem("LighthouseMapUserName"));
			$('#apikey').val(localStorage.getItem("LighthouseMapAPIKey"));
			$('input[name=displayAll]').val([localStorage.getItem("LighthouseMapDisplayAll")]);

		})
		$("#submitButton").click(function() {
			localStorage.setItem("LighthouseMapUserName",$('#username').val())
			localStorage.setItem("LighthouseMapAPIKey",$('#apikey').val())
			localStorage.setItem("LighthouseMapDisplayAll",$('input[name=displayAll]:checked').val())
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

	DataSourceLoadCount = 2; //Trackables and jobs
	allTrackableIds = [];

	function LoadComplete() {
		console.log("something finished")
		DataSourceLoadCount = DataSourceLoadCount - 1;
		if (DataSourceLoadCount == 0)
		{
			console.log("All finished")
			CleanupDeletedTrackables(map,allTrackableIds)
			cb()
		}
	}


	params = getSearchParameters();


	LighthouseUnit.get_unit_name(params.hq, params.host, function(unit) {

		LighthouseResource.get_unit_resouces(params.hq, params.host, function(resources) {
			
			TotalToProcess = 0
			$.each(resources.Results,function (rk,rv) { //for every resource ifset
				console.log(rv)
				if (rv.Name.substring(0, 4) == ("LHM:")) { //if its a trackable

					if (localStorage.getItem("LighthouseMapDisplayAll") == 'no' && rv.TeamAttachedTo === null)
					{
						return false;
					}
					TotalToProcess++;
					allTrackableIds.push(rv.Description.split(":")[1])
					switch (rv.Description.split(":")[0])
					{
						case "FollowMee":
						description = rv.Description.split(":");
						LoadFollowMee(description[1],function(result) {
							callsign = (rv.TeamAttachedTo === null) ? result.DeviceName : rv.TeamAttachedTo.Text;
							console.log(result);
							tmpTrackable = {};
							tmpTrackable.Callsign = callsign;
							tmpTrackable.Accuracy = result.Accuracy;
							//tmpTrackable.Altitude(m) = result.Altitude(m);
							tmpTrackable.DeviceID = result.DeviceID;
							tmpTrackable.DeviceName = result.DeviceName;
							tmpTrackable.Latitude = result.Latitude;
							tmpTrackable.Longitude = result.Longitude;
							//tmpTrackable.Speed(km/h) = result.Speed(km/h);
							tmpTrackable.Type = result.Type;
							console.log(tmpTrackable);
							drawTrackable(map,tmpTrackable)
							TotalToProcess--;
							console.log(TotalToProcess)
							if (TotalToProcess == 0)  //cleanup after each pull if its the last
							{
								
								LoadComplete()
							}
						})
						break;
					}
				}
				
			})
			if (TotalToProcess == 0) //cleanup after the for loop of all resources
			{
				LoadComplete()
			}

		})


LoadJobs(unit,params,function(data) {


	tmpMarkers = [];
	for (var i = 0; i < allMarkers.length; i++) {

					if (!("DeviceID" in allMarkers[i])) //if its a RFA not a thing/person
					{
						allMarkers[i].setMap(null); //remove it. no point updating as they will not really move.
					} else
					{

						tmpMarkers.push(allMarkers[i])
					}
				}
				allMarkers = tmpMarkers;

				$.each(data, function(k, v) { 
					if (v.JobStatusType.Id != 8 & v.JobStatusType.Id != 6 & v.JobStatusType.Id != 7)
					{
						console.log("Will draw job")
						if (v.Address.Latitude && v.Address.Longitude) {
							drawJob(map,v)
						}
					}
				})
				LoadComplete();
			})
})
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
						content: "<div align=center><b>#"+v.Id+"</b><br>"+v.Address.PrettyAddress+"<br><small>"+v.Tags.map(function(elem){return elem.Name;}).join(",")+"</small><br>"+sis+"</div>"
					});
					google.maps.event.addListener(marker, "click", function (e) { iw.open(map, this); });

					allMarkers.push(marker);

				}



				function drawTrackable(map, item) {
					found = -1;
					for (var i = 0; i < allMarkers.length; i++) {

		if ("DeviceID" in allMarkers[i]) //if its a trackable
		{
			if (allMarkers[i].DeviceID == item.DeviceID && found == -1)
			{
				found = i;
				allMarkers[i].setPosition({lat: item.Latitude, lng: item.Longitude})
				console.log("Will update "+item.DeviceID+" marker")
				if (allMarkers[i].labelContent != item.Callsign)
				{
					allMarkers[i].setMap(null)
					allMarkers.splice(i,1)
					allMarkers.push(makeTrackableMarker(item));

				}
			}
		}
	}

	if (found == -1)
	{
		console.log("Will draw "+item.DeviceID+" marker")
		allMarkers.push(makeTrackableMarker(item));
	}
}

function makeTrackableMarker(item)
{
	return new MarkerWithLabel({
		position: {lat: item.Latitude, lng: item.Longitude},
		map: map,
		labelAnchor: new google.maps.Point(20, 0),
		labelClass: "labels",
		labelStyle: {opacity: 0.75},
		labelContent: item.Callsign,
		DeviceID: item.DeviceID,
		icon: "/pages/images/truck.png"
	})
}

function CleanupDeletedTrackables(map,alltrackable){
	console.log("Cleaning up markers")
	newMarkerArray = []
	for (var i = 0; i < allMarkers.length; i++) {
		if ("DeviceID" in allMarkers[i]) //if its a trackable
		{
			console.log(allMarkers[i]+" Is Device")
			if (alltrackable.indexOf(allMarkers[i].DeviceID) == -1) //and its not in the list
			{
				allMarkers[i].setMap(null); //pull it from the map and dont add it to the new array
				console.log(allMarkers[i]+" will be deleted")
			} else {
				newMarkerArray.push(allMarkers[i]) //its valid so keep it
				console.log(allMarkers[i]+" will NOT be deleted")

			}
		} else {
			newMarkerArray.push(allMarkers[i]) //its not a trackable so keep it
		}
	}
	allMarkers = newMarkerArray;
}

function LoadFollowMee(theID, cb) {
	username = localStorage.getItem("LighthouseMapUserName");
	key = localStorage.getItem("LighthouseMapAPIKey");
	if (key == "undefined" || username == "undefined")
	{
		console.log("No Followmee Key or Username. Will not talk to Followmee")		
		cb({})
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
					cb(response.responseJSON.Data[0]);
				}
			},

		});
	}
}


function fetchComplete(jobsData,cb) {
	console.log("Done fetching from beacon");
	cb(jobsData.Results)

}

function LoadTeams(unit,params,cb) {

	var start = new Date(decodeURIComponent(params.start));
	var end = new Date(decodeURIComponent(params.end));
	start.setMonth(start.getMonth() - 3)
	LighthouseTeam.get_teams(unit, params.host,start,end, function(result){
		cb(result.Results);
	})
}


function LoadJobs(unit,params,cb) {


	fetchFromBeacon(unit, params.host, fetchComplete, cb);

}

// fetch jobs from beacon
function fetchFromBeacon(unit, host, cb, cbFin) {
	var start = new Date(decodeURIComponent(params.start));
	var end = new Date(decodeURIComponent(params.end));
	start.setMonth(start.getMonth() - 3)

	LighthouseJob.get_json(unit, host, start, end, function(data) {
		cb(data,cbFin)
	},function(val,total){});


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

