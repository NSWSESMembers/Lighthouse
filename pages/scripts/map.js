var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var LighthouseResource = require('../lib/shared_resources_code.js');

var moment = require('moment');

var $ = require('jquery');

global.jQuery = $;

require('bootstrap-tour')
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


	// if (localStorage.getItem("LighthouseMapTourMain") === null)
	// {
		







//}




console.log("maps ready")

	//refresh button
	$(document).ready(function() {


		// Instance the tour
		var tour = new Tour({
			smartPlacement: true,
			placement: "right",
			debug: true,
			steps: [
			{
				element: "",
				placement: "top",
				orphan: true,
				backdrop: true,
				title: "Welcome",
				content: "Welcome to the Live Map. As this is your first time here lets quickly run through how this all works"
			},
			{
				element: "#settings",
				title: "Settings",
				placement: "top",
				backdrop: true,
				content: "Here you will find display settings and mapping options",
				onNext: function (tour) {showSettingsModal();}
			},
			{
				element: "#username",
				delay: 500,
				title: "FollowMee API Username",
				placement: "auto",
				backdrop: true,
				content: "If you are using the FollowMee service you will need to enter your username here. If you are not then just leave it blank.",
			},
			{
				element: "#apikey",
				title: "FollowMee API Key",
				placement: "auto",
				backdrop: true,
				content: "If you are using the FollowMee service you will need to enter your API Access Key here. If you are not then just leave it blank.",
			},
			{
				element: "#displayheader",
				title: "Display All Filter",
				placement: "auto",
				backdrop: true,
				content: "This allows you to hide trackable objects that are not assigned to a team. Selecting 'Yes' will show all available trackables regardless of wether they are assigned to a Beacon team.",
			},
			{
				element: "#displayjobheader",
				title: "Job Status Filter",
				placement: "auto",
				backdrop: true,
				onNext: function (tour) {hideSettingsModal();},
				content: "This allows you to hide or show jobs by status. Statuses are grouped into three groups. Ticking the box will show jobs with that status on the map.",
			},
			{
				element: "#errorsbutton",
				title: "Errors",
				placement: "auto",
				backdrop: true,
				content: "This button is normally hidden. If it shows up it means there were errors creating the map. Errors may be caused by wrong usernames or passwords, or wrong API keys. Click the button to display the errors",
				onShow: function (tour) {$('#errorsbutton').css('visibility', 'visible');},
				onHide: function (tour) {$('#errorsbutton').css('visibility', 'hidden');},
			},
			{
				element: "#refresh",
				title: "Refresh",
				placement: "auto",
				backdrop: true,
				onNext: function (tour) {$('#examplemodal').modal('show');},
				content: "The map will automatically update when the timer reaches 0. You can force an update by clicking here at any time.",
			},
			{
				element: "#image",
				delay: 500,
				placement: "top",
				orphan: true,
				backdrop: true,
				title: "Trackables",
				content: "Trackables (an icon on the map that tracks something) are created from the Beacon Critical Resource Register. If the resouce is assiged to a Beacon team (via the team edit screen in Beacon) the map will reflect this by showing the callsign of the team."
			},
			{
				element: "#image",
				placement: "left",
				orphan: true,
				backdrop: true,
				title: "Trackable Names",
				content: "If a Resources name starts with 'LHM:' the map will try draw it. Anything after the ':' in the name is ignored and is just so you can keep track of what the item is. An example of a resource name would be <b>LHM:Tabops644</b> 'LHM:' is case sensitive"
			},
			{
				element: "#image",
				placement: "right",
				orphan: true,
				backdrop: true,
				title: "Trackable Descriptions",
				onNext: function (tour) {$('#image').attr("src", 'images/tour/followmee.png');},
				content: "The resouce description is used to specify how the item is tracked. the format is &ltprovider&gt:&ltpassword&gt"
			},
			{
				element: "#image",
				placement: "left",
				orphan: true,
				backdrop: true,
				title: "FollowMee",
				onNext: function (tour) {$('#image').attr("src", 'images/tour/viewranger.png');},
				content: "If using FollowMee the description for the resource would look like this <b>FollowMee:1234567890</b> FollowMee is the provider and the clientID is used as the password"
			},
			{
				element: "#image",
				placement: "right",
				orphan: true,
				backdrop: true,
				title: "ViewRanger",
				onNext: function (tour) {$('#examplemodal').modal('hide');},
				content: "If using ViewRanger the description for the resource would look like this <b>ViewRanger:email@address.com:1234</b> ViewRanger is the provider, the email address and the device PIN are used as the password"
			},
			{
				element: "",
				placement: "top",
				orphan: true,
				backdrop: true,
				title: "Google Maps",
				content: "Teams, Trackables and jobs will show on the map and further information on each can be found by clicking the map markers."
			},
			{
				element: "",
				placement: "top",
				orphan: true,
				backdrop: true,
				title: "Thanks",
				content: "This covers the basic operation of Lighthouse Live Map. If you have problems please feel free to ask on the Lighthouse facebook group."
			}
			]});

/// Initialize the tour
tour.init();

// Start the tour
tour.start();

$("#errorsbutton").click(function() {
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
	showSettingsModal()
})
$("#submitButton").click(function() {
	hideSettingsModal()
	DoEverything(map)

})
});

