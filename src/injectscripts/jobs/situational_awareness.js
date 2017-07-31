
window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let map = window['map'];
    let lighthouseMap = new LighthouseMap(map);
    lighthouseMap.createLayer('rfs');
    lighthouseMap.createLayer('transport-incidents');
    lighthouseMap.createLayer('transport-flood-reports');
    lighthouseMap.createLayer('transport-cameras');

    lighthouseMap.createLayer('helicopters');

    if (developmentMode) {
        // Add a test point
        lighthouseMap.layers['default'].addImageMarker(-33.798796, 150.997393, lighthouseIcon, 'Parramatta SES',
            'This is a test marker. It is used to check whether the map access is working');
    }
    window['lighthouseMap'] = lighthouseMap;

    let buttons = ['toggleRfsIncidentsBtn', 'toggleRmsIncidentsBtn', 'toggleRmsFloodingBtn', 'toggleRmsCamerasBtn', 'toggleHelicoptersBtn'];
    buttons.forEach(function (buttonId) {
        if (localStorage.getItem('Lighthouse-' + buttonId) == 'true') {
            let button = $(`#${buttonId}`);
            console.debug(buttonId + ' restoring saved state of clicked');
            button.trigger('click');
        }
    });
}

window.addEventListener("message", function(event) {
    // We only accept messages from ourselves
    if (event.source !== window)
        return;

    const lighthouseMap = window['lighthouseMap'];

    if (event.data.type) {
        if (event.data.type === "LH_REQUEST_HELI_PARAMS") {
            let params = buildHeliParams();
            window.postMessage({ type: 'LH_RESPONSE_HELI_PARAMS', params: params }, '*');

        } else if (event.data.type === "LH_UPDATE_LAYERS_DATA") {
            let mapLayerName = event.data.layer;
            let mapLayer = lighthouseMap.layers[mapLayerName];
            mapLayer.clear();

            if (event.data.layer === 'rfs') {
                showRuralFires(mapLayer, event.data.response);

            } else if (event.data.layer === 'transport-incidents') {
                showTransportIncidents(mapLayer, event.data.response);

            } else if (event.data.layer === 'transport-flood-reports') {
                showTransportFlooding(mapLayer, event.data.response);
            } else if (event.data.layer === 'transport-cameras') {
                showTransportCameras(mapLayer, event.data.response);
            } else if (event.data.layer === 'helicopters') {
                showRescueHelicopters(mapLayer, event.data.response)
            }

        } else if (event.data.type === "LH_CLEAR_LAYER_DATA") {
            console.info("clearing layer:" + event.data.layer);
            lighthouseMap.layers[event.data.layer].clear();
        } else if (event.data.type === "LH_GET_TRANSPORT_KEY") {
            var transportApiKeyOpsLog = ''
            switch (urls.Base)
            {
                case 'https://previewbeacon.ses.nsw.gov.au':
                transportApiKeyOpsLog = '46273'
                break
                case 'https://beacon.ses.nsw.gov.au':
                transportApiKeyOpsLog = '515514'
                break
                case 'https://trainbeacon.ses.nsw.gov.au':
                transportApiKeyOpsLog = '36753'
                break
                default:
                transportApiKeyOpsLog = '0'
            }

            let layer = event.data.layer;

            // Fetch the API key from an ops log and pass it back
            getOpsLog(transportApiKeyOpsLog, function(response) {
                let content = JSON.parse(response.responseText);
                let key = content.Text;
                window.postMessage({ type: 'LH_RESPONSE_TRANSPORT_KEY', key: key, layer: layer }, '*');
            });
        }
    }
});

