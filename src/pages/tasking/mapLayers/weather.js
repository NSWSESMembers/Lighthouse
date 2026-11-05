import L from "leaflet";
import { viewImageRequest } from "../utils/wmsViewImage.js";
import { utcHourIso } from "../utils/bomTime.js";

// The BOM WMS layers below leave `crs` unset so Leaflet requests tiles in the
// map's own Web Mercator (EPSG:3857), which BOM's MapServer supports. Asking
// for EPSG:4326 drew lat/lon-spaced images into Mercator tiles, stretching
// each tile vertically (worst zoomed out) so radar and storm cells tore at
// tile joins and shifted between zoom levels.

/**
 * A WMS layer drawn as one image of the view (plus padding), fetched again
 * after each pan or zoom and swapped in once loaded. For BOM layers that
 * BOM re-renders every few minutes with no WMS time dimension to pin
 * (radar, thunderstorm tracking, satellite, lightning): tiles loaded at
 * different moments mixed frames, so they tore at tile joins and changed
 * between zoom levels.
 */
const WmsViewImageLayer = L.LayerGroup.extend({
  initialize(url, params, options) {
    L.LayerGroup.prototype.initialize.call(this, [], options);
    this._url = url;
    this._params = params;
    this._seq = 0;
    this._shown = null;
    // Load-status tracking (Map.js watchLayerChild). This is one image per
    // view rather than a GridLayer, so it fires the same loading/tileload/
    // tileerror/load cycle itself and flags its class with _viewImage.
    this._viewImage = true;
    this._loading = false;
  },

  onAdd(map) {
    L.LayerGroup.prototype.onAdd.call(this, map);
    map.on("moveend", this._update, this);
    this._update();
  },

  onRemove(map) {
    map.off("moveend", this._update, this);
    this._seq++;
    this._loading = false;
    L.LayerGroup.prototype.onRemove.call(this, map);
    this.clearLayers();
    this._shown = null;
  },

  _update() {
    const map = this._map;
    if (!map) return;
    const crs = map.options.crs;
    const zoom = map.getZoom();
    const px = map.getPixelBounds();
    const sw = crs.project(map.unproject(L.point(px.min.x, px.max.y), zoom));
    const ne = crs.project(map.unproject(L.point(px.max.x, px.min.y), zoom));
    const { bbox, width, height } = viewImageRequest({ min: sw, max: ne }, map.getSize());

    const url = this._url + L.Util.getParamString({
      ...this._params,
      service: "WMS",
      request: "GetMap",
      version: "1.3.0",
      crs: crs.code,
      width,
      height,
      bbox: bbox.join(","),
    }, this._url);
    const bounds = L.latLngBounds(
      crs.unproject(L.point(bbox[0], bbox[1])),
      crs.unproject(L.point(bbox[2], bbox[3])),
    );

    const seq = ++this._seq;
    this._loading = true;
    this.fire("loading");
    const img = L.imageOverlay(url, bounds, {
      pane: "tilePane",
      opacity: this.options.opacity ?? 1,
      interactive: false,
      attribution: this.options.attribution,
    });
    // Settle the load cycle, but only for the current view -- an image that
    // finishes after a newer view was requested is stale and ignored.
    const settle = (ok) => {
      if (seq !== this._seq) return;
      this._loading = false;
      this.fire(ok ? "tileload" : "tileerror");
      this.fire("load");
    };
    // Keep the last image up until the new one has loaded; drop images
    // that finish after a newer view was requested.
    img.once("load", () => {
      if (seq !== this._seq) return this.removeLayer(img);
      if (this._shown) this.removeLayer(this._shown);
      this._shown = img;
      settle(true);
    });
    img.once("error", () => {
      this.removeLayer(img);
      settle(false);
    });
    this.addLayer(img);
  },
});

/**
 * Register BOM All WMS layer using provided URL
 */
