window.addEventListener("load", pageFullyLoaded, false);

function pageFullyLoaded(e) {
    //hide the maximize button
    var max = document.getElementsByClassName("titleButton maximize");
    max[0].classList.add("hidden");

    let map = window["map"];
    let lighthouseMap = new LighthouseMap(map);
    //showRtaIncidents(lighthouseMap);
    //showRuralFires(lighthouseMap);
    window["lighthouseMap"] = lighthouseMap;
}

function showRescueHelicopters(lighthouseMap) {
    //https://opensky-network.org/api/states/all
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
    new Helicopter('7C4D05', 'VH-PHZ', 'POLAIR5', '412EPI'),
];

// Load all the arcgis classes
const GraphicsLayer = eval("require(\"esri/layers/GraphicsLayer\");");
const SimpleMarkerSymbol = eval("require(\"esri/symbols/SimpleMarkerSymbol\");");
const PictureMarkerSymbol = eval("require(\"esri/symbols/PictureMarkerSymbol\");");
const Point = eval("require(\"esri/geometry/Point\");");
const Graphic = eval("require(\"esri/graphic\");");
const InfoTemplate = eval("require(\"esri/InfoTemplate\");");

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

        this.graphicsLayer = new GraphicsLayer();
        this.graphicsLayer.id = 'lighthouseLayer';
        this.graphicsLayer.on("click", this._handleClick);

        this.map.addLayer(this.graphicsLayer);
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
        marker.details = title;

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
        marker.details = title;

        this.graphicsLayer.add(new Graphic(point, marker));
        return marker;
    }
}