/**
 * Gets an ops log from beacon.
 *
 * @param id the ID of the ops log.
 * @param cb the callback to send the response to.
 */
 function getOpsLog(id, cb) {
    var urls = window.urls;
    var user = window.user;

    $.ajax({
        type: 'GET'
        , url: urls.Base + '/Api/v1/OperationsLog/' + id
        , beforeSend: function (n) {
            n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
        }
        , cache: true
        , dataType: 'json'
        , complete: function (response, textStatus) {
            if (textStatus === 'success') {
                cb(response)
            } else {
                console.log("ajax text problem");
                cb(false)
            }

        }
        , error: function (ajaxContext) {
            console.log("ajax http problem");
            cb(false)
        }
    })
}

const developmentMode = lighthouseEnviroment === 'Development';
const lighthouseIcon = lighthouseUrl + 'icons/lh-black.png';

// A map of RFS categories to icons
const rfsIcons = {
    'Not Applicable': 'icons/rfs_not_applicable.png',
    'Advice': 'icons/rfs_advice.png',
    'Watch and Act': 'icons/rfs_watch_act.png',
    'Emergency Warning': 'icons/rfs_emergency.png',
    'unknown': 'icons/rfs_emergency.png'
};

/**
 * Adds a point from RMS data to the map layer.
 *
 * @param mapLayer the layer to add to.
 * @param point the point to add.
 * @param icon the icon.
 */
 function addTransportPoint(mapLayer, point, icon) {
    let lat = point.geometry.coordinates[1];
    let lon = point.geometry.coordinates[0];

    let name = point.properties.displayName;

    let created = moment(point.properties.created).format('YYYY-MM-DD HH:mm:ss');
    let createddiff = moment(point.properties.created).fromNow();

    let updated = moment(point.properties.lastUpdated).format('YYYY-MM-DD HH:mm:ss');
    let updateddiff = moment(point.properties.lastUpdated).fromNow();

    let dateDetails =
    `<div class="dateDetails">\
    <div><span class="dateDetailsLabel">Created: </span> ${created}</div>\
    <div><span class="dateDetailsLabel">Created: </span> ${createddiff}</div>\
    <div><span class="dateDetailsLabel">Updated: </span> ${updated}</div>\
    <div><span class="dateDetailsLabel">Updated: </span> ${updateddiff}</div>\
    </div>`;

    let details =
    `<div><strong>${point.properties.headline}</strong></div>\
    <div style="margin-top:0.5em">${point.properties.adviceA}</div>\
    <div>${point.properties.adviceB}</div>\
    <div>${point.properties.otherAdvice}</div>\
    ${dateDetails}`;

    console.debug(`RMS incident at [${lat},${lon}]: ${name}`);
    mapLayer.addImageMarker(lat, lon, icon, name, details);
}