export function registerBOMAllFloodLevelsLayer(vm, sourceUrl) {
  const allUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomAll", {
    label: "BOM Flood Levels",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomAllFlood`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(allUrl, {
        layers: "IDN62011_all",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        attribution: "Bureau of Meteorology",
        _cb: data?.cacheBuster,
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}

/**
 * Register BOM Rainfall WMS layer from Beacon
 */
export function registerBOMRainfallLayer(vm, sourceUrl) {
  const rainfallUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomRainfall", {
    label: "BOM Rainfall (9am)",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomRainfall`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(rainfallUrl, {
        layers: "IDZ20010_rainfall_9am",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        attribution: "Bureau of Meteorology",
        _cb: data?.cacheBuster,
        // Default NSW bounding box, but map will handle view
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Radar WMS layer from Beacon
 */
export function registerBOMRadarLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomRadar", {
    label: "BOM Rain Radar Still",
    menuGroup: "BOM Radar & Satellite",
    stack: "tiles",
    defaultOpacity: 50,
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomRadar`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = new WmsViewImageLayer(radarUrl, {
        layers: "IDR00010",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        _cb: data?.cacheBuster,
      }, { attribution: "Bureau of Meteorology" });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Zehr Himawari WMS layer from Beacon
 */
export function registerBOMSatTrueColorLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSatTrueColor", {
    label: "BOM Satellite Composite True Colour",
    menuGroup: "BOM Radar & Satellite",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomSatTrueColor`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = new WmsViewImageLayer(radarUrl, {
        layers: "IDE00435",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        _cb: data?.cacheBuster,
      }, { attribution: "Japan Meteorological Agency via Bureau of Meteorology" });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Thunderstorm Tracking from Beacon
 */
export function registerBOMThunderstormTrackingLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomThunderstormTracking", {
    label: "BOM Thunderstorm Tracking",
    menuGroup: "BOM Radar & Satellite",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomThunderstormTracking`) || false,
    fetchFn: async () => {
      return { cacheBuster: Date.now() };
    },
    drawFn: (layerGroup, data) => {
      const wmsLayer = new WmsViewImageLayer(radarUrl, {
        layers: "IDR00011,IDR00011_track",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        _cb: data?.cacheBuster,
      }, { attribution: "Bureau of Meteorology", opacity: 0.7 });
      layerGroup.addLayer(wmsLayer);
    },
  });
}

/**
 * Register BOM Wind Layer from Beacon
 */
export function registerBOMWindLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomWind", {
    label: "BOM Wind Barbs & Raster",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomWind`) || false,
    // One forecast hour for every tile (see utils/bomTime.js); moves on at
    // the first refresh after the hour.
    fetchFn: async () => ({ cacheBuster: Date.now(), time: utcHourIso() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_windpt","IDY25026_windrast"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        opacity: 0.5, // Adjust opacity for more transparency
        version: "1.3.0",
        attribution: "Bureau of Meteorology",
        time: data?.time,
        _cb: data?.cacheBuster,
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}

/**
 * Register BOM MSLP from Beacon
 */
export function registerBOMMSLPLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomMSLP", {
    label: "BOM MSLP Contours",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomMSLP`) || false,
    // One forecast hour for every tile (see utils/bomTime.js); moves on at
    // the first refresh after the hour.
    fetchFn: async () => ({ cacheBuster: Date.now(), time: utcHourIso() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_mslp"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        attribution: "Bureau of Meteorology",
        time: data?.time,
        _cb: data?.cacheBuster,
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Lightning from Beacon
 */
export function registerBOMLightningLayer(vm, sourceUrl) {
  const radarUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomLightning", {
    label: "BOM Lightning Strikes (0-2 hrs ago) Cloud to Ground",
    menuGroup: "BOM Radar & Satellite",
    stack: "tiles",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomLightning`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = new WmsViewImageLayer(radarUrl, {
        layers: "IDZ20019_c2g_2h",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        _cb: data?.cacheBuster,
      }, { attribution: "Bureau of Meteorology" });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Lightning (2-24h) from Beacon
 */
export function registerBOMLightning24hLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomLightning24h", {
    label: "BOM Lightning (2-24 hrs ago) Cloud to Ground",
    menuGroup: "BOM Radar & Satellite",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomLightning24h`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        new WmsViewImageLayer(wmsUrl, {
          layers: "IDZ20019_c2g_2-24h",
          styles: "default",
          format: "image/png",
          transparent: true,
          _cb: data?.cacheBuster,
        }, { attribution: "Bureau of Meteorology" })
      );
    },
  });
}


/**
 * Register BOM Tsunami Warning from Beacon
 */
export function registerBOMTsunamiLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomTsunami", {
    label: "BOM Tsunami Warning",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 300000, // 5 min – critical warning
    visibleByDefault: localStorage.getItem(`ov.bomTsunami`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: ["IDZ20002", "IDZ20002_info"],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Tropical Cyclone Tracking from Beacon
 */
export function registerBOMTropicalCycloneLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomTropicalCyclone", {
    label: "BOM Tropical Cyclone Tracking",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomTropicalCyclone`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: [
            "IDZ20009_trackarea",
            "IDZ20009_threatarea",
            "IDZ20009_windarea",
            "IDZ20009_track",
            "IDZ20009_fix",
            "IDZ20009_name",
          ],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Fire Danger Rating (today) from Beacon
 */
export function registerBOMFireDangerRatingLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomFireDangerRating", {
    label: "BOM Fire Danger Rating (Today)",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomFireDangerRating`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20022000",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          opacity: 0.6,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Heatwave Forecast (today +2 days) from Beacon
 */
export function registerBOMHeatwaveLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomHeatwave", {
    label: "BOM Heatwave Forecast (Days +0 to +2)",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomHeatwave`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDY10012_day0",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          opacity: 0.6,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Hazardous Surf Warning (today) from Beacon
 */
export function registerBOMHazardousSurfLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomHazardousSurf", {
    label: "BOM Hazardous Surf Warning (Today)",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomHazardousSurf`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20017000",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Coastal Hazard Warning from Beacon
 */
export function registerBOMCoastalHazardLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomCoastalHazard", {
    label: "BOM Coastal Hazard Warning",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomCoastalHazard`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20023",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Road Weather Alert from Beacon
 */
export function registerBOMRoadWeatherLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomRoadWeather", {
    label: "BOM Road Weather Alert (Metro)",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomRoadWeather`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20014",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Surface Obs – Wind Gust (km/h) from Beacon
 */
export function registerBOMSurfaceGustLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSurfaceGust", {
    label: "BOM Surface Obs Wind Gust (km/h)",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomSurfaceGust`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20010_gustkmh",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Surface Obs – Air Temperature (°C) from Beacon
 */
export function registerBOMSurfaceTempLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSurfaceTemp", {
    label: "BOM Surface Obs Air Temp (°C)",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomSurfaceTemp`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20010_air_temperature",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Fire Behaviour Index (AFDRS) from Beacon
 */
export function registerBOMFireBehaviourIndexLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomFireBehaviourIndex", {
    label: "BOM Fire Behaviour Index (AFDRS)",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomFireBehaviourIndex`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ10135",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          opacity: 0.6,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Hazardous Wind Onset (next 6h) from Beacon
 */
export function registerBOMHazardousWindLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomHazardousWind", {
    label: "BOM Hazardous Wind Onset (6 hrs)",
    menuGroup: "BOM Forecasts",
    stack: "tiles",
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomHazardousWind`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ71153",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          opacity: 0.6,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Flood Warning Boundaries from Beacon
 */
export function registerBOMFloodWarningBoundariesLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomFloodWarningBoundaries", {
    label: "BOM Flood Warning Boundaries",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 3600000, // 1 hr – reference data
    visibleByDefault: localStorage.getItem(`ov.bomFloodWarningBoundaries`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDM00017",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Fire Weather Districts from Beacon
 */
export function registerBOMFireWeatherDistrictsLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomFireWeatherDistricts", {
    label: "BOM Fire Weather Districts",
    menuGroup: "BOM Observations",
    stack: "tiles",
    refreshMs: 3600000, // 1 hr – reference data
    visibleByDefault: localStorage.getItem(`ov.bomFireWeatherDistricts`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: ["IDM00007", "IDM00021"],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}

/**
 * Register BOM Severe Thunderstorm Warning areas from Beacon
 */
export function registerBOMSevereThunderstormWarningLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSevereThunderstorm", {
    label: "BOM Severe Thunderstorm Warning",
    menuGroup: "BOM Warnings",
    stack: "vector",
    defaultOpacity: 60,
    refreshMs: 300000, // 5 min – warnings are reissued as storms move
    visibleByDefault: localStorage.getItem(`ov.bomSevereThunderstorm`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        new WmsViewImageLayer(wmsUrl, {
          layers: "IDZ20006",
          styles: "default",
          format: "image/png",
          transparent: true,
          _cb: data?.cacheBuster,
        }, { attribution: "Bureau of Meteorology" })
      );
    },
  });
}

/**
 * Register the storm cells named in BOM Severe Thunderstorm Warnings, with
 * their direction and time, from Beacon
 */
export function registerBOMSevereThunderstormCellsLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSevereThunderstormCells", {
    label: "BOM Severe Thunderstorm Cells",
    menuGroup: "BOM Warnings",
    stack: "vector",
    defaultOpacity: 50,
    refreshMs: 300000, // 5 min – warnings are reissued as storms move
    visibleByDefault: localStorage.getItem(`ov.bomSevereThunderstormCells`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        new WmsViewImageLayer(wmsUrl, {
          // Cells, track arrows and times
          layers: "IDZ20007,IDZ20007_track,IDZ20007_time",
          styles: "default",
          format: "image/png",
          transparent: true,
          _cb: data?.cacheBuster,
        }, { attribution: "Bureau of Meteorology" })
      );
    },
  });
}


/**
 * Register BOM Volcanic Ash Advisory (VAAC Darwin) from Beacon
 */
export function registerBOMVolcanicAshLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomVolcanicAsh", {
    label: "BOM Volcanic Ash Advisory",
    menuGroup: "BOM Warnings",
    stack: "vector",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomVolcanicAsh`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          // Furthest-out forecast cloud at the bottom, the volcano on top
          layers: [
            "IDZ20001018_poly",
            "IDZ20001012_poly",
            "IDZ20001006_poly",
            "IDZ20001000_poly",
            "IDZ20001_pt",
          ],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}


/**
 * Register BOM Sea Surface Temperature from Beacon
 */
export function registerBOMSeaSurfaceTempLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomSeaSurfaceTemp", {
    label: "BOM Sea Surface Temperature (°C)",
    menuGroup: "BOM Observations",
    stack: "tiles",
    defaultOpacity: 60,
    refreshMs: 3600000, // 1 hr – daily analysis
    visibleByDefault: localStorage.getItem(`ov.bomSeaSurfaceTemp`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: ["IDYOC050_raster", "IDYOC050_line"],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}
