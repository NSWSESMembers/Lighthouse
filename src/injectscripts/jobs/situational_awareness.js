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