/**
 * Shows cameras from RMS.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
 function showTransportCameras(mapLayer, data) {
    console.info('showing RMS cameras');

    let count = 0;
    if (data && data.features) {
        for (let i = 0; i < data.features.length; i++) {
            let feature = data.features[i];

            if (feature.geometry.type.toLowerCase() === 'point') {
                //default incase that fucks up.
                var icon = 'https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera-w.gif';


                switch (feature.properties.direction)
                {
                    case "N":
                    icon = 'https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera-n.gif';
                    break;
                    case "S":
                    icon = 'https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera-s.gif';
                    break;
                    case "E":
                    icon = 'https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera-e.gif';
                    break;
                    case "W":
                    icon = 'https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera-w.gif';
                    break;
                }

                let lat = feature.geometry.coordinates[1];
                let lon = feature.geometry.coordinates[0];

                let name = feature.properties.title;

                let details = feature.properties.view + "<br><br><div style='height:190px;width:240px;display:block'><a target='_blank' href='"+feature.properties.href+"'><img width='100%' src="+feature.properties.href+"></img></a></div><sub>Click image to enlarge</sub>";

                console.debug(`Camera at [${lat},${lon}]: ${name}`);
                mapLayer.addImageMarker(lat, lon, icon, name, details);


                count++;
            }
        }
    }
    console.info(`added ${count} RMS camera markers`);
}


/**
 * Shows flooding as reported by RMS.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
 function showTransportFlooding(mapLayer, data) {
    console.info('showing RMS reported flooding');

    let count = 0;
    if (data && data.features) {
        for (let i = 0; i < data.features.length; i++) {
            let feature = data.features[i];

            if (feature.geometry.type.toLowerCase() === 'point') {
                let icon = 'https://www.livetraffic.com/images/icons/hazard/weather-flood.gif';
                addTransportPoint(mapLayer, feature, icon);
                count++;
            }
        }
    }
    console.info(`added ${count} RMS flooding markers`);
}

/**
 * Shows RMS incidents.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
 function showTransportIncidents(mapLayer, data) {
    console.info('showing RMS incidents');

    let count = 0;
    if (data && data.features) {
        for (let i = 0; i < data.features.length; i++) {
            let feature = data.features[i];

            if (feature.geometry.type.toLowerCase() === 'point') {
                let icon = 'https://www.livetraffic.com/images/icons/hazard/traffic-incident.gif';
                addTransportPoint(mapLayer, feature, icon);
                count++;
            }
        }
    }
    console.info(`added ${count} RMS incidents`);
}

/**
 * Show rural fires on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
 function showRuralFires(mapLayer, data) {
    console.info('showing RFS incidents');

    let count = 0;
    if (data && data.features) {
        for (let i = 0; i < data.features.length; i++) {
            let fire = data.features[i];

            if (fire.geometry.type.toLowerCase() === 'point') {
                let lat = fire.geometry.coordinates[1];
                let lon = fire.geometry.coordinates[0];

                let name = fire.properties.title;
                let details = fire.properties.description;
                let category = fire.properties.category;

                let relativeIcon = rfsIcons[category] || rfsIcons['unknown'];
                let icon = lighthouseUrl + relativeIcon;

                console.debug(`RFS incident at [${lat},${lon}]: ${name}`);
                mapLayer.addImageMarker(lat, lon, icon, name, details);
                count++;
            }
        }
    }
    console.info(`added ${count} RFS incidents`);
}

/**
 * Builds the params string for the helicopter's update request.
 *
 * @returns the params.
 */
 function buildHeliParams() {
    // Build the query url
    let params = '';
    for (let i = 0; i < aircraft.length; i++) {
        params += i === 0 ? '?' : '&';
        params += 'icao24=' + aircraft[i].icao24.toLowerCase();
    }

    return params
}

/**
 * Shows the current position of known rescue helicopters on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
 function showRescueHelicopters(mapLayer, data) {
    console.info('showing rescue helicopters');

    let count = 0;
    if (data && data.states) {
        for (let i = 0; i < data.states.length; i++) {
            let icao24 = data.states[i][0];
            let positionUpdated = data.states[i][3];
            let lon = data.states[i][5];
            let lat = data.states[i][6];
            let alt = data.states[i][7];
            let heading = data.states[i][10] || 0;

            let updated = "unknown";
            let updatedMoment = "unknown";

            if (positionUpdated) {
                updated = moment(positionUpdated * 1000).format('DD/MM/YY HH:mm:ss');
                updatedMoment = moment(positionUpdated * 1000).fromNow()
            }

            let heli = findAircraftById(icao24);
            let name = heli.name + ' ' + heli.rego + ' - ' +heli.operator;

            let dateDetails =
            `<div class="dateDetails">\
            <div><span class="dateDetailsLabel">Last Position Update: </span> ${updated}</div>\

            <div><span class="dateDetailsLabel">Last Position Update: </span> ${updatedMoment}</div>\

            </div>`;

            let details =
            `<div>Model: ${heli.model}</div>\
            <div style="margin-top:0.5em"><strong>Lat:</strong> ${lat}<br><strong>Lon:</strong> ${lon}<br><strong>Alt:</strong> ${alt}</div>\

            ${dateDetails}`;     

            console.debug(`helo at [${lat},${lon}]: ${name}`);
            let marker = mapLayer.createImageMarker(heli.getIcon(), name, details);
            marker.setWidth(32);
            marker.setHeight(32);
            marker.setAngle(heading);
            mapLayer.addMarker(lat, lon, marker);
            count++;
        }
    }
    console.info(`added ${count} rescue helicopters`);
}

/**
 * Finds an aircraft by it's ICAO-24 ID.
 *
 * @param icao24 the ID.
 * @returns the aircraft, or {@code null} if no match is found.
 */
 function findAircraftById(icao24) {
    for (let i = 0; i < aircraft.length; i++) {
        if (aircraft[i].icao24.toLowerCase() === icao24.toLowerCase()) {
            return aircraft[i];
        }
    }

    console.warn('failed to find a helicopter for icao24: ' + icao24);
    return null;
}

