var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');

var $ = require('jquery');
// inject css c/o browserify-css
require('../styles/map.css');

global.jQuery = $;

var allMarkers = [];
var map;
var MarkerWithLabel;
document.addEventListener('DOMContentLoaded', function() {
	console.log("maps ready")

	//refresh button
	$(document).ready(function() {
		document.getElementById("refresh").onclick = function() {
			DoEverything();
		}
	});

	GoogleMapsLoader = require("google-maps")
	GoogleMapsLoader.KEY = 'AIzaSyA-3RPOUmctBNYFoDYuPvqfi5Cy-QLmG4s'

	GoogleMapsLoader.load(function(google) {




		var mapCanvas = document.getElementById('map');

		var mapOptions = {
			center: 'New South Wales',
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
	var timer = duration,
	minutes, seconds;
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

				//cleanup
				for (var i = 0; i < allMarkers.length; i++) {
					allMarkers[i].setMap(null);
				}

				allMarkers = [];



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
										var marker = new MarkerWithLabel({
											position: {lat: v.Latitude, lng: v.Longitude},
											map: map,
											labelAnchor: new google.maps.Point(20, 0),
											labelClass: "labels",
											labelStyle: {opacity: 0.75},
											labelContent: tv.Callsign,
											icon: "/pages/images/truck.png"
										});
										allMarkers.push(marker);
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
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							map: map,
							title: v.Id+"",
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752125_en_v0" //red
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						case 3:
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							map: map,
							title: v.Id+"",
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752063_en_v0" //yellow
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
						break;
						case 4:
						marker = new MarkerWithLabel({
							position: {lat: v.Address.Latitude, lng: v.Address.Longitude},
							title: v.Id+"",
							map: map,
							labelAnchor: new google.maps.Point(22, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"",
							icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0" //green
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
							icon: "https://storage.googleapis.com/support-kms-prod/SNP_2752129_en_v0" //green
							//icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC"
						});
					}

					var iw = new google.maps.InfoWindow({
						content: "<b>#"+v.Id+""</b>"<br>"+v.SituationOnScene
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
			if(data.length) {
				allFollowmee = data;
			}
			LoadComplete();
		})
	})
}

function LoadFollowMee(cb) {
	$.ajax({
		url: 'https://www.followmee.com/api/tracks.aspx',
		data: {key: 'a63af6c5258e9d9498810e5f23e38fe5', username: 'ttdykes', output: 'json', function: 'currentforalldevices'},
		dataType: 'jsonp',
		complete: function(response, textStatus) {
			if(textStatus == 'success')
			{
				cb(response.responseJSON.Data);
			}
		},

	});
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

