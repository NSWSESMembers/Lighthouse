
// Load all the arcgis classes
// These need to be called in 'eval' wrappers because the JS already in the
// page will have loaded these already, and require doesn't double load modules by-design
const SimpleMarkerSymbol = eval('require("esri/symbols/SimpleMarkerSymbol");');
const SimpleFillSymbol = eval('require("esri/symbols/SimpleFillSymbol");');
const SimpleLineSymbol = eval('require("esri/symbols/SimpleLineSymbol");');
const PictureMarkerSymbol = eval('require("esri/symbols/PictureMarkerSymbol");');
const Font = eval('require("esri/symbols/Font");');
const TextSymbol = eval('require("esri/symbols/TextSymbol");');
const SpatialReference = eval('require("esri/SpatialReference");');
const Polyline = eval('require("esri/geometry/Polyline");');
const Point = eval('require("esri/geometry/Point");');
const Graphic = eval('require("esri/graphic");');
const Color = eval('require("esri/Color");');

/**
 * A class for helping out with map layer access.
 */
export default class MapLayer {

    /**
     * Constructs a new map layer.
     *
     * @param layer the arcgis graphics layer.
     */
    constructor(layer) {
        this._graphicsLayer = layer;
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
        let graphic = new Graphic(point, marker);
        graphic.setAttributes({title:title,details:details});


        this._graphicsLayer.add(graphic);
        return marker;
    }

    /**
     * Creates an image marker.
     *
     * @param imageUrl the URL for the marker's image.
     * @return the marker to customise.
     */
    static createImageMarker(imageUrl, scale = 16, xOffset = 0, yOffset = 0) {
        let marker = new PictureMarkerSymbol();
        //live traffic svg's are small
        if (imageUrl.split('.')[imageUrl.split('.').length-1] == 'svg') {
          marker.setHeight(32);
          marker.setWidth(32);
        } else {
          marker.setHeight(scale);
          marker.setWidth(scale);
        }
        marker.setOffset(xOffset, yOffset)
        marker.setUrl(imageUrl);
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
        let marker = MapLayer.createImageMarker(imageUrl);
        this.addMarker(lat, lon, marker, title, details);
        return marker;
    }

    /**
     * Adds an image marker to the map by x/y and spatial ref.
     *
     * @param x the x.
     * @param y the y.
     * @param SpatialReference the SpatialReference object.
     * @param imageUrl the URL for the marker's image.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @return the marker to customise.
     */
    addImageMarkerByxy(x, y, SpatialReference, imageUrl, title='', details='') {
        let marker = MapLayer.createImageMarker(imageUrl);
        this.addMarkerByxy(x, y, SpatialReference, marker, title, details);
        return marker;
    }

    /**
     * Adds an marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @param marker the marker to add.
     */
    addMarker(lat, lon, marker, title='', details='') {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });
        let graphic = new Graphic(point, marker);
        graphic.setAttributes({title:title,details:details});

        this._graphicsLayer.add(graphic);
    }

    /**
     * Adds an marker to the map by xy and spatial ref.
     *
     * @param x the x.
     * @param y the y.
     * @param title the title for this marker.
     * @param details the details for this marker's info pop-up.
     * @param SpatialReferencePassed the SpatialReferencePassed object
     * @param marker the marker to add.
     */
    addMarkerByxy(x, y, SpatialReferencePassed, marker, title='', details='') {
        let point = new Point(x,y,new SpatialReference(SpatialReferencePassed));
        let graphic = new Graphic(point, marker);
        graphic.setAttributes({title:title,details:details});
        this._graphicsLayer.add(graphic);
    }

    /**
     * Removes a marker from the map.
     *
     * @param marker the marker to remove.
     */
    removeMarker(marker) {
        this._graphicsLayer.remove(marker);
    }

    /**
     * Adds a polygon.
     *
     * @param points the array of arrays of [lon/lat] points.
     * @param outlineColour the outline colour.
     * @param fillColour the fill colour.
     * @param thickness the line thickness.
     * @param style the line style.
     */
    addPolygon(points, outlineColour, fillColour, thickness = 1, style=SimpleLineSymbol.STYLE_SOLID, title='', details='') {
        let polySymbol = new SimpleFillSymbol();
        polySymbol.setOutline(new SimpleLineSymbol(style, new Color(outlineColour), thickness));
        polySymbol.setColor(new Color(fillColour));


        // expect GPS lat/long data
        let lineGeometry = new Polyline(new SpatialReference({wkid:4326}));
        lineGeometry.addPath(points);

        let lineGraphic = new Graphic(lineGeometry, polySymbol);
        lineGraphic.setAttributes({title:title,details:details})


        this._graphicsLayer.add(lineGraphic);
    }

    /**
     * Adds a symbol marker to the map.
     *
     * @param lat the latitude.
     * @param lon the longitude.
     * @param text the text for the symbol.
     * @param offsetX the offset (in pixels) to place the text relative to the point.
     * @param offsetY the offset (in pixels) to place the text relative to the point.
     * @return the text symbol to customise.
     */
    addTextSymbol(lat, lon, text, offsetX = 0, offsetY = 0, color = 'black', size = 12) {
        let point = new Point({
            latitude: lat,
            longitude: lon
        });

        let textSymbol = new TextSymbol({text: text, color: new Color(color)})
            .setOffset(offsetX, offsetY)
            .setHorizontalAlignment('center')
            .setFont(new Font().setFamily('monospace').setSize(size));

        let graphic = new Graphic(point, textSymbol);

        this._graphicsLayer.add(graphic);
        return textSymbol;
    }

    /**
     * Clears all markers from the map.
     */
    clear() {
        this._graphicsLayer.clear();
    }
};