/**
 * A class for rescue aircraft details
 */
 class Helicopter {
    /**
     * Constructs a new aircraft.
     *
     * @param icao24 the ICAO-24 hex code.
     * @param rego the registration tag, e.g. "VH-TJE".
     * @param name the flight name, e.g. "RSCU201".
     * @param model the model, e.g. "AW-139".
     * @param colour the colour for the marker.
     * @param heli {@code true} if this is a helicopter.
     */
     constructor(icao24, rego, name, model, operator, colour = '#ffffff', heli = true) {

        this.icao24 = icao24;
        this.rego = rego;
        this.name = name;
        this.model = model;
        this.operator = operator
        this.colour = colour;
        this.heli = heli;
    }

    /**
     * Gets an icon for this aircraft.
     *
     * @returns {string} the URL to the icon.
     */
     getIcon() {
        if (this.heli) {
            return lighthouseUrl + 'icons/helicopter.png';
        } else {
            return lighthouseUrl + 'icons/plane.png';
        }
    }
}

// A list of rescue helicopters
const aircraft = [
    // Toll Air Ambulance
    new Helicopter('7C6178', 'VH-TJE', 'RSCU201', 'AW-139', 'Toll Air'),
    new Helicopter('7C6179', 'VH-TJF', 'RSCU202', 'AW-139', 'Toll Air'),
    new Helicopter('7C617A', 'VH-TJG', 'RSCU203', 'AW-139', 'Toll Air'),
    new Helicopter('7C617B', 'VH-TJH', 'RSCU204', 'AW-139', 'Toll Air'),
    new Helicopter('7C617C', 'VH-TJI', 'RSCU206', 'AW-139', 'Toll Air'),
    new Helicopter('7C617D', 'VH-TJJ', 'RSCU207', 'AW-139', 'Toll Air'),
    new Helicopter('7C617E', 'VH-TJK', 'RSCU208', 'AW-139', 'Toll Air'),
    new Helicopter('7C6182', 'VH-TJO', 'RSCU209', 'AW-139', 'Toll Air'),

    // Careflight
    new Helicopter('7C0635', 'VH-BIF', 'CFH4', 'BK117', 'Careflight'),

    // Westpac
    new Helicopter('7C5CC0', 'VH-SLU', 'LIFE21', 'BK117', 'Westpac'),
    new Helicopter('7C81CC', 'VH-ZXA', 'WP1', 'AW-139', 'Westpac'),
    new Helicopter('7C81CD', 'VH-ZXB', 'WP2', 'AW-139', 'Westpac'),
    new Helicopter('7C81CE', 'VH-ZXC', 'WP3', 'AW-139', 'Westpac'),
    new Helicopter('7C81CF', 'VH-ZXD', 'WP4', 'AW-139', 'Westpac'),

    // PolAir
    new Helicopter('7C4D03', 'VH-PHX', 'POLAIR1', 'EC-AS355', 'PolAir'),
    new Helicopter('7C4CF8', 'VH-PHM', 'POLAIR4', 'EC-135', 'PolAir'),
    new Helicopter('7C4D05', 'VH-PHZ', 'POLAIR5', 'Bell 412EPI', 'PolAir'),

    // Royal Australian Navy / CHC
    new Helicopter('7C37B8', 'VH-LAI', 'CHOP22', 'Sikorsky S-76A', 'Royal Australian Navy'),
    new Helicopter('7C44C8', 'VH-NVE', 'CHOP26', 'AW-139', 'Royal Australian Navy'),

    // Some QLD based helicopters which may cross south
    // QLD Westpac
    new Helicopter('7C44CA', 'VH-NVG', 'LIFE45', 'EC-135', 'Westpac'),

    // QLD RAAF Rescue helicopter
    new Helicopter('7C37B7', 'VH-LAH', 'CHOP41', 'Sikorsky S-76A', 'RAAF'),

    // RACQ Lifeflight
    new Helicopter('7C759B', 'VH-XIL', 'RSCU511', 'AW139', 'RACQ Lifeflight'),
    new Helicopter('7C7599', 'VH-XIJ', 'RSCU533', 'AW139', 'RACQ Lifeflight'),
    new Helicopter('7C74C6', 'VH-XCO', 'RSCU588', 'Bell 412', 'RACQ Lifeflight'),

    // Some VIC base helicopters which may cross north
    // Victoria Helicopter Emergency Medical Service (HEMS)
    new Helicopter('7C7CC6', 'VH-YXK', 'HEMS1', 'AW-139', 'HEMS'),
    new Helicopter('7C7CC3', 'VH-YXH', 'HEMS2', 'AW-139', 'HEMS'),
    new Helicopter('7C7CC5', 'VH-YXJ', 'HEMS4', 'AW-139', 'HEMS'),
    new Helicopter('7C7CC1', 'VH-YXF', 'HEMS5', 'AW-139', 'HEMS'),

    // RFS fixed wing aircraft
    new Helicopter('A4C031', 'N405LC', 'Thor', 'C130', 'RFS'),
    new Helicopter('ACC37A', 'N512AX', '', 'DC-10', 'RFS'), // Bomber 910?

    // Whoa, there appear to be a lot of these...
    ];

