import L from "leaflet";

/**
 * Register BOM All WMS layer using provided URL
 */
export function registerBOMAllFloodLevelsLayer(vm, sourceUrl) {
  const allUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomAll", {
    label: "BOM Flood Levels",
    menuGroup: "BOM Observations",
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
        crs: L.CRS.EPSG4326,
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
        crs: L.CRS.EPSG4326,
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomRadar`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: "IDR00010",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
        _cb: data?.cacheBuster,
      });
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomSatTrueColor`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: "IDE00435",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Japan Meteorological Agency via Bureau of Meteorology",
        _cb: data?.cacheBuster,
      });
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomThunderstormTracking`) || false,
    fetchFn: async () => {
      return { cacheBuster: Date.now() };
    },
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: "IDR00011,IDR00011_track",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
        opacity: 0.7,
        _cb: data?.cacheBuster
      });
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomWind`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_windpt","IDY25026_windrast"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        opacity: 0.5, // Adjust opacity for more transparency
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomMSLP`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_mslp"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
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
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomLightning`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDZ20019_c2g_2h"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
        _cb: data?.cacheBuster,
      });
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
    refreshMs: 600000,
    visibleByDefault: localStorage.getItem(`ov.bomLightning24h`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          layers: "IDZ20019_c2g_2-24h",
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          crs: L.CRS.EPSG4326,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
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
          crs: L.CRS.EPSG4326,
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}