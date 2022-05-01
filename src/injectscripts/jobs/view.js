/* global lighthouseUrl, masterViewModel, $, moment, user, urls, jobId, Enum */
var DOM = require('jsx-dom-factory').default;
var _ = require('underscore');
var L = require('leaflet')
var ReturnTeamsActiveAtLHQ = require('../../lib/getteams.js');
var postCodes = require('../../lib/postcodes.js');
var sesAsbestosSearch = require('../../lib/sesasbestos.js');
var vincenty = require('../../lib/vincenty.js');
var esri = require('esri-leaflet')
var chroma = require('chroma-js')

require('leaflet-easybutton')
require('leaflet-routing-machine')
require ('leaflet-svg-shape-markers')
require('lrm-graphhopper'); // Adds L.Routing.GraphHopper onto L.Routing
require("leaflet/dist/leaflet.css");

//require('esri-leaflet')

console.log("Running inject script");

//webpack fucks this right up. Ive manually copied the images overlay
//TODO: Sam fix the webpack script
L.Icon.Default.imagePath = `${lighthouseUrl}icons/`


var assetMap; //global map holder
var assetMapRenderAtTime
var assetMapRenderTimer
var filteredAssetList = []

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(lighthouseDictionary);

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(lighthouseDictionary);

//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(function(){lighthouseMessageTPlus($('div[data-bind="foreach: opsLogEntries"] .text-muted:not([lhTPlus])'))});

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(function(){lighthouseMessageTPlus($('div[data-bind="foreach: messages"] .text-muted:not([lhTPlus])'))});

// timeline updates
masterViewModel.jobHistory.subscribe(lighthouseTimeLineTPlus);


//if the ETA inputs are visable
masterViewModel.teamsViewModel.jobTeamStatusBeingUpdated.subscribe(lighthouseETA);

//if the ETA time changes
masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion.subscribe(lighthouseETAFromNow);

//if tasking update

//Force the tasking function to last in the stack of subscribers for this.
//Prevents the UI redrawing AFTER the icons have been set, meaning they get removed
//https://stackoverflow.com/questions/779379/why-is-settimeoutfn-0-sometimes-useful
masterViewModel.teamsViewModel.taskedTeams.subscribe(function() {
  setTimeout(lighthouseTasking,0)
});

function lighthouseETAFromNow() {
  var future = moment(masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion.peek())
  var now = moment()
  var totalHours = future.diff(now, 'hours');
  var totalMinutes = Math.ceil(future.diff(now, 'minutes'));
  var clearMinutes = Math.ceil(totalMinutes % 60);
  $('#quickETAtext').text("In "+totalHours + " hours and " + clearMinutes + " minutes")
}

function lighthouseETA() {
  setTimeout( function() {
    const addToTime = (addMins, where, text) => {
      var timeInput = $(where).parent('div').parent('div').parent('div').find('input[data-bind$="datetimepicker: $parent.jobTeamStatusEstimatedCompletion, attr: {placeholder: $parent.jobTeamStatusTypeBeingUpdated() ? ($parent.jobTeamStatusTypeBeingUpdated().Id == Enum.JobTeamStatusType.Enroute.Id ? \'ETA\' : \'ETC\') : \'\' }"]')
      var now = moment()
      var current = moment()
      if (timeInput.val() != ''){
        current = moment(timeInput.val(),'DD/MM/YYYY HH:mm')
      }
      var future = current.clone()
      future.add(addMins,'m')
      masterViewModel.teamsViewModel.jobTeamStatusEstimatedCompletion(future)
    }

    //dont draw for offsite
    if (masterViewModel.teamsViewModel.jobTeamStatusTypeBeingUpdated().Id != 5)
    {
    $('a[data-bind$="loadingButton: $parent.updatingJobTeamStatus, click: $parent.updateJobTeamStatus"]')
      .each(function(k,v){ //there can only be one, but why not handle more than one incase

        var buttons = return_quicketarow()
        var text = return_quicketamoment()

        $('div[data-bind$="validationElement: $parent.jobTeamStatusEstimatedCompletion"].input-group').after(text)


        $(buttons).find("#5min").click(function() {
            addToTime(5,v,text)
        })
        $(buttons).find("#10min").click(function() {
          addToTime(10,v,text)
        })
        $(buttons).find("#15min").click(function() {
          addToTime(15,v,text)
        })
        $(buttons).find("#30min").click(function() {
          addToTime(30,v,text)
        })
        $(buttons).find("#60min").click(function() {
          addToTime(60,v,text)
        })
        $(v).before(buttons)

      })


}
}, 0);

}


function lighthouseTasking() {
    console.log("Tasking Changes, adding buttons where needed per team");
    ///Horrible nasty code for untasking

    $('a[data-bind="attr: {href: \'/Teams/\' + Team.Id + \'/Edit\'}, text: Team.Callsign"').each(function(k, v) { //for every dom that shows team name
        if ($(v).parent().find("#message").length == 0) { //check for an existing msg button
            let DOMCallsign = ($(this)[0].href.split("/")[4])
            //for every tasked team
            $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k, vv) {
                //match against this DOM
                if (vv.Team.Id == DOMCallsign && vv.Team.Members.length)
                {
                    //attach a sms button
                    let msg = return_message_button()
                    $(v).after(msg)

                    //click function
                    $(msg).click(function() {
                        event.stopImmediatePropagation();
                        var tightarray = []
                        vv.Team.Members.map(function(member) {
                            tightarray.push(member.Person.Id)
                        })
                        window.open('/Messages/Create?jobId='+escape(jobId)+'&lhquickrecipient=' + escape(JSON.stringify(tightarray)), '_blank');
                    })
                }
            })
        } else {
          console.log('already has a sms button')
        }
    })

    $('div.widget-content div.list-group div.list-group-item.clearfix div.col-xs-6.small.text-right').each(function(k, v) { //for every team dom
        if ($(v).parent().find("#untask").length == 0) { //check for an existing untask button

            //pull out the call sign and the status
            let DOMCallsign = ($(this)[0].parentNode.children[0].children[0].href.split("/")[4])
            let DOMStatus = ($(this)[0].parentNode.children[1].innerText.split(" ")[0])
            //for every tasked team
            $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k, vv) {
                //match against this DOM
                if (vv.Team.Id == DOMCallsign && vv.CurrentStatus == DOMStatus && vv.CurrentStatusId == 1) //only show for tasking that can be deleted (tasked only)
                {
                    //attached a X button if its matched and deletable
                    let untask = return_untask_button()
                    $(v).append(untask)

                    //click function
                    $(untask).click(function() {
                        event.stopImmediatePropagation();
                        untaskTeamFromJob(vv.Team.Id, jobId, vv.Id) //untask it
                    })
                }
            })
        } else {
          console.log('already has untask button')
        }
    })
}


//call on run
lighthouseDictionary();
//
lighthouseMessageTPlus($('div[data-bind="foreach: messages"] .text-muted:not([lhTPlus])'))
lighthouseMessageTPlus($('div[data-bind="foreach: opsLogEntries"] .text-muted:not([lhTPlus])'))
lighthouseTimeLineTPlus();

//call when the address exists
whenAddressIsReady(function() {
  whenUrlIsReady(function() {
    if(typeof masterViewModel.geocodedAddress.peek() == 'undefined')
    {
      $('#asbestos-register-text').html("Not A Searchable Address");
    } else if (masterViewModel.geocodedAddress.peek().Street == null || masterViewModel.geocodedAddress.peek().StreetNumber == null)
    {
      $('#asbestos-register-text').html("Not A Searchable Address");
    } else {
      sesAsbestosSearch(masterViewModel.geocodedAddress.peek(), function(res) { //check the ses asbestos register first
        if (res == true)
        { //tell the inject page (rendering result handled on the inject page)
          window.postMessage({ type: "FROM_PAGE_SESASBESTOS_RESULT", address: masterViewModel.geocodedAddress.peek(), result: true, color: 'red' }, "*");
        } else { //otherwise check the fair trade database via background script
            window.postMessage({ type: "FROM_PAGE_FTASBESTOS_SEARCH", address: masterViewModel.geocodedAddress.peek() }, "*");
          }
      });
    }
  })



  //
  //postcode checking code
  //
  if(masterViewModel.geocodedAddress.peek().PrettyAddress) {
    var lastChar = masterViewModel.geocodedAddress.peek().PrettyAddress.substr(masterViewModel.geocodedAddress.peek().PrettyAddress.length - 4)
  }
  if (masterViewModel.geocodedAddress.peek().PostCode == null && (isNaN(parseInt(lastChar)) == true)) //if no postcode is displayed
  {
    postCodes.returnPostCode(masterViewModel.geocodedAddress.peek().Locality, function(postcode){
      if (typeof postcode !== 'undefined')
      {
        $('p[data-bind="text: enteredAddress"]').text($('p[data-bind="text: enteredAddress"]').text()+", "+postcode)
      } else {
        console.log("Postcode not found")
      }
    });

  } else if (masterViewModel.geocodedAddress.peek().PostCode != null && (isNaN(parseInt(lastChar)) == true)) {
    console.log('postcode is in the geocode by not displayed')
    $('p[data-bind="text: enteredAddress"]').text($('p[data-bind="text: enteredAddress"]').text()+", "+masterViewModel.geocodedAddress.peek().PostCode)
  }

  //end postcode





  //assetLocationButtonOn clicky clicky if saved
  let assetLocationSavedState = localStorage.getItem("LighthouseJobViewAssetLocationButton")

  if (assetLocationSavedState == 'all' || assetLocationSavedState == null) {
    assetLocationButtonAll()
  } else if (assetLocationSavedState == 'active') {
    assetLocationButtonActiveOnly()
  } else if (assetLocationSavedState == 'filter') {
    assetLocationButtonFiltered(true)
  }

})