// Some extra data points for dev-time
if (developmentMode) {
    aircraft.push(
        // ASNSW fixed wing
        new Helicopter('7C41DE', 'VH-NAO', 'AM262', 'Super King 350C', 'ASNSW', false),
        new Helicopter('7C41D9', 'VH-NAJ', 'AM292', 'Super King 350C', 'ASNSW', false), // Also seen as AM271
        new Helicopter('7C01C2', 'VH-AMS', 'AM203', 'Super King B200C', 'ASNSW', false),
        new Helicopter('7C01C1', 'VH-AMR', 'AM207', 'Super King B200C', 'ASNSW', false),
        new Helicopter('7C01C0', 'VH-AMQ', 'AM297', 'Super King B200C', 'ASNSW', false),

        // Royal Flying Doctor's Service
        new Helicopter('7C3FE2', 'VH-MWK', 'FD286', 'Super King B200C', 'RFDS', false)
        );
}

// Load all the arcgis classes
// These need to be called in 'eval' wrappers because the JS already in the
// page will have loaded these already, and require doesn't double load modules by-design
const GraphicsLayer = eval('require("esri/layers/GraphicsLayer");');
const SimpleMarkerSymbol = eval('require("esri/symbols/SimpleMarkerSymbol");');
const PictureMarkerSymbol = eval('require("esri/symbols/PictureMarkerSymbol");');
const Point = eval('require("esri/geometry/Point");');
const Graphic = eval('require("esri/graphic");');
const Color = eval('require("esri/Color");');

