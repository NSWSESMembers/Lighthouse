window.addEventListener("load", pageFullyLoaded, false);

function pageFullyLoaded(e) {
    //hide the maximize button
    var max = document.getElementsByClassName("titleButton maximize");
    max[0].classList.add("hidden");
}

$ = require('jquery');

$(document).ready(function() {
    let map = window["map"];
    let lighthouseMap = new LighthouseMap(map);
    //lighthouseMap.addImageMarker(-33.896628, 151.165709, "http://m.livetraffic.rta.nsw.gov.au/Assets/img/icon_warning.png");
    window["lighthouseMap"] = lighthouseMap;
});

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
        this.graphicsLayer.id = 'customLayer';
        this.graphicsLayer.infoTempalate = this.template;

        this.map.addLayer(this.graphicsLayer);
    }

    /**
     * Adds an image marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param imageUrl the URL for the marker's image.
     */
    addImageMarker(lat, lon, imageUrl) {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        let marker = new PictureMarkerSymbol();
        marker.setHeight(16);
        marker.setWidth(16);
        marker.setUrl(imageUrl);

        this.graphicsLayer.add(new Graphic(point, marker));
    }
}