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
    lighthouseMap.createLayer('helicopters');

    if (developmentMode) {
        // Add a test point
        lighthouseMap.layers['default'].addImageMarker(-33.798796, 150.997393, lighthouseIcon,  'Parramatta SES',
            'This is a test marker. It is used to check whether the map access is working');
    }
    window['lighthouseMap'] = lighthouseMap;
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

            } else if (event.data.layer === 'helicopters') {
                showRescueHelicopters(mapLayer, event.data.response)
            }

        } else if (event.data.type === "LH_CLEAR_LAYER_DATA") {
            console.info("clearing layer:" + event.data.layer);
            lighthouseMap.layers[event.data.layer].clear();
        }
    }
});

const developmentMode = lighthouseEnviroment === 'Development';
const lighthouseIcon = lighthouseUrl + 'icons/lh-black.png';
const helicopterIcon = lighthouseUrl + 'icons/helicopter.png';

// A map of RFS categories to icons
const rfsIcons = {
    'Not Applicable': 'icons/rfs_not_applicable.png',
    'Advice': 'icons/rfs_advice.png',

    // TODO: what are these two values meant to be??
    'watch': 'icons/rfs_watch_act.png',
    'emergency': 'icons/rfs_emergency.png'
};

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
                let lat = feature.geometry.coordinates[1];
                let lon = feature.geometry.coordinates[0];

                let name = feature.properties.displayName;
                let details = feature.properties.otherAdvice;
                let icon = 'https://www.livetraffic.com/images/icons/hazard/weather-flood.gif';

                console.debug(`RMS reported flood at [${lat},${lon}]: ${name}`);
                mapLayer.addImageMarker(lat, lon, icon, name, details);
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
                let lat = feature.geometry.coordinates[1];
                let lon = feature.geometry.coordinates[0];

                let name = feature.properties.displayName;
                let details = feature.properties.otherAdvice;
                let icon = 'https://www.livetraffic.com/images/icons/hazard/traffic-incident.gif';

                console.debug(`RMS incident at [${lat},${lon}]: ${name}`);
                mapLayer.addImageMarker(lat, lon, icon, name, details);
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

                let relativeIcon = rfsIcons[category] || rfsIcons['emergency'];
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
    for (let i = 0; i < helicopters.length; i++) {
        params += i === 0 ? '?' : '&';
        params += 'icao24=' + helicopters[i].icao24.toLowerCase();
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
            let lon = data.states[i][5];
            let lat = data.states[i][6];
            let alt = data.states[i][7];

            let heli = findHelicopterById(icao24);
            let name = heli.name + ' ' + heli.rego;
            let details = heli.model + '<br/>Lat: ' + lat + ' Lon:' + lon + ' Alt:' + alt;

            console.debug(`helo at [${lat},${lon}]: ${name}`);
            mapLayer.addImageMarker(lat, lon, helicopterIcon, name, details);
            count++;
        }
    }
    console.info(`added ${count} rescue helicopters`);
}

/**
 * Finds a helicopter by it's ICAO-24 ID.
 *
 * @param icao24 the ID.
 * @returns the helicopter, or {@code null} if no match is found.
 */
function findHelicopterById(icao24) {
    for (let i = 0; i < helicopters.length; i++) {
        if (helicopters[i].icao24.toLowerCase() === icao24.toLowerCase()) {
            return helicopters[i];
        }
    }

    console.warn('failed to find a helicopter for icao24: ' + icao24);
    return null;
}

/**
 * A class for rescue helicopter details
 */
class Helicopter {
    /**
     * Constructs a new helicopter.
     *
     * @param icao24 the ICAO-24 hex code.
     * @param rego the registration tag, e.g. "VH-TJE".
     * @param name the flight name, e.g. "RSCU201".
     * @param model the model, e.g. "AW-139".
     */
    constructor(icao24, rego, name, model) {
        this.icao24 = icao24;
        this.rego = rego;
        this.name = name;
        this.model = model;
    }
}