/**
 * A class for helping out with map access.
 */
 class LighthouseMap {

    /**
     * Constructs a new map.
     *
     * @param map the arcgis map.
     */
     constructor(map) {
        this.map = map;

        console.debug('Setting up map');

        this.createLayer('default');
    }

    /**
     * Creates a map layer.
     *
     * @param name the name of the layer.
     */
     createLayer(name) {
        let graphicsLayer = new GraphicsLayer();
        graphicsLayer.id = 'lighthouseLayer-' + name;
        graphicsLayer.on('click', this._handleClick);

        this.map.addLayer(graphicsLayer);
        this.layers[name] = new MapLayer(graphicsLayer);
    }

    /**
     * Gets the map layers.
     *
     * @returns the layers.
     */
     layers() {
        return this._layers;
    }

    /**
     * Handles a click event from the our map graphics layer.
     *
     * @param event the event.
     * @private
     */
     _handleClick(event) {
        // Show the info window for our point
        this._map.infoWindow.setTitle(event.graphic.symbol.title);
        this._map.infoWindow.setContent(event.graphic.symbol.details);
        this._map.infoWindow.show(event.mapPoint);
    }
}

/**
 * A class for helping out with map layer access.
 */
 class MapLayer {

    /**
     * Constructs a new map layer.
     *
     * @param layer the arcgis graphics layer.
     */
     constructor(layer) {
        this.graphicsLayer = layer;
    }

    /**
     * Adds a symbol marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param style the marker style, e.g. SimpleMarkerSymbol.STYLE_SQUARE.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     addSymbolMarker(lat, lon, style, title='', details='') {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        let marker = new SimpleMarkerSymbol(style);
        marker.title = title;
        marker.details = details;

        this.graphicsLayer.add(new Graphic(point, marker));
        return marker;
    }

    /**
     * Creates an image marker.
     *
     * @param imageUrl the URL for the marker's image.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     createImageMarker(imageUrl, title='', details='') {
        let marker = new PictureMarkerSymbol();
        marker.setHeight(16);
        marker.setWidth(16);
        marker.setUrl(imageUrl);
        marker.title = title;
        marker.details = details;

        return marker;
    }

    /**
     * Adds an image marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param imageUrl the URL for the marker's image.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     addImageMarker(lat, lon, imageUrl, title='', details='') {
        let marker = this.createImageMarker(imageUrl, title, details);
        this.addMarker(lat, lon, marker);
        return marker;
    }

    /**
     * Adds an marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param marker the marker to add.
     */
     addMarker(lat, lon, marker) {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        this.graphicsLayer.add(new Graphic(point, marker));
    }

    /**
     * Removes a marker from the map.
     *
     * @param marker the marker to remove.
     */
     removeMarker(marker) {
        this.graphicsLayer.remove(marker);
    }

    /**
     * Clears all markers from the map.
     */
     clear() {
        this.graphicsLayer.clear();
    }
}

// Load all the arcgis classes
// These need to be called in 'eval' wrappers because the JS already in the
// page will have loaded these already, and require doesn't double load modules by-design
const GraphicsLayer = eval('require("esri/layers/GraphicsLayer");');
const SimpleMarkerSymbol = eval('require("esri/symbols/SimpleMarkerSymbol");');
const PictureMarkerSymbol = eval('require("esri/symbols/PictureMarkerSymbol");');
const Point = eval('require("esri/geometry/Point");');
const Graphic = eval('require("esri/graphic");');
const Color = eval('require("esri/Color");');