let quickTask = return_quicktaskbutton();
let quickSector = return_quicksectorbutton();
let quickCategory = return_quickcategorybutton();
let quickRadioLog = return_quickradiologbutton();
let instantRadiologModal = return_quickradiologmodal();


  function renderNearestAssets({teamFilter, activeOnly, resultsToDisplay, cb}) {

    if (!masterViewModel.geocodedAddress.peek().Latitude && !masterViewModel.geocodedAddress.peek().Longitude) {
      $('#nearest-asset-geoerror').show();
      cb && cb()
    } else {

    //stuff that needs to persist
    //$('#asset-map').show() //really deosnt like been hidden when you draw it
    $('#nearest-asset-box').show()
    if (!$('#asset-map')[0]._leaflet_id) {
      console.log('Map doesnt exist, creating')
    assetMap = L.map('asset-map').setView([masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude], 13);
    L.control.scale().addTo(assetMap);

    esri.basemapLayer('Topographic', {ignoreDeprecationWarning: true}).addTo(assetMap);
  }

    assetMapRenderAtTime =  moment()
    $('#asset-draw-time').html(`Map last updated: ${moment().diff(assetMapRenderAtTime, 'seconds')}s ago`)

    assetMapRenderTimer = setInterval(function () {
      $('#asset-draw-time').html(`Map last updated: ${moment().diff(assetMapRenderAtTime, 'seconds')}s ago`)
      if (moment().diff(assetMapRenderAtTime, 'seconds') >= 60) {
        $('#asset-draw-time').css('color', 'red');
      } else {
        $('#asset-draw-time').css('color', 'black');
      }
    }, 5000)

    var menuButton = L.easyButton('fa-crosshairs fa-lg', function(btn, map) {
      assetMap.setView([masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude], 13)
    });
    menuButton.addTo(assetMap);


    var mapMarkers = []
    if (!activeOnly && typeof(teamFilter) == "undefined") { //only show LHQ's when in all mode
      window.postMessage({ type: "FROM_PAGE_LHQS"}, "*");
    }
    window.addEventListener('message', function (event) {
        // We only accept messages from background
        if (event.source !== window)
            return;

        if (event.data.type) {
            if (event.data.type === 'lhqs') {

              if (event.data.data && event.data.data.features) {
                let hqDistances = []
                event.data.data.features.forEach(function(v){
                  v.distance = vincenty.distVincenty(v.properties.POINT_Y,v.properties.POINT_X,masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude)/1000
                  hqDistances.push(v)
                })
                let _sortedhqDistances = hqDistances.sort(function(a, b) {
                    return a.distance - b.distance
                  });

                  for (let i = 0; i < _sortedhqDistances.length; i++) { //all of them with some conttrol of count
                      let hq = _sortedhqDistances[i];
                    //if (hq.distance < 100) {//only show LHQ's within 100km
                      let x = hq.properties.POINT_X;
                      let y = hq.properties.POINT_Y;

                      let name = hq.properties.HQNAME;

                      let unitCode = hq.properties.UNIT_CODE;


                      let details =
                      `<div id='lhqPopUp' style="width:250px">\
                      <div id='lhqCode' style="width:50%;margin:auto;text-align:center;font-weight: bold;">${hq.properties.HQNAME}</div>\
                      <div id='lhqStatusHolder' style="width:50%;margin:auto;text-align:center;"><span id='lhqStatus'>-Loading-</span></div>\

                      <div id='lhqacredHolder' style="padding-top:10px;width:100%;margin:auto">\
                      <table id='lhqacred' style="width:100%;text-align: center;">\
                      <tr>\
                      <th style="text-align: center;width:100%">Available SRB Roles</th>\
                      </tr>\
                      </table>\
                      </div>\

                      <div id='lhqContactsHolder' style="padding-top:10px;width:100%;margin:auto">\
                      <table id='lhqContacts' style="width:100%;text-align: center; table-layout: fixed;">\
                      <tr>\
                      <td colspan="2" style="font-weight: bold">Contact Details</td>
                      </tr>\
                      <tr>\
                      <th style="text-align: center;width:50%">Name</th>\
                      <th style="text-align: center;width:50%">Detail</th>\
                      </tr>\
                      </table>\
                      </div>\
                      </div>`;

                      let icon = lighthouseUrl + "icons/ses.png";

                      var lhqMarkerIcon = L.divIcon({
                        className: 'custom-div-icon',
                           html: `<div><img width="80%" src=${icon}></img></div>`,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                      });

                      let marker = L.marker([y,x], {icon: lhqMarkerIcon}).addTo(assetMap)
                      marker.bindTooltip(details)
                      //console.debug(`SES LHQ at [${x},${y}]: ${name}`);
                      let contentLoaded = false;
                      marker.on('tooltipopen', function() {
                        if (!contentLoaded) {
                          contentLoaded = true
                        let toolTip = $($.parseHTML(marker.getTooltip()._content))
                        fetchHqDetails(name, function (hqdeets) {
                          var c = 0;
                          $.each(hqdeets.contacts, function (k, v) {
                              if (v.ContactTypeId == 4 || v.ContactTypeId == 3) {
                                  c++;
                                  if (c % 2 || c == 0) //every other row
                                  {
                                      toolTip.find('#lhqContacts').append('<tr><td style="word-wrap:break-word; white-space:normal;">' + v.Description.replace('Phone', '').replace('Number', '') + '</td><td>' + v.Detail + '</td></tr>');
                                  } else {
                                      toolTip.find('#lhqContacts').append('<tr style="background-color:#e8e8e8"><td>'+v.Description.replace('Phone','').replace('Number','')+'</td><td>'+v.Detail+'</td></tr>');
                                  }
                              }
                          });

                          if (hqdeets.acred.length > 0) //fill otherwise placeholder
                          {
                              $.each(hqdeets.acred, function (k, v) {
                                toolTip.find('#lhqacred').append('<tr><td>' + v + '</td></tr>');
                              })
                          } else {
                              toolTip.find('#lhqacred').append('<tr style="font-style: italic;"><td>None</td></tr>');
                          }
                          toolTip.find('#lhqStatus').text(hqdeets.HeadquartersStatus)
                          toolTip.find('#lhqJobCount').text(hqdeets.currentJobCount)
                          toolTip.find('#lhqTeamCount').text(hqdeets.currentTeamCount)
                            marker.setTooltipContent(toolTip.prop('outerHTML'))
                        })
                        }
                      });

                    //}
                  }
              }

            }
          }
        })


    let markerStyle = {}

    switch(masterViewModel.jobPriority.peek().Name) {
      case "Priority":
      markerStyle = {
        shape: "square",
        radius: 6,
        fillColor: "#FFA500",
		    color: "black",
        weight: 1.5,
        fillOpacity: 1
      }
      break
      case "Immediate":
      markerStyle = {
        shape: "triangle-down",
        radius: 6,
        fillColor: "#4F92FF",
        color: "black",
        weight: 1.5,
        fillOpacity: 1
      }
      break
      case "Rescue":
      markerStyle = {
        shape: "diamond",
        radius: 6,
        fillColor: "#FF0000",
        color: "black",
        weight: 1.5,
        fillOpacity: 1
      }
      break
      default:
      markerStyle = {
        shape: "circle",
        radius: 6,
        fillColor: "#66CC00",
		    color: "black",
        weight: 2,
        fillOpacity: 1
      }
    }

    let jobMarker = L.shapeMarker([masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude], markerStyle);
    mapMarkers.push(jobMarker.addTo(assetMap))

  //mapMarkers.push(L.marker([masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude], {icon: jobMarker, zIndexOffset: 1000}).addTo(assetMap))


    $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/ResourceLocations/Radio?resourceTypes='
    , beforeSend: function(n) {
    n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'NearestAsset', userId: user.Id}
    , complete: function(response, textStatus) {
    if (textStatus == 'success')
    {

    var assetDistances = []
    var furthestDistance; //need a way to know the furthest marker
    var nearestDistance; //need a way to know the closest marker
    var allRoutersOnMap = {}
    var t0 = performance.now();
    var hiddenAssets = 0

    response.responseJSON.forEach(function(v){


      //If passed a filter then filter on the contents

      if (typeof(teamFilter) == "undefined" || ( typeof(teamFilter) != "undefined" && teamFilter.includes(v.properties.name))) {
        v.distance = vincenty.distVincenty(v.geometry.coordinates[1],v.geometry.coordinates[0],masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude)/1000
        v.bearing = getBearing(masterViewModel.geocodedAddress.peek().Latitude,masterViewModel.geocodedAddress.peek().Longitude,v.geometry.coordinates[1],v.geometry.coordinates[0])
        assetDistances.push(v)
      } else {
        hiddenAssets = hiddenAssets + 1
      }
      })

    assetDistances.sort(function(a, b) {
        return a.distance - b.distance
      });




    if (assetDistances.length > 0) {
     let maxLength = resultsToDisplay //how many results to display
     let used = 0

     var steps = (typeof(teamFilter) != "undefined" ? teamFilter.length : maxLength)
     var colorScale = chroma.scale(['green','red']).mode('lch').colors(steps)


     assetDistances.forEach(function(v) { //safe way to loop with a limit
      let row;

       if (used < maxLength || typeof(teamFilter) != "undefined") {
         if ((activeOnly && moment().diff(v.properties.lastSeen, "hours") < 1) || (!activeOnly)) {
         used++
         furthestDistance = v
         if (nearestDistance == null) {
           nearestDistance = v
         }

        var unit = v.properties.name.match(/([a-z]+)/i) ? v.properties.name.match(/([a-z]+)/i)[1] : v.properties.name;
        var veh = v.properties.name.match(/[a-z]+(\d*[a-z]?)/i) ? v.properties.name.match(/[a-z]+(\d*[a-z]?)/i)[1] : '';
        let uniqueColor = colorScale[used-1]//`${stringToColor(v.id)}`
        let bgcolor;

          //use our unique color, unless its the first or last
           if (used == 1) {
                bgcolor = 'green'
                uniqueColor = bgcolor
          } else if (used == maxLength) { //doesnt work in filter mode
            bgcolor = 'red'
            uniqueColor = bgcolor
        } else {
              bgcolor = uniqueColor
            }


         row = $(`
           <tr style="${moment().diff(v.properties.lastSeen, "days") > 1 ? "font-style: italic;" : ''}  cursor: pointer;">
        <th scope="row"><div data-toggle="tooltip" data-placement="left" title="${v.properties.entity}'s ${v.properties.capability} ${v.properties.resourceType}">${v.properties.name}</div></th>
        <td><div id="locate" style="background:${uniqueColor}"></div></td>
        <td>${v.properties.entity}</td>
        <td>${v.distance.toFixed(2)} km ${getCardinal(v.bearing)}</td>
        <td>${v.properties.talkgroup != null ? v.properties.talkgroup : 'Unknown'}</td>
        <td ${moment().diff(v.properties.lastSeen, "days") > 1 ? "style=color:red" : ''}>${moment(v.properties.lastSeen).fromNow()}</td>
        </tr>
           `);
           $('#nearest-asset-table tbody').append(row)
           row.find($('[data-toggle="tooltip"]')).tooltip()

           let markerLabel = v.properties.name
           if (unit && veh) {
             markerLabel = `${unit}<br>${veh}`
           }
           var situationVehicle = L.divIcon({
             className: 'custom-div-icon',
                html: `<div style='background-color:${bgcolor}; ${moment().diff(v.properties.lastSeen, "days") > 1 ? "filter: contrast(0.3);" : ''}' class='marker-pin'></div>
                <div class="awesome" style="position: absolute; margin: 24px 13px; line-height: 10px; text-align: center; color:white">
                  <p>${markerLabel}</p>
                </div>`,
               iconSize: [40, 56],
               iconAnchor: [24, 56]
           });

           var marker = L.marker([v.geometry.coordinates[1], v.geometry.coordinates[0]], {icon: situationVehicle}).addTo(assetMap)
           var polyline = L.polyline([[v.geometry.coordinates[1], v.geometry.coordinates[0]],[masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude]], {weight: 4, color: 'green', dashArray: "6"})


           let srcLatRad = v.geometry.coordinates[1]  * (Math.PI / 180);
           let dstLatRad = masterViewModel.geocodedAddress.peek().Latitude  * (Math.PI / 180);
           let middleLatRad = Math.atan(Math.sinh(Math.log(Math.sqrt((Math.tan(dstLatRad)+1/Math.cos(dstLatRad))*(Math.tan(srcLatRad)+1/Math.cos(srcLatRad))))));
           let middleLat = middleLatRad * (180 / Math.PI)
           let middleLng = (v.geometry.coordinates[0] + masterViewModel.geocodedAddress.peek().Longitude) / 2;


           let midPointBetween = middlePoint(v.geometry.coordinates[1], v.geometry.coordinates[0], masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude)

           var distanceMarker = new L.circleMarker([middleLat, middleLng], { radius: 0.1 }); //opacity may be set to zero
           distanceMarker.bindTooltip(`${v.distance.toFixed(2)} km ${getCardinal(v.bearing)}`, {permanent: true, offset: [0, 0] });

           var distanceMarkerRoute = []

            if (used != 1 && used != maxLength && used <= 10) { //not the first, last or more than 10
           var markerCircle = L.circle([masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude], {
             color: 'black',
             weight: 0.5,
             fill: false,
             dashArray: "6",
             radius: (v.distance * 1000) //KM to M divided by 2 for radius
           }).addTo(assetMap);
          }


           var routingControl = L.Routing.control({
             router: L.Routing.graphHopper('lighthouse', {
                serviceUrl: 'https://graphhopper.lighthouse-extension.com/route',
                urlParameters: {'ch.disable': true, instructions: true,  }
              }),
              // waypoints added at request time so they flush out custom routing
             draggableWaypoints: true,
             routeWhileDragging: false,
             reverseWaypoints: false,
             useZoomParameter: false,
             showAlternatives: false,
             fitSelectedRoutes : false,
             createMarker: function(i, wp, n) {
                        if (i == n-1 || i == 0) { //dont draw first or last marker
                          return null
                        } else {
                          const marker = L.marker(wp.latLng, {
                              draggable: true,
                              icon: L.icon({
                              		iconUrl:       `${lighthouseUrl}icons/marker-icon.png`,
                              		iconRetinaUrl: `${lighthouseUrl}icons/marker-icon-2x.png`,
                              		shadowUrl:     `${lighthouseUrl}icons/marker-shadow.png`,
                              		iconSize:    [25, 41],
                              		iconAnchor:  [12, 41],
                              		popupAnchor: [1, -34],
                              		tooltipAnchor: [16, -28],
                              		shadowSize:  [41, 41]
                              })
                          })
                          return marker
                        }
                },
             lineOptions: {
                    styles: [
                      {color: uniqueColor, opacity: 0.9, weight: 3},
                    ],
                    //addWaypoints: false,
                },
             //  altLineOptions: {
             //        styles: [
             //            {color: 'red', opacity: 1, weight: 3},
             //        ],
             //       addWaypoints: false,
             //    },
           })


           routingControl.on('routingerror', function (e) {
             console.log(e)
             $('#asset-map-loading').css("visibility", "hidden");
             let before = $('#asset-route-warning').html()
             let error
             if (e.error.response) {
               error = e.error.response.message
             } else {
               error = 'Error talking to routing server... try again soon'
             }
             $('#asset-route-warning').html(`Error Routing<br>${error}`)

             setTimeout(function(){
               $('#asset-route-warning').fadeOut(400,function() {
                  $(this).html(before)
                }).fadeIn();
             }, 4000);

         })


           routingControl.on('routesfound', function (e) {
             console.log(e)
             $( "#asset-map-loading" ).fadeOut( "fast", function() {
               //tidy up the css because we need table no none
               $('#asset-map-loading').css("visibility", "hidden");
               $('#asset-map-loading').css("display", "table");
             });
             distanceMarkerRoute.forEach(function(r) { r.remove(assetMap)})


             e.routes.forEach(function(r) {


               let routesSorted = r.instructions.sort(function(a, b) {
                    return a.distance - b.distance;
                });
                //regex out to make the path name, if theres no known road name then null out
                // and let the truthy in the template catch it
                let name = routesSorted[routesSorted.length-1].text.match(/onto (.+)$/i)
                if (name) {
                  name = name[1]
                } else {
                  name = null
                }

                allRoutersOnMap[v.properties.name] = r.coordinates

                let middle = r.coordinates[Math.floor(r.coordinates.length/4)]

               let distance = r.summary.totalDistance;
               let time = r.summary.totalTime;
               let timeHr = parseInt(moment.utc(time*1000).format('HH'))
               let timeMin = parseInt(moment.utc(time*1000).format('mm'))
               let timeText = ""
               if (timeHr == 0) {
                 timeText = `${timeMin} min`
               } else {
                 timeText = `${timeHr} hr ${timeMin} min`
               }
               let _distanceMarkerRoute = new L.circleMarker([middle.lat, middle.lng], { radius: 0.1 }).addTo(assetMap); //opacity may be set to zero
               _distanceMarkerRoute.bindTooltip(`<div style="text-align: center;"><strong style="color:${uniqueColor}">${v.properties.name}${name ? ' via ': ""}${name ? name : ''}</strong><br><strong>${(distance/1000).toFixed(1)} km - ${timeText}</strong></div>`, {permanent: true, offset: [0, 0] });
               distanceMarkerRoute.push(_distanceMarkerRoute)
             })

             zoomToFitRoutes()

           })



           //hold the zindex so we can restore it after we bring to front
           var zindex = marker._zIndex

           //calculate it if its first
           // if (used == 1) {
           //   marker.setZIndexOffset(9999)
           //   drawPathingAndUpdateRow()
           // }

           // hover over table rows

           $(row).mouseenter(function() {
             polyline.addTo(assetMap);
             distanceMarker.addTo(assetMap);
             marker.setZIndexOffset(9999)
           }).mouseleave(function() {
             polyline.remove(assetMap);
             distanceMarker.remove(assetMap);
             //reset the  zindex  if the row isnt clicked
             if (!row.hasClass( 'nearest-asset-table-selected' )) {
             marker.setZIndexOffset(zindex)
           }
            })

            $(row).find('#locate').on('click', function(e) { //fly to just this marker and the job
              e.stopPropagation();
              assetMap.setView([marker.getLatLng().lat, marker.getLatLng().lng], 15)
            })

           $(row).on('click', function() { //path this marker
             drawPathingAndUpdateRow()
             marker.setZIndexOffset(9999)
           })

           marker.on('click', function() {
             drawPathingAndUpdateRow()
             marker.setZIndexOffset(9999)
           });

           marker.on('mouseover', function() {
             polyline.addTo(assetMap);
             distanceMarker.addTo(assetMap);

           });

           marker.on('mouseout', function() {
             polyline.remove(assetMap);
             distanceMarker.remove(assetMap)

             marker.setZIndexOffset(zindex)
           });

           mapMarkers.push(marker);




         } else {
           hiddenAssets = hiddenAssets + 1
         }
     }

     function zoomToFitRoutes() {
      console.log('before',allRoutersOnMap)
                  // Zoom to fit all drawn paths
      var activePoints = []
      for (var k in allRoutersOnMap){
        if (Object.prototype.hasOwnProperty.call(allRoutersOnMap, k)) {
          allRoutersOnMap[k].map(function(c) {
            activePoints.push([c.lat,c.lng])
          })
        }
      }
      if (activePoints.length){
        let latlngBounds = L.latLngBounds(activePoints)
        assetMap.flyToBounds(latlngBounds, {padding: [40, 40]})
      }
      }



     function drawPathingAndUpdateRow() {
       if (!row.hasClass( 'nearest-asset-table-selected' )) {
         $(row).addClass('nearest-asset-table-selected')
         $('#asset-map-loading').css("visibility", "unset");
         //remove the crow flies and replace with true
         polyline.remove(assetMap);
         distanceMarker.remove(assetMap);


        //reset waypoints each time just incase someone has repathed
        routingControl.getPlan().setWaypoints([
          L.latLng(v.geometry.coordinates[1], v.geometry.coordinates[0]),
          L.latLng(masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude)
        ])
         routingControl.addTo(assetMap);


       } else {
         $(row).removeClass('nearest-asset-table-selected')

         delete allRoutersOnMap[v.properties.name]
         routingControl.remove(assetMap)
         distanceMarkerRoute.forEach(function(r) { r.remove(assetMap)})
         distanceMarkerRoute = []
         marker.unbindTooltip()
         marker.setZIndexOffset(zindex)
         zoomToFitRoutes()

       }

       if ($(".nearest-asset-table-selected").length == 0) {
         $('#asset-route-warning').css("visibility", "hidden");
       } else {
         $('#asset-route-warning').html("Travel distance and time are estimates and should not be used for navigation or response times")
         $('#asset-route-warning').css("visibility", "unset");
       }

     }
   })
   if (hiddenAssets > 0) {
     $('#filter-warning').html(`Hiding ${hiddenAssets} assets`)
     $('#filter-warning').css("visibility", "unset");
   } else {
     $('#filter-warning').css("visibility", "hidden");
   }


     const average = (array) => array.reduce((a, b) => a + b) / array.length;
var s2circle = L.circle([masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude], {
  color: 'red',
  weight: 1,
  fillColor: '#f03',
  fillOpacity: 0.03,
  radius: furthestDistance.distance  * 1000
}).addTo(assetMap);


var s1circle = L.circle([masterViewModel.geocodedAddress.peek().Latitude, masterViewModel.geocodedAddress.peek().Longitude], {
  color: 'green',
  weight: 1,
  fillColor: '#50C878',
  fillOpacity: 0.03,
  radius: nearestDistance.distance * 1000
}).addTo(assetMap);


     let latlngs = mapMarkers.map(marker => marker.getLatLng())

     let latlngBounds = L.latLngBounds(latlngs)

     assetMap.fitBounds(latlngBounds, {padding: [20, 20]})
     //$('#nearest-asset-text').text($('#nearest-asset-text').text().slice(0,-2)) //trim the comma space from the very end
    } else {
      let row = $(`
        <tr>
          <td colspan="5"><i>No assets found</i></td>
        </tr>
        `)
      $('#nearest-asset-table tbody').append(row)
    }
    var t1 = performance.now();
    console.log("Call to calculate distances from assets took " + (t1 - t0) + " milliseconds.")
    cb()
    }
    }
    });
  }
}