function showSettingsModal() {
	$('#settingsmodal').modal('show');
	$('#username').val(localStorage.getItem("LighthouseMapUserName"));
	$('#apikey').val(localStorage.getItem("LighthouseMapAPIKey"));
	$('input[name=displayAll]').val([localStorage.getItem("LighthouseMapDisplayAll")]);
	$('#UnactionedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayUnactioned") == "true") ? true : false);
	$('#ActionedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayActioned") == "true") ? true : false);
	$('#ClosedCheck').prop('checked',(localStorage.getItem("LighthouseDisplayClosed") == "true") ? true : false);
}

function hideSettingsModal() {
	localStorage.setItem("LighthouseMapUserName",$('#username').val())
	localStorage.setItem("LighthouseMapAPIKey",$('#apikey').val())
	localStorage.setItem("LighthouseMapDisplayAll",$('input[name=displayAll]:checked').val())
	localStorage.setItem("LighthouseDisplayUnactioned",($('#UnactionedCheck').is(':checked') ? 'true' : 'false'))
	localStorage.setItem("LighthouseDisplayActioned",($('#ActionedCheck').is(':checked') ? 'true' : 'false'))
	localStorage.setItem("LighthouseDisplayClosed",($('#ClosedCheck').is(':checked') ? 'true' : 'false'))	

	$('#settingsmodal').modal('hide');
}

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
				LighthouseResource.get_unit_resouces(params.hq, params.host, params.token, function(resources) {

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
							labelContent: v.Id+"<br>"+v.JobStatusType.Name,
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
							labelAnchor: new google.maps.Point(25, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"<br>"+v.JobStatusType.Name,
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
							labelAnchor: new google.maps.Point(25, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"<br>"+v.JobStatusType.Name,
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
							labelAnchor: new google.maps.Point(25, 0),
							labelClass: "rfalabels",
							labelStyle: {opacity: 0.75},
							labelContent: v.Id+"<br>"+v.JobStatusType.Name,
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
							labelContent: v.Id+"<br>"+v.JobStatusType.Name,
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

	directionsDisplay = new google.maps.DirectionsRenderer({
		suppressMarkers: true
	});

	destinationMarker = null;

	var iw = new google.maps.InfoWindow({
		content: "<div align=center>Loading...</div>",
		boxStyle: {
			opacity: 0.75,
		},
	});

	var image = {
        url: '/pages/images/map_icons/TruckSES_v3.png', // image is 512 x 512
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

    google.maps.event.addListener(iw,'closeclick',function(){
    	if (destinationMarker !== null)
    	{
    		destinationMarker.labelClass = "rfalabels";
    		destinationMarker.label.setStyles();
    		directionsDisplay.setMap(null);
    	}

    });

    //click handle for the marker
    google.maps.event.addListener(theMarker, "click", function (e) {
    	var trackablediff = moment(item.Date).fromNow(); //date of gps location
    	if (item.Original.TeamAttachedTo !== null)
    	{
    		LighthouseTeam.get_tasking(item.Original.TeamAttachedTo.Id,params.host, function(e) {

    			e.Results.reverse().forEach(function(f) {
    				console.log(f.CurrentStatusTime);
    			})    			
    			var latest = null;
    			var oldesttime = null;
    			var completed = 0;
    			e.Results.forEach(function(f) {
    				var options = {
    					weekday: "short",
    					year: "numeric",
    					month: "2-digit",
    					day: "numeric",
    					hour12: false
    				};
    				var rawdate = new Date(f.CurrentStatusTime);
    				var thistime = new Date(rawdate.getTime() + (rawdate.getTimezoneOffset() * 60000));
    				var diff = moment(thistime).fromNow();
    				if (oldesttime < thistime) {
    					oldesttime = thistime;
    					if  (f.CurrentStatus == "Enroute")
    					{
    						allMarkers.forEach(function(k,v){
    							if (k.JobId == f.Job.Id)
    							{
    								console.log("Going to")
    								destinationMarker = k;
    								k.labelClass = "selectedrfalabels"
    								k.label.setStyles();
    							}
    						})

    						if (item.Latitude !== null && item.Longitude !== null) //job is geo coded
    						{
    							var start = new google.maps.LatLng(item.Latitude, item.Longitude);
    							var end = new google.maps.LatLng(f.Job.Address.Latitude, f.Job.Address.Longitude);
    							var request = {
    								origin: start,
    								destination: end,
    								travelMode: google.maps.TravelMode.DRIVING
    							};
    							directionsService = new google.maps.DirectionsService();
    							directionsService.route(request, function (response, status) {
    								if (status == google.maps.DirectionsStatus.OK) {
    									

    									directionsDisplay.setDirections(response);
    									directionsDisplay.setMap(map);
    								} else {
    									alert("Directions Request from " + start.toUrlValue(6) + " to " + end.toUrlValue(6) + " failed: " + status);
    								}
    							});


    							var service = new google.maps.DistanceMatrixService();
    							service.getDistanceMatrix(
    							{
    								origins: [{lat: item.Latitude, lng: item.Longitude}],
    								destinations: [{lat: f.Job.Address.Latitude ,lng: f.Job.Address.Longitude} ],
    								travelMode: google.maps.TravelMode.DRIVING,
    							}, function(response, status) {
    								if (response.rows[0].elements[0].status == "OK")
    								{ //if google gave a result
    									iw.setContent("<div align=center>"+f.CurrentStatus + " to #" + f.Job.Id + "<br>" + f.Job.Address.PrettyAddress + "<br><small>Status set "+diff+"</small><br><br>"+response.rows[0].elements[0].distance.text+" away, ETA "+response.rows[0].elements[0].duration.text+"<br><span class='tinytext'>Calculated via Google Distance Matrix</span><br><br><span class='tinytext'>Location updated "+trackablediff+"</span></div>");
    								}

    								console.log(response)
    							})
    						} else {
    							iw.setContent("<div align=center>"+f.CurrentStatus + " to #" + f.Job.Id + "<br>" + f.Job.Address.PrettyAddress + "<br><span class='tinytext'>Unable to calculate travel via Google Distance Matrix</span><br><small>Status set "+diff+"</small><br><span class='tinytext'>Last location update "+trackablediff+"</span></div>");
    						}
    					} else {
    						iw.setContent("<div align=center>"+f.CurrentStatus + " at #" + f.Job.Id + "<br>" + f.Job.Address.PrettyAddress + "<br><small>Status set "+diff+"</small><br><span class='tinytext'>Last location update "+trackablediff+"</span></div>");

    					}
    				}
    				if (oldesttime === null)
    				{
    					iw.setContent("<div align=center>"+f.CurrentStatus + " at #" + f.Job.Id + "<br>" + f.Job.Address.PrettyAddress + "<br><small>Status set "+diff+"</small><br><span class='tinytext'>Last location update "+trackablediff+"</span></div>");

    				}
    			});
})
} else { //marker is not with a team

	iw.setContent("<div align=center><span class='tinytext'>Last location update "+trackablediff+"</span></div>"); 

}
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
								newItem.Date = new Date(newItem.API.DATE)
								console.log(newItem.Date)

								newItem.Date.setHours(newItem.Date.getHours() - 1) 
								console.log(newItem.Date)

								newItem.Date.setTime( newItem.Date.getTime() - newItem.Date.getTimezoneOffset()*60*1000 );
								console.log(newItem.Date)

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
							newItem.Date = newItem.API.Date
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

	LighthouseJob.get_json(tmpUnit, host, start, end, params.token,  function(data) {
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