/**
 * A class for helping out with map access.
 */
 class LighthouseMap {

    /**
     * Constructs a new map.
     *
     * @param map the arcgis map.
     */
     constructor(map) {
        this.map = map;

        console.debug('Setting up map');

        this.createLayer('default');
    }

    /**
     * Creates a map layer.
     *
     * @param name the name of the layer.
     */
     createLayer(name) {
        let graphicsLayer = new GraphicsLayer();
        graphicsLayer.id = 'lighthouseLayer-' + name;
        graphicsLayer.on('click', this._handleClick);

        this.map.addLayer(graphicsLayer);
        this.layers[name] = new MapLayer(graphicsLayer);
    }

    /**
     * Gets the map layers.
     *
     * @returns the layers.
     */
     layers() {
        return this._layers;
    }

    /**
     * Handles a click event from the our map graphics layer.
     *
     * @param event the event.
     * @private
     */
     _handleClick(event) {
        // Show the info window for our point
        this._map.infoWindow.setTitle(event.graphic.symbol.title);
        $(this._map.infoWindow.domNode).find('.actionList').addClass('hidden') //massive hack to remove the Zoom To actionlist dom.
        this._map.infoWindow.setContent(event.graphic.symbol.details);
        this._map.infoWindow.show(event.mapPoint);
    }
}

/**
 * A class for helping out with map layer access.
 */
 class MapLayer {

    /**
     * Constructs a new map layer.
     *
     * @param layer the arcgis graphics layer.
     */
     constructor(layer) {
        this.graphicsLayer = layer;
    }

    /**
     * Adds a symbol marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param style the marker style, e.g. SimpleMarkerSymbol.STYLE_SQUARE.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     addSymbolMarker(lat, lon, style, title='', details='') {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        let marker = new SimpleMarkerSymbol(style);
        marker.title = title;
        marker.details = details;

        this.graphicsLayer.add(new Graphic(point, marker));
        return marker;
    }

    /**
     * Creates an image marker.
     *
     * @param imageUrl the URL for the marker's image.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     createImageMarker(imageUrl, title='', details='') {
        let marker = new PictureMarkerSymbol();
        marker.setHeight(16);
        marker.setWidth(16);
        marker.setUrl(imageUrl);
        marker.title = title;
        marker.details = details;

        return marker;
    }

    /**
     * Adds an image marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param imageUrl the URL for the marker's image.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
     addImageMarker(lat, lon, imageUrl, title='', details='') {
        let marker = this.createImageMarker(imageUrl, title, details);
        this.addMarker(lat, lon, marker);
        return marker;
    }

    /**
     * Adds an marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param marker the marker to add.
     */
     addMarker(lat, lon, marker) {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        this.graphicsLayer.add(new Graphic(point, marker));
    }

    /**
     * Removes a marker from the map.
     *
     * @param marker the marker to remove.
     */
     removeMarker(marker) {
        this.graphicsLayer.remove(marker);
    }

    /**
     * Clears all markers from the map.
     */
     clear() {
        this.graphicsLayer.clear();
    }
}


// Instance the tour
require('bootstrap-tour')

var tour = new Tour({
  name: "LHTourSituationalAwareness",
  smartPlacement: true,
  placement: "right",
  steps: [
  {
    element: "",
    placement: "top",
    orphan: true,
    backdrop: true,
    title: "Lighthouse Welcome",
    onNext: function (tour) {
      $('#lhquickfilter > ul').show();
  },
  content: "Lighthouse has made some changes to this page. would you like a tour?"
},
{
    element: "#lhquickfilter",
    title: "Lighthouse Quickfilters",
    placement: "right",
    backdrop: false,
    onNext: function (tour) {
      $('#lhquickfilter > ul').hide();
      $('#lhlayers > ul').show();
  },
  content: "Lighthouse adds a new filter menu that groups together common filters.eg 'Rescue Jobs' covers RCR, Flood, and VR.",
},
{
    element: "#lhlayers",
    title: "Lighthouse Layers",
    placement: "right",
    backdrop: false,
    onNext: function (tour) {
      $('#lhlayers > ul').hide();
  },
  content: "Lighthouse adds a number of new map layers. These layers will add icons to the map which can be clicked for further information.",
},
{
    element: "",
    placement: "top",
    orphan: true,
    backdrop: true,
    title: "Questions?",
    content: "Thats about it. If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
},
]
})

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