function stringToColor(number) {
  const hue = number * 137.508; // use golden angle approximation
return `hsl(${hue},80%,50%)`;

}

function hashCode(str) { // java String#hashCode
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

function intToRGB(i){
    var c = (i & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();

    return "00000".substring(0, 6 - c.length) + c;
}

//the asset location buttons


function assetLocationMapOff() {
  clearInterval(assetMapRenderAtTime);
  $('#nearest-asset-box').hide()
  $('#nearest-asset-table tbody').empty()
  $('#nearest-asset-geoerror').hide()
  $('#asset-route-warning').css("visibility", "hidden");

  if (assetMap && assetMap.remove) {
    assetMap.off();
  assetMap.remove();
  assetMap = null;
  }

}

$('#assetLocationButtonRefresh').click(function() {

  if ($('#assetLocationButtonAll').hasClass('btn-active')) {
    assetLocationMapOff()
    assetLocationButtonAll()
  }

  if ($('#assetLocationButtonActiveOnly').hasClass('btn-active')) {
    assetLocationMapOff()
    assetLocationButtonActiveOnly()
  }

  if ($('#assetLocationButtonFiltered').hasClass('btn-active')) {
    assetLocationMapOff()
    assetLocationButtonFiltered(true)
  }

})


$('#assetLocationButtonFiltered').click(function() {

assetLocationButtonFiltered()

})

  $('#assetLocationButtonOff').click(function() {

    localStorage.setItem("LighthouseJobViewAssetLocationButton", 'off');

    $('#assetLocationButtonFiltered').removeClass('btn-active')
    $('#assetLocationButtonFiltered').addClass('btn-inactive')

    $('#assetLocationButtonActiveOnly').removeClass('btn-active')
    $('#assetLocationButtonActiveOnly').addClass('btn-inactive')

    $('#assetLocationButtonAll').removeClass('btn-active')
    $('#assetLocationButtonAll').addClass('btn-inactive')

    $('#assetLocationButtonOff').addClass('btn-active')
    $('#assetLocationButtonOff').removeClass('btn-inactive')

    assetLocationMapOff()

  })


$('#assetLocationButtonAll').click(function() {
  assetLocationButtonAll()
});


function assetLocationButtonAll() {

    //swap from action only to all
    if ($('#assetLocationButtonActiveOnly').hasClass('btn-active')) {
      $('#assetLocationButtonActiveOnly').removeClass('btn-active')
      $('#assetLocationButtonActiveOnly').addClass('btn-inactive')
      assetLocationMapOff()
    }

    //swap from filter only to all
    if ($('#assetLocationButtonFiltered').hasClass('btn-active')) {
      $('#assetLocationButtonFiltered').removeClass('btn-active')
      $('#assetLocationButtonFiltered').addClass('btn-inactive')
      assetLocationMapOff()
    }

    //check we dont already have a map (only a real map has trhe remove function)
    if (!assetMap) {


    localStorage.setItem("LighthouseJobViewAssetLocationButton", 'all');

    $('#assetLocationButtonOff').removeClass('btn-active')
    $('#assetLocationButtonOff').addClass('btn-inactive')

    $('#assetLocationButtonAll').addClass('btn-active')
    $('#assetLocationButtonAll').removeClass('btn-inactive')

    var spinner = $(<i style="margin-left:5px" class="fa fa-refresh fa-spin fa-1x fa-fw"></i>)

    spinner.appendTo('#assetLocationButtonAll');

    renderNearestAssets({resultsToDisplay: 5, cb: function() {
      spinner.hide()
    }})
  }
}

$('#assetLocationButtonActiveOnly').click(function() {
assetLocationButtonActiveOnly()
});

function assetLocationButtonActiveOnly() {

    if ($('#assetLocationButtonAll').hasClass('btn-active')) {
      $('#assetLocationButtonAll').removeClass('btn-active')
      $('#assetLocationButtonAll').addClass('btn-inactive')
      assetLocationMapOff()
    }

    if ($('#assetLocationButtonFiltered').hasClass('btn-active')) {
      $('#assetLocationButtonFiltered').removeClass('btn-active')
      $('#assetLocationButtonFiltered').addClass('btn-inactive')
      assetLocationMapOff()
    }

    if (!assetMap) {

    localStorage.setItem("LighthouseJobViewAssetLocationButton", 'active');

    $('#assetLocationButtonOff').removeClass('btn-active')
    $('#assetLocationButtonOff').addClass('btn-inactive')

    $('#assetLocationButtonActiveOnly').addClass('btn-active')
    $('#assetLocationButtonActiveOnly').removeClass('btn-inactive')

    var spinner = $(<i style="margin-left:5px" class="fa fa-refresh fa-spin fa-1x fa-fw"></i>)

    spinner.appendTo('#assetLocationButtonActiveOnly');

    renderNearestAssets({activeOnly: true, resultsToDisplay: 5, cb: function() {
      spinner.hide()
      let before = $('#asset-route-warning').html()
      $('#asset-route-warning').css("visibility", "unset");

      $('#asset-route-warning').html(`Showing nearest 5 assets that have updated within the last 1 hour`)

    }})
  }
}

function assetLocationButtonFiltered(bypassUI) {

  if ($('#assetLocationButtonAll').hasClass('btn-active')) {
    $('#assetLocationButtonAll').removeClass('btn-active')
    $('#assetLocationButtonAll').addClass('btn-inactive')
    assetLocationMapOff()
  }

  if ($('#assetLocationButtonActiveOnly').hasClass('btn-active')) {
    $('#assetLocationButtonActiveOnly').removeClass('btn-active')
    $('#assetLocationButtonActiveOnly').addClass('btn-inactive')
    assetLocationMapOff()
  }

  if ($('#assetLocationButtonOff').hasClass('btn-active')) {
    $('#assetLocationButtonOff').removeClass('btn-active')
    $('#assetLocationButtonOff').addClass('btn-inactive')
  }

if (!bypassUI) {

  //reset search boxes
  $('#assetListAllQuickSearch').val('')
  $('#assetListSelectedQuickSearch').val('')

  $('#teamFilterListAddSelected').unbind().click(function() {
    $("#teamFilterListAll").val().forEach(function(s) {

      let option = $(`<option value=${s}>${s}</option>`)

      //click handler for unselecting
      option.dblclick(function(x) {
        if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
        {
          $('#teamFilterListAll').find(`option[value|="${x.target.value}"]`).show()
        }
        $(x.target).remove()
      });
      $("#teamFilterListSelected").append(option);



      $('#teamFilterListAll').find(`option[value|="${s}"]`).hide()
    })
  })

  $('#teamFilterListRemoveSelected').unbind().click(function() {
    $("#teamFilterListSelected").val().forEach(function(s) {
      if (s.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
      {
        $('#teamFilterListAll').find(`option[value|="${s}"]`).show()
      }
      $('#teamFilterListSelected').find(`option[value|="${s}"]`).remove()
    })
  })


  $("#LHAssetFilterModal").on("hidden.bs.modal", function () {
      // put your default event here

    assetLocationMapOff()
    $('#assetLocationButtonFiltered').addClass('btn-active')
    $('#assetLocationButtonFiltered').removeClass('btn-inactive')
    localStorage.setItem("LighthouseJobViewAssetLocationButton", 'filter');

    let selectedAssets = []
     $("#teamFilterListSelected").children().each(function(r) {
      selectedAssets.push($(this)[0].value)
    })

  localStorage.setItem("LighthouseJobViewAssetFilter", JSON.stringify(selectedAssets));
    $('#assetLocationButtonFiltered').addClass('btn-active')
    $('#assetLocationButtonFiltered').removeClass('btn-inactive')

  var spinner = $(<i style="margin-left:5px" class="fa fa-refresh fa-spin fa-1x fa-fw"></i>)

  spinner.appendTo('#assetLocationButtonFiltered');
  renderNearestAssets({teamFilter: selectedAssets, activeOnly: false, cb: function() {
    spinner.hide()
    $('#asset-route-warning').html(`Showing filtered list of assets`)
    $('#asset-route-warning').css("visibility", "unset");

  }})

  $('#LHAssetFilterModal').modal('hide');

  })



  $('#assetListAllQuickSearch').keyup = null;


  $('#assetListAllQuickSearch').keyup(function (e) {
        $.each($('#teamFilterListAll').find('option'),function(k,v){
          if (($(v)[0].value).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
          {
            $(v).hide()
          } else {
            if (!$('#teamFilterListSelected').find(`option[value|="${$(v)[0].value}"]`).length) { //stupid always truthy find function
              $(v).show()
            }
          }
        });
      })

      $('#assetListSelectedQuickSearch').keyup(function (e) {
            $.each($('#teamFilterListSelected').find('option'),function(k,v){
              if (($(v)[0].value).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
              {
                $(v).hide()
              } else {
                  $(v).show()
              }
            });
          })



          $("#teamFilterListSelected").empty()
          let loadIn = JSON.parse(localStorage.getItem('LighthouseJobViewAssetFilter')) || []
          loadIn.forEach(function(i){
            $("#teamFilterListSelected").append(`<option value=${i}>${i}</option>`);
          })

          $("#teamFilterListAll").empty()

          $('#asset-map-filter-loading').css("visibility", "unset");


  $.ajax({
  type: 'GET'
  , url: urls.Base+'/Api/v1/ResourceLocations/Radio?resourceTypes='
  , beforeSend: function(n) {
  n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
  }
  , cache: false
  , dataType: 'json'
  , data: {LighthouseFunction: 'NearestAsset', userId: user.Id}
  , complete: function(response, textStatus) {
  if (textStatus == 'success')
  {


    let sorted = response.responseJSON.map(function(i) {
      return i.properties.name
    })
    sorted.sort()


    sorted.forEach(function(v){

        $("#teamFilterListAll").append(`<option ${$('#teamFilterListSelected').find(`option[value|="${v}"]`).toArray().length ? "style='display:none' " : ''}value=${v}>${v}</option>`);

    })

    $('#asset-map-filter-loading').css("visibility", "hidden");


    $('#teamFilterListAll option').unbind().dblclick(function(x) {

      let option = $(`<option value="${x.target.value}">${x.target.value}</option>`)
      //click handler for unselecting
      option.dblclick(function(x) {
        if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
        {
          $('#teamFilterListAll').find(`option[value|="${x.target.value}"]`).show()
        }
        $(x.target).remove()
      });

      $(x.target).hide()
      $("#teamFilterListSelected").append(option);
    });

    $('#teamFilterListSelected option').unbind().dblclick(function(x) {

      if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
      {
        $('#teamFilterListAll').find(`option[value|="${x.target.value}"]`).show()
      }
      $(x.target).remove()
    });


    // response.responseJSON.forEach(function(v){
    //     $("#teamFilterListSelected").append(`<option value=${v.properties.name}>${v.properties.name}</option>`);
    // })
  }
}
})

  //render and fill moal
  $('#LHAssetFilterModal').modal();


  localStorage.setItem("LighthouseJobViewAssetLocationButton", 'filter');

} else { //skip all the UI and just load and go


    $('#assetLocationButtonFiltered').addClass('btn-active')
    $('#assetLocationButtonFiltered').removeClass('btn-inactive')


  var spinner = $(<i style="margin-left:5px" class="fa fa-refresh fa-spin fa-1x fa-fw"></i>)

  spinner.appendTo('#assetLocationButtonFiltered');

  renderNearestAssets({teamFilter: JSON.parse(localStorage.getItem('LighthouseJobViewAssetFilter')) || [], activeOnly: false, cb: function() {
    spinner.hide()
    $('#asset-route-warning').html(`Showing filtered list of assets`)
    $('#asset-route-warning').css("visibility", "unset");

  }})

}

}



//the quicktask button
$(quickTask).find('button').click(function() {
  if ($(quickTask).hasClass("open") == false)
  {
    InstantTaskButton()
  }
});

//the quicksector button
$(quickSector).find('button').click(function() {
  if ($(quickSector).hasClass("open") == false)
  {
    InstantSectorButton()
  }
});

//the quickcategory button
$(quickCategory).find('button').click(function() {
  if ($(quickCategory).hasClass("open") == false)
  {
    InstantCategoryButton()
  }
});


//add the radio log modal
$( "body" ).append(instantRadiologModal);

//the quick radio log button
$(quickRadioLog).find('button').click(function() {

  if (masterViewModel.teamsViewModel.taskedTeams.peek().length == 1 && $('#instantRadioLogCallSign').val() == '') {
    $('#instantRadioLogCallSign').val(masterViewModel.teamsViewModel.taskedTeams.peek()[0].Team.Callsign)
  }

  $('#instantradiologModal').modal()
});

// submit radio log on enter press in message body
$('#instantRadioLogText').keydown(function(event) {
    if (event.keyCode == 13) {
        processSubmitInstantRadioLog()
        return false;
     }
   })

//submit radio log on submit button press
$(instantRadiologModal).find('#submitInstantRadioLogButton').click(function() {
processSubmitInstantRadioLog()
});

//handle both the above submits
function processSubmitInstantRadioLog() {
  if ($('#instantRadioLogText').val() == '') {
    $('#instantRadioLogTextForm').addClass('has-error')
  } else {
submitInstantRadioLog($('#instantRadioLogCallSign').val(),$('#instantRadioLogText').val(),function(result) {
  if (result) {
    $('#instantradiologModal').modal('hide')
    $('#instantRadioLogTextForm').removeClass('has-error') //just incase
    $('#instantRadioLogText').val('')
  } else {
    alert('Error submitting log entry')
  }
})
}
}


whenJobIsReady(function(){


  if (masterViewModel.canTask.peek() == true) //this role covers sectors and category as well
  {
    $('#lighthouse_actions_content').append(quickTask, quickSector, quickCategory);

  }

  $('#lighthouse_actions_content').append(quickRadioLog);

  document.title = "#"+jobId;


});


whenTeamsAreReady(function(){

  lighthouseTasking()

  //Bold the team action taken
  $('#content div.col-md-5 div[data-bind="text: ActionTaken"]').css("font-weight", "bold");

  //checkbox for hide completed tasking
  $('#content div.col-md-5 div[data-bind="visible: teamsLoaded()"] div.widget-header').append(renderCheckBox());

  if (masterViewModel.sector.peek() !== null)
  {
    console.log('sector filter enabled')
    $('#lighthouse_actions div.widget-header').append(renderSectorFilterCheckBox());

    $('#lighthouseSectorFilterEnabled').click(function() {
      // Toggle Value
      var lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );
      // Save Value
      localStorage.setItem('LighthouseSectorFilterEnabled', lh_SectorFilterEnabled);
      sectorfilter_switch();
    });
    sectorfilter_switch();
  }

  $('#lighthouseEnabled').click(function() {
    // Toggle Value
    var lh_hideComplete = !( localStorage.getItem('LighthouseHideCompletedEnabled') == 'true' || localStorage.getItem('LighthouseHideCompletedEnabled') == null );
    // Save Value
    localStorage.setItem('LighthouseHideCompletedEnabled', lh_hideComplete);
    // Trigger Display Change
    jobView_teamsTasked_completedHiddenSwitch();
  });

  jobView_teamsTasked_itemsPrepare();
});

function sectorfilter_switch(){
  // Set flag
  var lh_SectorFilterEnabled = localStorage.getItem('LighthouseSectorFilterEnabled') == 'false';
  // Toggle class for checkbox
  $('#lighthouseSectorFilterEnabled')
    .toggleClass('fa-check-square-o', lh_SectorFilterEnabled)
    .toggleClass('fa-square-o', !lh_SectorFilterEnabled);
}





/**
 * Job View - Tasked Teams - Loop through tasked teams and add CSS class related to Status
 */
function jobView_teamsTasked_itemsPrepare(){
  // Loop through all Tasked Teams
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div')
    .each(function(k,v){
      var $t = $(v);
      var lastUpdate = $('span[data-bind^="text: CurrentStatus"]', $t).text();
      var b = false;
      // Strip Old Classes
      $t.attr('class', $t.attr('class').replace(/\bteamStatus_\S+\b/,' '));
      // Add new Class for Team Status
      if( b == /^(.+)\s+\(Logged:\s+([^)]+)\)/.exec(lastUpdate) ){
        $t.addClass('teamStatus_'+b[1].replace(/\s+/,'-').toLowerCase());
      }else{
        console.log('Unable to parse '+lastUpdate);
      }
    });
  jobView_teamsTasked_completedHiddenSwitch();
}

/**
 * Job View - Show/Hide Teams based on whether Team Status is Completed an Option is On/Off
 */
function jobView_teamsTasked_completedHiddenSwitch(){
  // Set flag
  var hideComplete = localStorage.getItem('LighthouseHideCompletedEnabled') == 'false';
  // Toggle Visibility of Tasked Teams
  // Non-Completed Crews
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div:not(.teamStatus_complete) > div.row:not(:first-child)').show();
  // Completed Crews
  $('div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div.teamStatus_complete > div.row:not(:first-child)').toggle(!hideComplete);
  // Toggle class for checkbox
  $('#lighthouseEnabled')
    .toggleClass('fa-check-square-o', hideComplete)
    .toggleClass('fa-square-o', !hideComplete);
}

/**
 * Job View - Toggle Visibility of Job
 */
function jobView_teamsTasked_showHiddenItem(e){
  // Tasked Team Clicked On
  var $t = $(e.currentTarget);
  // Only Toggle Content if the Clicked Team is Complete
  if( $t.hasClass('teamStatus_complete') )
    $t.children('div.row:gt(0)').stop(true).slideToggle();
}

/**
 * Subscribe to Tasked Team List - Reprocess list on change
 */
masterViewModel.teamsViewModel.taskedTeams.subscribe(jobView_teamsTasked_itemsPrepare);

/**
 * Attach Function to toggle Team Visibility on Click
 */
$(document).on('click',  'div.widget > div.widget-content > div[data-bind$="taskedTeams"] > div', jobView_teamsTasked_showHiddenItem);





function lighthouseTimeLineTPlus() {
  //messages can load before job created time has loaded
  whenJobIsReady(function(){
    let jobCreatedMoment = moment(masterViewModel.jobReceived())
    $('div[data-bind="foreach: jobHistory"] small[data-bind="text: moment(TimeStamp).format(utility.dtFormat)"]').each(function (r) {
      // weird race condition where they already have the attrib
      if ($(this).attr('lhTPlus') === undefined || $(this).attr('lhTPlus') === false) {
        let res = $(this).text()
        let tPlusText = returnTTime(res)
        $(this).attr('lhTPlus',tPlusText)
        $(this).text($(this).text().replace(res,`${res} (${tPlusText})`))
      }
    })
    console.log("lighthouseTimeLineTPlus Done calculating Tplus times")
  })
}

function lighthouseMessageTPlus(dom) {
  //messages can load before job created time has loaded
  whenJobIsReady(function(){
    dom.each(function (r) {
      // weird race condition where they already have the attrib
      if ($(this).attr('lhTPlus') === undefined || $(this).attr('lhTPlus') === false) {
        let res = $(this).text().match(/^(?:Received|Created) (?:at|on) (.+) by (.+)$/);
        if (res && res.length) {
          let tPlusText = returnTTime(res[1])
          $(this).attr('lhTPlus',tPlusText)
          $(this).text($(this).text().replace(res[1],`${res[1]} (${tPlusText})`))
        }
      }
    })
    console.log("lighthouseMessageTPlus Done calculating Tplus times")
  })
}

function returnTTime(messageDate) {
  let jobCreatedMoment = moment(masterViewModel.jobReceived())
  let end = moment(messageDate,'DD/MM/YYYY HH:mm')
  jobCreatedMoment.seconds(0) //zero the seconds because the log doesnt show seconds
  //work out if its T+ or T-
  let whichFirst = jobCreatedMoment.isBefore(end)
  let tPlus = moment.duration(end.diff(jobCreatedMoment));
  let years = whichFirst ? tPlus.years() : tPlus.years() * -1,
  days = whichFirst ? tPlus.days() : tPlus.days() * -1,
  hrs = whichFirst ? tPlus.hours() : tPlus.hours() * -1,
  hrsTotal = hrs + (24 * days),  //wont use days so make hours include days
  mins = whichFirst ? tPlus.minutes() : tPlus.minutes() * -1,
  secs = whichFirst ? tPlus.seconds() : tPlus.seconds() * -1,
  symbol = whichFirst ? '+' : '-'
  let tPlusText = `T${symbol}${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  return tPlusText
}

function lighthouseDictionary(){

  var $targetElements = $('.job-details-page div[data-bind="foreach: opsLogEntries"] div[data-bind="text: $data"]');

  var ICEMS_Dictionary = {
    'ASNSW'   : 'NSW Ambulance' ,
    'FRNSW'   : 'NSW Fire &amp; Rescue' ,
    'NSWPF'   : 'NSW Police Force' ,
    'TMC'     : 'Transport Management Center',
    'NSWTMC'  : 'NSW Transport Management Center',
    'KLO4'    : 'Keep a Look Out For',
    'AA'      : 'As Above' ,
    'INFTS?'  : 'Informant/Caller' ,
    '\\dPOBS?' : 'Person(s) On Board' ,
    'POIS?'   : 'Person(s) Of Interest' ,
    'POSS'    : 'Possible' ,
    'PTS?'    : 'Patient(s)' ,
    'VEHS?'   : 'Vehicle(s)' ,
    'VICT?'   : 'Victim' ,
    'Y[OR]'   : 'Years Old',
    'NPI'     : 'No Person(s) Injured',
    'NPT'     : 'No Person(s) Trapped',
    'NFI'     : 'No Further Information',
    'THX'     : 'Thanks',
    'NESB'    : 'Non-English Speaking Background',
    'YOM'     : 'Year Old Male',
    'YOF'     : 'Year Old Female'
  };

  $targetElements.each(function(v){
    var $t = $(this);
    var contentOrig = $t.html();
    var contentRepl = contentOrig;
    // '<br>' to HTML LineBreaks
    contentRepl = contentRepl.replace(/&lt;br(?:\s*\/)?&gt;/g, '<br />');
    // '\n' to HTML LineBreaks
    contentRepl = contentRepl.replace(/\s*\\n/, '<br />');
    // ICEMS Dictionary
    _.each(ICEMS_Dictionary, function(clearText, abbrText){
      var contentTemp = contentRepl;
      contentRepl = contentRepl.replace(new RegExp('\\b(' + abbrText + ')\\b', 'gi'), '<abbr title="' + clearText + '">$1</abbr>');
    });
    if(contentRepl != contentOrig){
      $t.html(contentRepl).addClass('lighthouseDictionary-modified');
    }else{
      $t.addClass('lighthouseDictionary-nomodifications');
    }
  });

}

if (document.getElementById("FinaliseQuickTextBox")) {
  document.getElementById("FinaliseQuickTextBox").onchange = function() {
    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
    masterViewModel.finalisationText(this.value);
  }
}

if (document.getElementById("CompleteQuickTextBox")) {
  document.getElementById("CompleteQuickTextBox").onchange = function() {
    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
    masterViewModel.finalisationText(this.value);
  }
}


masterViewModel.completeTeamViewModel.primaryActivity.subscribe(function(newValue) {
  if (typeof newValue !== 'undefined') {
    if (newValue !== null) {
      let quickText, i, opt;
      switch (newValue.Name) {
        case "Storm":
        removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
        quickText = ["", "No damage to property, scene safe. Resident to arrange for clean up.", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe.", "Branch/tree sectioned; resident/owner to organize removal"]
        document.getElementById("CompleteTeamQuickTextBox").removed
        for (i = 0; i < quickText.length; i++) {
          opt = document.createElement('option');
          opt.text = quickText[i];
          opt.value = quickText[i];
          document.getElementById("CompleteTeamQuickTextBox").add(opt);
        }
        break;
        case "Search":
        removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
        quickText = ["", "All teams complete on search, person found safe and well.", "All teams complete on search, nothing found."]
        for (i = 0; i < quickText.length; i++) {
          opt = document.createElement('option');
          opt.text = quickText[i];
          opt.value = quickText[i];
          document.getElementById("CompleteTeamQuickTextBox").add(opt);
        }
        break;
      }
    }
  }
});


function InstantCategoryButton() {
  if ( $(quickCategory).find('li').length < 1 ) {
    var categories = ["NA", "1", "2", "3", "4", "5"];
    let finalli = []
    categories.forEach(function(entry) {
      let item = (<li><a style="text-align:left" href="#">{entry}</a></li>);
      //click handler
      $(item).click(function (e) {
        SetCategory(entry)
        e.preventDefault();
      })
      finalli.push(item)
    })
    $(quickCategory).find('ul').append(finalli)
  }

  function SetCategory(id) {
    if (id == 'NA')
    {
      id = 0
    } else {
      id = parseInt(id)
    }
    $.ajax({
      type: 'POST'
      , url: urls.Base+'/Api/v1/Jobs/BulkCategorise'
      , beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
      }
      , data: {Id: id, Ids: [jobId], LighthouseFunction: 'SetCategory', userId: user.Id}
      , cache: false
      , dataType: 'json'
      , complete: function(response, textStatus) {
        if (response.status == 204)
        {
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }
    }
  })
  }

}

function InstantSectorButton() {

  $(quickSector).find('ul').empty();
  var loading = (<li><a href="#" style="text-align: center;"><i class="fa fa-refresh fa-spin fa-2x fa-fw"></i></a></li>)
  $(quickSector).find('ul').append(loading)

  //fetch the job and check its tasking status to ensure the data is fresh and not stale on page.
  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Sectors/Search?entityIds[]='+user.currentHqId+'&statusIds=1&viewModelType=2&pageSize=100&pageIndex=1'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'InstantSectorButton', userId: user.Id}
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
        if(response.responseJSON.Results.length) {
          $(quickSector).find('ul').empty();

          var data = response.responseJSON

          let finalli = []
          data.Results.forEach(function(entry) {
            let currentsector, item;
            if (masterViewModel.sector.peek() != null)
            {
              currentsector = masterViewModel.sector.peek().Id
            } else {
              currentsector = null
            }
            if (entry.Id != currentsector) //if its not the same as the current sector
            {
              item = (<li><a style="text-align:left" href="#">{entry.Name}</a></li>);
            } else { //if it is the same, make it bold.
              item = (<li><a style="text-align:left" href="#"><b>{entry.Name}</b></a></li>);
            }
            $(item).click(function (e) {
              SetSector(entry,currentsector)
              location.reload();
              //e.preventDefault();
            })
            finalli.push(item)
          })
          $(quickSector).find('ul').append(finalli)
        } else {
          $(quickSector).find('ul').empty();
          let no_results = (<li><a href="#">No Open Sectors</a></li>)
          $(quickSector).find('ul').append(no_results)
        }
      }
    }
  });

  function SetSector(sector,currentsector) {
    if (sector.Id != currentsector) //if its not the same as the current sector
    {
      $.ajax({
        type: 'PUT'
        , url: urls.Base+'/Api/v1/Sectors/'+sector.Id+'/Jobs'
        , beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        }
        , data: {IdsToAdd: [jobId], LighthouseFunction: 'SetSector', userId: user.Id}
        , cache: false
        , dataType: 'json'
        , complete: function(response, textStatus) {
          if (response.status == 200)
          {
            masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
            masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.sector(t.Sector)}) //update status
          }
        }
      });
    } else { //if its the same, then remove it.
      $.ajax({
        type: 'PUT'
        , url: urls.Base+'/Api/v1/Sectors/RemoveJobFromSector/'+jobId
        , beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        }
        , data: {LighthouseFunction: 'SetSector', userId: user.Id}
        , cache: false
        , dataType: 'json'
        , complete: function(response, textStatus) {
          if (response.status == 200)
          {
            masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
            masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.sector(t.Sector)}) //update status
          }
        }
      });
    }
  }
}

////Quick Task Stuff
function InstantTaskButton() {

  var alreadyTasked = []
  $.each(masterViewModel.teamsViewModel.taskedTeams.peek(), function(k,v){

    if(v.CurrentStatusId != 6 && v.CurrentStatusId != 7)
    {
      alreadyTasked.push(v.Team.Id);
    }
  });

  $(quickTask).find('ul').empty();
  var loading = (<li><a href="#" style="text-align: center;"><i class="fa fa-refresh fa-spin fa-2x fa-fw"></i></a></li>);
  $(quickTask).find('ul').append(loading);

  let lh_SectorFilterEnabled = !( localStorage.getItem('LighthouseSectorFilterEnabled') == 'true' || localStorage.getItem('LighthouseSectorFilterEnabled') == null );

  var sectorFilter = null;
  if (masterViewModel.sector.peek() !== null && lh_SectorFilterEnabled === true )
  {
    sectorFilter = masterViewModel.sector.peek().Id
  }

  console.log("Sector Filter is:"+sectorFilter)

  //fetch the job and check its tasking status to ensure the data is fresh and not stale on page.
  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Jobs/'+jobId+'?viewModelType=2'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , cache: false
    , dataType: 'json'
    , data: {LighthouseFunction: 'QuickTaskGetJob', userId: user.Id}
    , complete: function(response, textStatus) {

      if (textStatus == 'success')
      {
        var data = response.responseJSON

        if (data.JobStatusType.Id == 1 || data.JobStatusType.Id == 2 || data.JobStatusType.Id == 4 || data.JobStatusType.Id == 5) //New or Active or Tasked or Refered
        {

          ReturnTeamsActiveAtLHQ(user.hq,sectorFilter,function(response){

            if(response.responseJSON.Results.length) {
              $(quickTask).find('ul').empty();

              /////
              ///// Search Box
              /////
              let theSearch = return_search_box();
              $(theSearch).click(function (e) {
                e.stopPropagation();
              });

              $(theSearch).keyup(function (e) {
                e.stopPropagation();
                $.each($(quickTask).find('ul').find('li[role!="presentation"]'),function(k,v){
                  if (($(v)[0].innerText).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
                  {
                    $(v).hide()
                  } else {
                    $(v).show()
                  }
                });
                $.each($(quickTask).find('ul').find('li[role="presentation"]'),function(k,v){
                  let childrenVis = false
                  let nextChild = $(v).next()
                  // walk the neighbours of the li, if they are displayed then dont hide the pres li, otherwise hide it. wish this was a nested DOM!
                  while (nextChild != null)
                  {
                    if ($(nextChild).css('display') != undefined) //next might not be a valid dom, cause next seems to keep going when there is no next!
                    {
                      if ( $(nextChild).css('display') != 'none'){ //if hidden
                        childrenVis = true
                      }
                    }
                    if ($(nextChild).length == 0 || $(nextChild).next().attr('role') == 'presentation') //if this is a valid dom, and the next one isnt pres. next wont ever stop and will just return a 0 lenght
                    {
                      nextChild = null
                    } else {
                      nextChild = $(nextChild).next()
                    }
                  }
                  if (childrenVis != true) //hide or show the pres depending on its children
                  {
                    $(v).hide()
                  } else {
                    $(v).show()
                  }
                });
              });
              /////
              ///// END Search Box
              /////
              $(quickTask).find('ul').append(theSearch);

              let sector = {}
              let nonsector = []
              $.each(response.responseJSON.Results, function(k, v) { //for every team that came back
                if ($.inArray(v.Id,alreadyTasked) == -1) //not a currently active team on this job, so we can task them
                {
                  var item = null;
                  if (v.Members.length == 0)
                  {
                    item = return_li(v.Id,v.Callsign.toUpperCase(),null,v.TaskedJobCount+"");
                  } else {
                    $(v.Members).each(function(k, vv) {
                      if (vv.TeamLeader)
                      {
                        item = return_li(v.Id,v.Callsign.toUpperCase(),vv.Person.FirstName+" "+vv.Person.LastName,v.TaskedJobCount+"");
                      }
                    });
                  }
                  //still create teams that have no TL
                  if (item === null) {
                    item = return_li(v.Id,v.Callsign.toUpperCase(),"No TL",v.TaskedJobCount+"");
                  }

                  if (v.Sector === null)
                  {
                    nonsector.push(item)
                  } else {
                    var sectorName = v.Sector.Name;
                    if (sectorName in sector)
                    {
                      sector[sectorName].push(item)
                    } else {
                      sector[sectorName] = [item]
                    }
                  }

                  //click handler
                  $(item).click(function (e) {
                    TaskTeam(v.Id)
                    e.preventDefault();
                  })

                }
              });

              let finalli = [];
              let drawnsectors = [];

              //finalli.push(return_lipres(masterViewModel.sector.peek().Name+" Sector Teams"));
              $.each(sector, function(k, v){
                if (k in drawnsectors)
                {
                  finalli.push(v);
                } else {
                  drawnsectors.push(k);
                  //if (finalli.length != 0) { finalli.push(return_lidivider()) };
                  finalli.push(return_lipres(k+ " Sector"))
                  finalli.push($(v))
                }
              });
              if (nonsector.length) {
              //finalli.push(return_lidivider());
              finalli.push(return_lipres("Unsectorised Teams"));
              $.each(nonsector, function(k, v){
                finalli.push(v);
              })
            }
              $(quickTask).find('ul').append(finalli);

            } else {
              $(quickTask).find('ul').empty();
              let no_results = (<li><a href="#">No Active Field Teams</a></li>);
              $(quickTask).find('ul').append(no_results);
            }

          });

        } else { //job has changed status since it was opened so warn them
          $(quickTask).find('ul').empty();
          let no_results = (<li><a href="#">Cannot task when job status is {masterViewModel.jobStatus.peek().Name}. Refresh the page!</a></li>)
          $(quickTask).find('ul').append(no_results)
        }
      }
    }
  });

}

////Instant radio log stuff
function submitInstantRadioLog(subject, text,cb) {
  masterViewModel.notesViewModel.OperationsLogManager.CreateEntry(jobId, null, null, null, subject || "Instant Radio Log", text, null, null, null, !1, !1, false, null, [15,6], null, function(res) {
if (res) {
      masterViewModel.notesViewModel.loadOpsLogPage()
      cb(true)
    } else {
      cb(false)
    }
})

}


function TaskTeam(teamID) {
  var data = {};
  var TeamIds = [];
  TeamIds.push(teamID);
  var JobIds = [];
  JobIds.push(jobId);


  $.ajax({
    type: 'POST'
    , url: urls.Base+'/Api/v1/Tasking'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: JSON.stringify({TeamIds:TeamIds, JobIds:JobIds, LighthouseFunction: 'TaskTeam', userId: user.Id})
    , cache: false
    , dataType: "json"
    , contentType: "application/json; charset=utf-8"
    , complete: function(response, textStatus) {
      if (textStatus == 'success' || textStatus == 'error') //work around for beacon bug returning error 500 for no reason
      {
        masterViewModel.teamsViewModel.loadTaskedTeams() //load teams
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }
    }
  });
}

function return_search_box() {
  return (
    <input type="text" style="width: 95%; margin:auto" id="filterquicksearch" maxlength="30" class="form-control input-sm" placeholder="Filter"></input>
  );
}

function return_li(id, callsign, teamleader, JobCount) {
  if (teamleader != null)
  {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <small>{teamleader}<sup>TL</sup></small></a></li>
    );
  } else {
    return(
      <li><a style="text-align:left" href="#"><b>{callsign}</b> - <i><small>No Members</small></i></a></li>
    );
  }
}

function return_lipres(title) {
  return(
    <li style="text-align:left" role="presentation" class="dropdown-header">{title}</li>
  );
}

function return_lidivider() {
  return(
    <li role="presentation" class="divider"></li>
  );
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function removeOptions(selectbox) {
  for (var i = selectbox.options.length - 1; i >= 0; i--) {
    selectbox.remove(i);
  }
}

//take the clicked list option and set the complete action the value of this.
document.getElementById("CompleteTeamQuickTextBox").onchange = function() {
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.completeTeamViewModel.actionTaken(this.value);
}

function return_untask_button() {
  return (<span id="untask" class="close" style="
    margin-right: -12px;
    margin-top: -12px;
    margin-left: 10px;
    ">×</span>);
}
function return_message_button() {
  return (<span id="message" class="close fa fa-envelope" style="
    margin-left: 5px;
    float: none !important;
    "></span>);
}



$(document).ready(function() {



  moment.updateLocale('en', {
    relativeTime: {
      future : 'in %s',
      past   : '%s ago',
      s  : function (number, withoutSuffix) {
        return withoutSuffix ? 'now' : 'a few seconds';
      },
      m  : '1m',
      mm : '%dm',
      h  : '1h',
      hh : '%dh',
      d  : '1d',
      dd : '%dd',
      M  : '1mth',
      MM : '%dmth',
      y  : '1y',
      yy : '%dy'
    }
  });

  _.each([
      ["#stormtree", "Storm", "Tree Operations/Removal"],
      ["#stormproperty", "Storm", "Property Protection"],
      ["#stormsafety", "Storm", "Public Safety"],
      ["#stormaccess", "Storm", "Road/Access Clearance"],
      ["#stormrecon", "Storm", "Reconnaissance"],
      ["#rcrcalloff", "RoadCrashRescue", "Call Off"],
      ["#rcrcallextricate", "RoadCrashRescue", "Extrication "],
    ], function(args) {
      var selector = args[0]
      , parent = args[1]
      , child = args[2];

      $(args[0]).click(function() {
        masterViewModel.completeTeamViewModel.availablePrimaryActivities.peek().forEach(function(d){
          if (d.Name == parent) {
            masterViewModel.completeTeamViewModel.primaryActivity(d);
            masterViewModel.completeTeamViewModel.availablePrimaryTasks.subscribe(function(d) {
              d.forEach(function(d) {
                if (d.Name == child) {
                  masterViewModel.completeTeamViewModel.primaryTask(d)
                }
              });
            })
          }
        });
      });
    });
});

function return_quicktaskbutton() {
  return (
    <div id="lighthouse_instanttask" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-warning dropdown-toggle" type="button" data-toggle="dropdown" id="lhtaskbutton"><i class="fa fa-tasks" style="padding-right: 5px;"></i>Instant Task
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quicksectorbutton() {
  return (
    <div id="lighthouse_instantsector" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-info dropdown-toggle" type="button" data-toggle="dropdown" id="lhsectorbutton"><i class="fa fa-cubes" style="padding-right: 5px;"></i>Instant Sector
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quickcategorybutton() {
  return (
    <div id="lighthouse_instantcategory" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;" class="dropdown">
      <button class="btn btn-sm btn-default dropdown-toggle" type="button" data-toggle="dropdown" id="lhcategorybutton"><i class="fa fa-database" style="padding-right: 5px;"></i>Instant Category
      <span class="caret"></span></button>
      <ul class="dropdown-menu scrollable-menu">
      </ul>
    </div>
  );
}

function return_quickradiologbutton() {
  return (
    <div id="lighthouse_instantradiolog" style="position:relative;display:inline-block;vertical-align:middle;padding-left:3px;padding-right:3px;">
      <button class="btn btn-sm btn-default" style="background-color: #837947;border-color: #837947" type="button" id="lhinstantradiologbutton"><i class="fa fa-microphone" style="padding-right: 5px;"></i>Instant Radio Log
      </button>
    </div>
  );
}

function return_quickradiologmodal() {
  return (
    <div class="modal fade" id="instantradiologModal" role="dialog" style="display: none;">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
            <h4 class="modal-title"><i class="fa fa-microphone"></i> Instant Radio Log Entry | Job</h4>
          </div>
          <div class="modal-body">
          <div class="form-group" title="">
            <div class="row">
              <label class="col-md-4 col-lg-3 control-label">Callsign</label>
              <div class="col-md-8 col-lg-9">
                <textarea id="instantRadioLogCallSign" class="form-control" rows="1"></textarea>
              </div>
              <div title="">
              </div>
            </div>
          </div>
            <div class="form-group" title="" id="instantRadioLogTextForm">
              <div class="row">
                <label class="col-md-4 col-lg-3 control-label">Note</label>
                <div class="col-md-8 col-lg-9">
                  <textarea id="instantRadioLogText" class="form-control"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-info" id="submitInstantRadioLogButton"><span class="button-text">Submit</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function return_quicketarow() {
  return (
      <div style="display: inline-block">
        <span id="5min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+5min</span>
        </span>
        <span id="10min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+10min</span>
        </span>
        <span id="15min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+15min</span>
        </span>
        <span id="30min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+30min</span>
        </span>
        <span id="60min" class="label tag tag-darkgreen tag-disabled">
          <span class="tag-text"><img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
          src={lighthouseUrl+"icons/lh.png"} />+60min</span>
        </span>
      </div>
  );
}

function return_quicketamoment() {
  return (
      <div style="padding-left: 5px" id="quickETAtext">
      </div>
  );
}

function checkAddressHistory(){
  var date_options = {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };

  var address = masterViewModel.geocodedAddress();
  if(typeof address == 'undefined') {
    // address not available yet (probably waiting for server to respond to
    // AJAX. Try again soon.
    setTimeout(checkAddressHistory, 500);
    return;
  }

  //dont allow searches if the job has not been geocoded
  if(address.Street == null && address.Locality == null && address.Latitude == null && address.Longitude== null) {
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Not Geocoded).<br/>' +
      ( masterViewModel.canEdit()
        ? '<a href="/Jobs/' + jobId + '/Edit' + '">Please edit the job and geocode the job location.</a>'
        : 'Have an authorised user edit the job and geocode the job location.' ) + '</em>'
      );
  }

  //addresses with only GPS
  if(address.Street == null && address.Locality == null) {
    return $('#job_view_history_container').empty().append(
      '<em>Unable to Perform Address Search. Address does not appear valid (Only GPS Lat/Long).<br/>' +
      'Please edit the job and geocode the job location.</em>'
      );
  }

  var q;
  if(address.Street == null && address.Locality == null) {
    // address without a street or address but still geocoded
    q = address.PrettyAddress;
  } else {
    q = address.Street + ', ' + address.Locality;
  }
  q = q.substring(0, 30);

  var start = moment();
  var now = new Date;
  var end = moment();
  end.subtract(1, 'y');

  $.ajax({
    type: 'GET'
    , url: urls.Base+'/Api/v1/Jobs/Search'
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: {
      'Q':                    q.substring(0, 30)
      , 'StartDate':          end.toISOString()
      , 'EndDate':            start.toISOString()
      , 'ViewModelType':      2
      , 'PageIndex':          1
      , 'PageSize':           1000
      , 'SortField':          'JobReceived'
      , 'SortOrder':          'desc'
      , 'LighthouseFunction': 'checkAddressHistory'
      , 'userId':             user.Id
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      var $job_view_history_container = $('#job_view_history_container');
      let content;
      switch(textStatus){
        case 'success':
        if(response.responseJSON.Results.length) {
          var history_rows = {
            'exact':     {
              title :       'Same Address' ,
              key :         'exact' ,
              always_show : true ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        []
            } ,
            'partial':   {
              title :       'Apartment, Townhouse or Battleaxe' ,
              key :         'partial' ,
              always_show : false ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        []
            } ,
            'neighbour': {
              title :       'Immediate Neighbours' ,
              key :         'neighbour' ,
              always_show : false ,
              hide_old :    false ,
              has_old :     false ,
              jobs :        []
            } ,
            'street':    {
              title :       'Same Street' ,
              key :         'street' ,
              always_show : false ,
              hide_old :    true ,
              has_old :     false ,
              jobs :        []
            }
          };
          const status_groups = {
            'active' :    ['new', 'acknowledged', 'active', 'tasked', 'referred'] ,
            'complete' :  ['complete', 'finalised'] ,
            'cancelled' : ['cancelled', 'rejected']
          };

          if(address.StreetNumber != null){
            var re_StreetNumber_Parts = /^(?:(\d+)\D)?(\d+)\D*/;
            var jobAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
              address.StreetNumber);
            var jobAddress_StreetNumber_Max = parseInt(
              jobAddress_StreetNumber_tmp[2], 10);
            var index = typeof jobAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
            var jobAddress_StreetNumber_Min = parseInt(
              jobAddress_StreetNumber_tmp[index], 10);
          }
          $.each(response.responseJSON.Results, function(k, v) {
              // Job Group
              var result_group = 'street';

              // History Job is Current Job
              if(v.Id == jobId) return true;

              // Santitise and Pre-Process Job Details (for later display)
              // Job URL
              v.url = '/Jobs/'+v.Id;
              // Adjust the Job Recieved Time
              v.JobReceived = new Date(v.JobReceived);
              // Generate the Relative Time
              v.relativeTime = moment(v.JobReceived).fromNow();
              // Is the Job Older than 14 Days
              v.isold = ( v.JobReceived.getTime() < ( now.getTime() - 14 * 24 * 60 * 60 * 1000 ) );
              // Default value for Situation on Scene
              if(v.SituationOnScene == null) v.SituationOnScene = (<em>View job for more detail</em>);
              // Job Tags
              var tagArray = [];
              $.each( v.Tags , function( tagIdx , tagObj ){
                tagArray.push( tagObj.Name );
              });
              v.tagString = ( tagArray.length ? tagArray.join(', ') : (<em>No Tags</em>) );
              // Job CSS Classes
              v.cssClasses = 'job_view_history_item job_view_history_item_status_' + v.JobStatusType.Name.toLowerCase();
              var jobGroups = [];
              $.each(status_groups, function(status_group, statuses) {
                if(statuses.indexOf(v.JobStatusType.Name.toLowerCase()) >= 0)
                  jobGroups.push(status_group);
              });
              if(jobGroups.length) v.cssClasses += ' job_view_history_item_statusgroup_' + jobGroups.join(' job_view_history_item_statusgroup_');
              if(v.isold) {
                v.cssClasses += ' job_view_history_item_old';
                if(jobGroups.indexOf('active') == -1) {
                  v.cssClasses += ' job_view_history_item_toggle';
                }
              }

              // Unless we have a Street Number for Current and Historic, we can only match the street
              if(v.Address.StreetNumber != null && address.StreetNumber != null && !address.StreetNumber.match(/Lot/i) && !v.Address.StreetNumber.match(/Lot/i)) {

                if(v.Address.PrettyAddress == address.PrettyAddress) {
                  // Perfect Match
                  result_group = 'exact';
                } else if(v.Address.StreetNumber.replace(/\D+/g, '') == address.StreetNumber.replace(/\D+/g, '')){
                  // Not an exact address match, so include the address in the result row
                  result_group = 'partial';
                } else {
                  var rowAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec(
                    v.Address.StreetNumber);
                  var rowAddress_StreetNumber_Max = parseInt(
                    rowAddress_StreetNumber_tmp[2], 10);
                  var index = typeof rowAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1;
                  var rowAddress_StreetNumber_Min = parseInt(
                    rowAddress_StreetNumber_tmp[index], 10);
                  if (Math.abs(jobAddress_StreetNumber_Min - rowAddress_StreetNumber_Max) == 2 ||
                    Math.abs(jobAddress_StreetNumber_Max - rowAddress_StreetNumber_Min) == 2) {
                    result_group = 'neighbour';
                }
              }

            }

              // Push Job to Job Array
              history_rows[result_group].jobs.push(v);
              if(v.isold) history_rows[result_group].has_old = true;
            }); // Loop End - response.responseJSON.Results

            // Use JSX to Render
            $job_view_history_container.html(
              <div>
              {_.map(_.filter(history_rows, function(row) { return row.always_show || row.jobs.length; }), function(groupData, groupKey){
                return (
                  <fieldset id={"job_view_history_group_" + groupData.key } class={"job_view_history_group col-md-12" + (groupData.hide_old ? " job_view_history_showtoggle" : "")}>
                  <legend>
                  {groupData.title}
                  <span class="group_size">{groupData.jobs.length + ' Job' + (groupData.jobs.length == 1 ? '' : 's')}</span>
                  </legend>
                  <div class="form-group col-xs-12">
                  {(groupData.jobs.length == 0
                    ? <div class="job_view_history_none"><em>No Jobs Found</em></div>
                    : _.map(groupData.jobs, function(j){
                      return (
                        <div class={j.cssClasses}>
                        <div class="job_view_history_title">
                        <a href={j.url} class="job_view_history_id">{j.Identifier}</a>
                        <span class="job_view_history_address">{j.Address.PrettyAddress}</span>
                        <span class="job_view_history_status">{j.JobStatusType.Name}</span>
                        </div>
                        <div class="job_view_history_situation">{j.SituationOnScene}</div>
                        <div class="job_view_history_tags">
                        <i class="fa fa-tags"></i>
                        {j.tagString}
                        </div>
                        <div class="job_view_history_time">{j.relativeTime}</div>
                        </div>
                        );
                    })
                    )}
                  </div>
                  </fieldset>
                );
              })}
              </div>
            );

            // Show/Hide Handler
            var $job_view_history_toggle_old = $( <div class="job_view_history_toggle_old"><span>Show</span> Older Jobs</div> )
            .click(function() {
              var $t = $(this);
              var $p = $t.closest('fieldset.job_view_history_group');
              var $old_rows = $('div.job_view_history_item_toggle', $p);
              var toshow = $old_rows.filter(':hidden').length > 0;
              $old_rows.toggle(toshow);
              $('span', $t).text(toshow ? 'Hide' : 'Show');
            });
            $('fieldset.job_view_history_showtoggle')
            .each(function(k ,v){
              var $v = $(v);
              if($('div.job_view_history_item_toggle', $v).length){
                $('div.form-group', $v).append($job_view_history_toggle_old);
              }
            });

            // We've Inserted the History - Stop Here
            return;
          }
          content = '<em>Address Search - No History</em>';
          break;
          case 'error' :
          content = '<em>Unable to Perform Address Search</em>';
          break;
          case 'nocontent' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
          case 'timeout' :
          content = '<em>Address Search Timed Out</em>';
          break;
          case 'abort' :
          content = '<em>Address Search Aborted</em>';
          break;
          case 'parsererror' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
        }

      // Showing an Error Message
      $job_view_history_container.html(content);
    }
  });
}

setTimeout(checkAddressHistory, 400);

// wait for teams to have loaded
function whenTeamsAreReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel != "undefined" & masterViewModel.teamsViewModel.teamsLoaded.peek() == true) {
      console.log("teams are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

// wait for address to have loaded
function whenAddressIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof masterViewModel !== "undefined" & masterViewModel.geocodedAddress != "undefined") {
      if (typeof masterViewModel.geocodedAddress.peek() != "undefined" && masterViewModel.geocodedAddress.peek() !== null)
      {
        console.log("address is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }
}, 200);
}

// wait for urls to have loaded
function whenUrlIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof urls !== "undefined" & typeof urls.Base !== "undefined") {
      if (urls.Base !== null)
      {
        console.log("urls is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }
}, 200);
}

// wait for job to have loaded
function whenJobIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
      if (masterViewModel.jobLoaded() == true)
      {
        console.log("job is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
}, 200);
}

//checkbox for hide completed tasking

function renderSectorFilterCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseSectorFilterEnabled" class="fa fa-lg"></span>
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Instant Filter by Sector
    </span>
    );
}

function renderCheckBox() {
  return (
    <span class="pull-right h6">
    <span id="lighthouseEnabled" class="fa fa-lg"></span>
    <img style="width:16px;vertical-align:top;margin-right:5px;margin-left:5px"
    src={lighthouseUrl+"icons/lh-black.png"} /> Collapse Completed Tasking
    </span>
    );
}

function untaskTeamFromJob(TeamID, JobID, TaskingID) {
  $.ajax({
    type: 'DELETE'
    , url: urls.Base+'/Api/v1/Tasking/'+TaskingID
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    }
    , data: {
      'Id':       TaskingID
      ,'TeamId':    TeamID
      , 'JobId':    JobID
      ,'LighthouseFunction': 'untaskTeamFromJob'
      ,'userId': user.Id
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
        masterViewModel.teamsViewModel.loadTaskedTeams() //load teams
        masterViewModel.JobManager.GetHistory(jobId,function(t){masterViewModel.jobHistory(t)}) //load job history
        masterViewModel.JobManager.GetJobById(jobId,Enum.JobViewModelType.Full.Id,function(t){masterViewModel.jobStatus(t.JobStatusType)}) //update status
      }

    }
  })
}

function pad(n, z) {
  z = z || '0';
  n = n + '';
  return n.length >= 2 ? n : new Array(2 - n.length + 1).join(z) + n;
}

function radians(n) {
  return n * (Math.PI / 180);
}
function degrees(n) {
  return n * (180 / Math.PI);
}

function getBearing(startLat,startLong,endLat,endLong){
  startLat = radians(startLat);
  startLong = radians(startLong);
  endLat = radians(endLat);
  endLong = radians(endLong);

  var dLong = endLong - startLong;

  var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
  if (Math.abs(dLong) > Math.PI){
    if (dLong > 0.0)
       dLong = -(2.0 * Math.PI - dLong);
    else
       dLong = (2.0 * Math.PI + dLong);
  }

  return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}


function getCardinal(angle) {
  /**
   * Customize by changing the number of directions you have
   * We have 8
   */
  const degreePerDirection = 360 / 8;

  /**
   * Offset the angle by half of the degrees per direction
   * Example: in 4 direction system North (320-45) becomes (0-90)
   */
  const offsetAngle = angle + degreePerDirection / 2;

  return (offsetAngle >= 0 * degreePerDirection && offsetAngle < 1 * degreePerDirection) ? "North"
    : (offsetAngle >= 1 * degreePerDirection && offsetAngle < 2 * degreePerDirection) ? "NE"
      : (offsetAngle >= 2 * degreePerDirection && offsetAngle < 3 * degreePerDirection) ? "East"
        : (offsetAngle >= 3 * degreePerDirection && offsetAngle < 4 * degreePerDirection) ? "SE"
          : (offsetAngle >= 4 * degreePerDirection && offsetAngle < 5 * degreePerDirection) ? "South"
            : (offsetAngle >= 5 * degreePerDirection && offsetAngle < 6 * degreePerDirection) ? "SW"
              : (offsetAngle >= 6 * degreePerDirection && offsetAngle < 7 * degreePerDirection) ? "West"
                : "NW";
}

function StandardDeviation(numbersArr) {
    //--CALCULATE AVAREGE--
    var total = 0;
    for(let key in numbersArr)
       total += numbersArr[key];
    var meanVal = total / numbersArr.length;
    //--CALCULATE AVAREGE--

    //--CALCULATE STANDARD DEVIATION--
    var SDprep = 0;
    for(let key in numbersArr)
       SDprep += Math.pow((parseFloat(numbersArr[key]) - meanVal),2);
    var SDresult = Math.sqrt(SDprep/numbersArr.length);
    //--CALCULATE STANDARD DEVIATION--
    return(SDresult);

}

//-- Define radius function
if (typeof (Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    }
}

//-- Define degrees function
if (typeof (Number.prototype.toDeg) === "undefined") {
    Number.prototype.toDeg = function () {
        return this * (180 / Math.PI);
    }
}


//-- Define middle point function
function middlePoint(lat1, lng1, lat2, lng2) {

    //-- Longitude difference
    var dLng = (lng2 - lng1).toRad();

    //-- Convert to radians
    lat1 = lat1.toRad();
    lat2 = lat2.toRad();
    lng1 = lng1.toRad();

    var bX = Math.cos(lat2) * Math.cos(dLng);
    var bY = Math.cos(lat2) * Math.sin(dLng);
    var lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bX) * (Math.cos(lat1) + bX) + bY * bY));
    var lng3 = lng1 + Math.atan2(bY, Math.cos(lat1) + bX);

    //-- Return result
    return [lng3.toDeg(), lat3.toDeg()];
}


function randomIntFromInterval(min, max) { // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

//Credit D3: https://github.com/d3/d3-array/blob/master/LICENSE
  function quantileSorted(values, p, fnValueFrom) {
    var n = values.length;
    if (!n) {
      return;
    }

    fnValueFrom =
      Object.prototype.toString.call(fnValueFrom) == "[object Function]"
        ? fnValueFrom
        : function (x) {
            return x;
          };

    p = +p;

    if (p <= 0 || n < 2) {
      return +fnValueFrom(values[0], 0, values);
    }

    if (p >= 1) {
      return +fnValueFrom(values[n - 1], n - 1, values);
    }

    var i = (n - 1) * p,
      i0 = Math.floor(i),
      value0 = +fnValueFrom(values[i0], i0, values),
      value1 = +fnValueFrom(values[i0 + 1], i0 + 1, values);

    return value0 + (value1 - value0) * (i - i0);
  }

  function fetchHqDetails(HQName, cb) {
     var hq = {}
     $.ajax({
         type: 'GET'
         , url: urls.Base+'/Api/v1/Headquarters/Search?Name='+HQName
         , beforeSend: function(n) {
             n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
         },
         cache: false,
         dataType: 'json',
         complete: function(response, textStatus) {
             if (textStatus == 'success') {
                 if (response.responseJSON.Results.length) {
                     var v = response.responseJSON.Results[0]
                     hq.Entity = v.Entity
                     v.Entity.EntityTypeId = 1 //shouldnt be using entity for filters, so add the missing things
                     hq.HeadquartersStatus = v.HeadquartersStatusType.Name
                     fetchHqAccreditations(v.Id,function(acred){
                         hq.acred = []
                         $.each(acred,function(k,v){
                             if (v.HeadquarterAccreditationStatusType.Id == 1) //1 is available. everything else is bad. only return what is avail
                             {
                                 hq.acred.push(v.HeadquarterAccreditationType.Name)
                             }
                         })
                         if (typeof(hq.contacts) !== 'undefined' && typeof(hq.currentJobCount) !== 'undefined' && typeof(hq.currentTeamCount) !== 'undefined') //lazy mans way to only return once all the data is back
                         {
                             cb(hq)
                         }
                     })
                     fetchHqJobCount(v.Id,function(jobcount){
                         hq.currentJobCount = jobcount //return a count
                         if (typeof(hq.contacts) !== 'undefined' && typeof(hq.acred) !== 'undefined'  && typeof(hq.currentTeamCount) !== 'undefined') //lazy mans way to only return once all the data is back
                         {
                             cb(hq)
                         }
                     })
                     fetchHqTeamCount(v.Id,function(teamcount){
                         hq.currentTeamCount = teamcount //return a count
                         if (typeof(hq.contacts) !== 'undefined' && typeof(hq.acred) !== 'undefined' && typeof(hq.currentJobCount) !== 'undefined') //lazy mans way to only return once all the data is back
                         {
                             cb(hq)
                         }
                     })
                     fetchHqContacts(v.Id,function(contacts){ //lazy mans way to only return once all the data is back
                         hq.contacts = contacts //return them all
                         if (typeof(hq.currentJobCount) !== 'undefined' && typeof(hq.acred) !== 'undefined'  && typeof(hq.currentTeamCount) !== 'undefined')
                         {
                             cb(hq)
                         }
                     })
                 }
             }
         }
     })
 }

 function fetchHqAccreditations(HQId,cb) {
    $.ajax({
        type: 'GET'
        , url: urls.Base+'/Api/v1/HeadquarterAccreditations/'+HQId
        , beforeSend: function(n) {
            n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        },
        cache: false,
        dataType: 'json',
        complete: function(response, textStatus) {
            if (textStatus == 'success') {
                cb(response.responseJSON.HeadquarterAccreditationMappings)
            }
        }
    })
}

function fetchHqJobCount(HQId,cb) {
   $.ajax({
       type: 'GET'
       , url: urls.Base+'/Api/v1/Jobs/Search?StartDate=&EndDate=&Hq='+HQId+'&JobStatusTypeIds%5B%5D=2&JobStatusTypeIds%5B%5D=1&JobStatusTypeIds%5B%5D=5&JobStatusTypeIds%5B%5D=4&ViewModelType=5&PageIndex=1&PageSize=100'
       , beforeSend: function(n) {
           n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
       },
       cache: false,
       dataType: 'json',
       complete: function(response, textStatus) {
           if (textStatus == 'success') {
               cb(response.responseJSON.TotalItems) //return the count of how many results.
           }
       }
   })
}

function fetchHqTeamCount(HQId,cb) {
   $.ajax({
       type: 'GET'
       , url: urls.Base+'/Api/v1/Teams/Search?StatusStartDate=&StatusEndDate=&AssignedToId='+HQId+'&StatusTypeId%5B%5D=3&IncludeDeleted=false&PageIndex=1&PageSize=200&SortField=CreatedOn&SortOrder=desc'
       , beforeSend: function(n) {
           n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
       },
       cache: false,
       dataType: 'json',
       complete: function(response, textStatus) {
           if (textStatus == 'success') {
               cb(response.responseJSON.TotalItems) //return the count of how many results.
           }
       }
   })
}

function fetchHqContacts(HQId,cb) {
   $.ajax({
       type: 'GET'
       , url: urls.Base+'/Api/v1/Contacts/Search?HeadquarterIds='+HQId+'&PageIndex=1&PageSize=50&SortField=createdon&SortOrder=asc'
       , beforeSend: function(n) {
           n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
       },
       cache: false,
       dataType: 'json',
       complete: function(response, textStatus) {
           if (textStatus == 'success') {
               cb(response.responseJSON.Results) //return everything as they are all useful
           }
       }
   })
}
