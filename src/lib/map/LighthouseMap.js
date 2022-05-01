
// Load all the arcgis classes
// These need to be called in 'eval' wrappers because the JS already in the
// page will have loaded these already, and require doesn't double load modules by-design

const GraphicsLayer = eval('require("esri/layers/GraphicsLayer");');

const MapLayer = require('./MapLayer.js').default;
/**
 * A class for helping out with map access.
 */
export default class LighthouseMap {

    /**
     * Constructs a new map.
     *
     * @param map the arcgis map.
     */
    constructor(map) {
        this._map = map;
        this._clickHandlers = [];
        this._layers = {};

        console.debug('Setting up map');

        this.createLayer('default');
    }

    /**
     * Creates a map layer.
     *
     * @param name the name of the layer.
     * @param optionalIndex the optional index to insert the layer at. If undefined the layer is added to the top of
     *   the map.
     */
    createLayer(name, optionalIndex) {
        let graphicsLayer = new GraphicsLayer();
        graphicsLayer.id = 'lighthouseLayer-' + name;
        graphicsLayer.on('click', this._handleClick.bind(this));

        this._map.addLayer(graphicsLayer, optionalIndex);
        this._layers[name] = new MapLayer(graphicsLayer);
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
     * Adds a click handler to the map.
     *
     * @param handler the click handler function.
     */
    addClickHandler(handler) {
        this._clickHandlers.push(handler);
    }

    /**
     * Handles a click event from the our map graphics layer.
     *
     * @param event the event.
     * @private
     */
    _handleClick(event) {
        if (!event.graphic.attributes) {
            return;
        }

        // Show the info window for our point
        this._map.infoWindow.setTitle(event.graphic.attributes.title);
        this._map.infoWindow.setContent(event.graphic.attributes.details);

        // Call all the click handlers
        this._clickHandlers.forEach(f => f(event));

        $(this._map.infoWindow.domNode).find('.actionList').addClass('hidden'); //massive hack to remove the Zoom To actionlist dom.
        this._map.infoWindow.show(event.mapPoint); //show the popup, callsbacks will fill data as it comes in
    }
};
