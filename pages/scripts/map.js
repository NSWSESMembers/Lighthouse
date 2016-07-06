var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var $ = require('jquery');

global.jQuery = $;

require('bootstrap');


// inject css c/o browserify-css
require('../styles/map.css');


var allMarkers = [];
var map;
var MarkerWithLabel;
document.addEventListener('DOMContentLoaded', function() {
	console.log("maps ready")

	//refresh button
	$(document).ready(function() {
		$("#refresh").click(function() {
			DoEverything();
		})
		$("#settings").click(function() {
			$('#settingsmodal').modal('show');
			$('#username').val(localStorage.getItem("LighthouseMapUserName"));
			$('#apikey').val(localStorage.getItem("LighthouseMapAPIKey"));
			$("#submitButton").click(function() {
				localStorage.setItem("LighthouseMapUserName",$('#username').val())
				localStorage.setItem("LighthouseMapAPIKey",$('#apikey').val())
				$('#settingsmodal').modal('hide');
				DoEverything()
			})
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


		DoEverything()

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
    	DoEverything();
    }
}, 1000);
}

function DoEverything() {



	LoadAllData(function(teams,followmee,jobs) {
		
				//we have loaded them all
				console.log("All data sources have loaded")

				//cleanup jobs and keep gps targets
				tmpMarkers = [];
				for (var i = 0; i < allMarkers.length; i++) {

					if (!(allMarkers[i].hasOwnProperty("DeviceID"))) //if its a RFA not a thing/person
					{
						allMarkers[i].setMap(null); //remove it. no point updating as they will not really move.
					} else
					{
						found = -1;
						for (var ii = 0; ii < teams.length; ii++) { //this should delete any markers that no longer exist in the teams resources
							for (var iii = 0; iii < teams[ii].Resources.length; ii++) { //for every resouce iii in team ii
								if (teams[ii].Resources[iii].Name.indexOf("Followmee:") != -1) { // if its a followmee resouce
									if (allMarkers[i].DeviceID == teams[ii].Resources[iii].Description && found == -1)
									{
										found = iii;
										tmpMarkers.push(allMarkers[i])
									}
								}
							}
						}
						if (found == -1) //if there was no match in any team
						{
							console.log("deleting marker #" +allMarkers[i].DeviceID);
							allMarkers[i].setMap(null); //remove it
						}
					}
				}



				allMarkers = tmpMarkers;



				$.each(followmee, function (k, v) { //for every followmee result
					$.each(teams, function (tk,tv) { //for every team
						if (tv.Resources.length) { 
							$.each(tv.Resources,function (rk,rv) { //for every resouce ifset
								console.log(rv)

								if (rv.Name.indexOf("Followmee:") != -1) {
									if (rv.Description == v.DeviceID) { //match
										console.log(v)
										// var image = {
										// 	url: 'https://chart.googleapis.com/chart?chst=d_map_pin_icon&chld=glyphish_map-marker|FFFFFF',
										// };
										found = -1;
										for (var i = 0; i < allMarkers.length; i++) {
											if (allMarkers[i].DeviceID == v.DeviceID && found == -1)
											{
												found = i;
												allMarkers[i].setPosition({lat: v.Latitude, lng: v.Longitude})
												console.log("Will update "+tv.Callsign+" marker")
											}
										}

										if (found == -1)
										{
											console.log("Will draw "+tv.Callsign+" marker")
											var marker = new MarkerWithLabel({
												position: {lat: v.Latitude, lng: v.Longitude},
												map: map,
												labelAnchor: new google.maps.Point(20, 0),
												labelClass: "labels",
												labelStyle: {opacity: 0.75},
												labelContent: tv.Callsign,
												DeviceID: v.DeviceID,
												icon: "/pages/images/truck.png"
											});
											allMarkers.push(marker);
										}
									}
								}
							})
}
})

})

$.each(jobs, function(k, v) { 
	console.log("Will draw")
	console.log(v)
	switch (v.JobPriorityType.Id){
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

					var iw = new google.maps.InfoWindow({
						content: "<b>#"+v.Id+"</b><br>"+v.SituationOnScene
					});
					google.maps.event.addListener(marker, "click", function (e) { iw.open(map, this); });

					allMarkers.push(marker);

				})

var bounds = new google.maps.LatLngBounds();
for (var i = 0; i < allMarkers.length; i++) {
	bounds.extend(allMarkers[i].getPosition());
}

map.fitBounds(bounds);


})
}


function LoadAllData(cb) {

	allJobs = [];
	allFollowmee = [];
	allTeams = [];
	DataSourceLoadCount = 3;

	function LoadComplete() {
		console.log("something finished")
		DataSourceLoadCount = DataSourceLoadCount - 1;
		if (DataSourceLoadCount == 0)
		{
			console.log("All finished")

			cb(allTeams,allFollowmee,allJobs)
		}
	}


	params = getSearchParameters();


	LighthouseUnit.get_unit_name(params.hq, params.host, function(unit) {


		LoadTeams(unit,params,function(data) {

			console.log(data)
			allTeams = data;
			LoadComplete();

		})

		LoadJobs(unit,params,function(data) {
			$.each(data, function(k, v) { 
				if (v.JobStatusType.Id != 8 & v.JobStatusType.Id != 6 & v.JobStatusType.Id != 7)
				{

					console.log("Will save job")
					if (v.Address.Latitude && v.Address.Longitude) {
						allJobs.push(v);
					}
				}
			})
			LoadComplete();
		})

		LoadFollowMee(function(data) {
			console.log(data);
			if(data !== undefined) {
				allFollowmee = data;
			}
			LoadComplete();
		})
	})
}

function LoadFollowMee(cb) {
	username = localStorage.getItem("LighthouseMapUserName");
	key = localStorage.getItem("LighthouseMapAPIKey");
	console.log(key)
	if (key == "undefined" || username == "undefined")
	{
		console.log("No Followmee Key or Username. Will not talk to Followmee")		
		cb({})
	} else 
	{
		console.log("Will talk to Followmee with "+key)		

		$('#apikey').val(localStorage.getItem("LighthouseMapAPIKey"));
		$.ajax({
			url: 'https://www.followmee.com/api/tracks.aspx',
			data: {key: key, username: username, output: 'json', function: 'currentforalldevices'},
			dataType: 'jsonp',
			complete: function(response, textStatus) {
				if(textStatus == 'success')
				{
					cb(response.responseJSON.Data);
				}
			},

		});
	}
}


function fetchComplete(jobsData,cb) {
	console.log("Done fetching from beacon");
	console.log(jobsData);
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