// A list of rescue helicopters
const helicopters = [
    // Toll Air Ambulance
    new Helicopter('7C6178', 'VH-TJE', 'RSCU201', 'AW-139'),
    new Helicopter('7C6179', 'VH-TJF', 'RSCU202', 'AW-139'),
    new Helicopter('7C617A', 'VH-TJG', 'RSCU203', 'AW-139'),
    new Helicopter('7C617B', 'VH-TJH', 'RSCU204', 'AW-139'),
    new Helicopter('7C617C', 'VH-TJI', 'RSCU206', 'AW-139'),
    //new Helicopter('7C617D', 'VH-TJJ', '??', 'AW-139'),
    new Helicopter('7C617E', 'VH-TJK', 'RSCU208', 'AW-139'),
    new Helicopter('7C6182', 'VH-TJO', 'RSCU209', 'AW-139'),

    // Careflight
    new Helicopter('7C0635', 'VH-BIF', 'CFH4', 'BK117'),

    // Westpac
    new Helicopter('7C81CC', 'VH-ZXA', 'WP1', 'AW-139'),
    new Helicopter('7C81CD', 'VH-ZXB', 'WP2', 'AW-139'),
    new Helicopter('7C81CE', 'VH-ZXC', 'WP3', 'AW-139'),
    new Helicopter('7C81CF', 'VH-ZXD', 'WP4', 'AW-139'),

    // PolAir
    new Helicopter('7C4D03', 'VH-PHX', 'POLAIR1', 'EC-AS355'),
    new Helicopter('7C4CF8', 'VH-PHM', 'POLAIR4', 'EC-135'),
    new Helicopter('7C4D05', 'VH-PHZ', 'POLAIR5', 'Bell 412EPI'),

    // Royal Australian Navy / CHC
    new Helicopter('7C44C8', 'VH-NVE', 'CHOP26', 'AW-139'),

    // Some QLD based helicopters which may cross south
    // QLD RAAF Rescue helicopter
    new Helicopter('7C37B7', 'VH-LAH', 'CHOP41', 'Sikorsky S-76A'),

    // RACQ Lifeflight
    new Helicopter('7C759B', 'VH-XIL', 'RSCU511', 'AW139'),
    new Helicopter('7C74C6', 'VH-XCO', 'RSCU588', 'Bell 412'),

    // Some VIC base helicopters which may cross north
    // Victoria Helicopter Emergency Medical Service (HEMS)
    new Helicopter('7C7CC3', 'VH-YXH', 'HEMS2', 'AW-139'),
    new Helicopter('7C7CC5', 'VH-YXJ', 'HEMS4', 'AW-139'),
    new Helicopter('7C7CC1', 'VH-YXF', 'HEMS5', 'AW-139')
];

// Some extra data points for dev-time
if (developmentMode) {
    helicopters.push(
        // ASNSW fixed wing
        new Helicopter('7C41DE', 'VH-NAO', 'AM262', 'Super King 350C'),
        new Helicopter('7C41D9', 'VH-NAJ', 'AM292', 'Super King 350C'), // Also seen as AM271
        new Helicopter('7C01C1', 'VH-AMR', 'AM207', 'Super King B200C'),

        // Royal Flying Doctor's Service
        new Helicopter('7C3FE2', 'VH-MWK', 'FD286', 'Super King B200C')
    );
}

// Load all the arcgis classes
const GraphicsLayer = eval('require("esri/layers/GraphicsLayer");');
const SimpleMarkerSymbol = eval('require("esri/symbols/SimpleMarkerSymbol");');
const PictureMarkerSymbol = eval('require("esri/symbols/PictureMarkerSymbol");');
const Point = eval('require("esri/geometry/Point");');
const Graphic = eval('require("esri/graphic");');
const InfoTemplate = eval('require("esri/InfoTemplate");');

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
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        let marker = new PictureMarkerSymbol();
        marker.setHeight(16);
        marker.setWidth(16);
        marker.setUrl(imageUrl);
        marker.title = title;
        marker.details = details;

        this.graphicsLayer.add(new Graphic(point, marker));
        return marker;
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