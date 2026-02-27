/**
 * Register BOM All WMS layer using provided URL
 */
export function registerBOMAllFloodLevelsLayer(vm, sourceUrl) {
  const allUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomAll", {
    label: "BOM Flood Levels",
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomAllFlood`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(allUrl, {
        layers: "IDN62011_all",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}
import L from "leaflet";

/**
 * Register BOM Rainfall WMS layer from Beacon
 */
export function registerBOMRainfallLayer(vm, sourceUrl) {
  const rainfallUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomRainfall", {
    label: "BOM Rainfall (9am)",
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomRainfall`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(rainfallUrl, {
        layers: "IDZ20010_rainfall_9am",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
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
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomRadar`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: "IDR00010",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
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
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomSatTrueColor`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: "IDE00435",
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Japan Meteorological Agency via Bureau of Meteorology"
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
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomThunderstormTracking`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDR00011","IDR00011_track"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology"
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
    menuGroup: "Bureau of Meteorology",
   
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomWind`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_windpt","IDY25026_windrast"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        opacity: 0.5, // Adjust opacity for more transparency
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology"
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
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomMSLP`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDY25026_mslp"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology"
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
    menuGroup: "Bureau of Meteorology",
    refreshMs: 600000, // 10 min
    visibleByDefault: localStorage.getItem(`ov.bomLightning`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, _data) => {
      const wmsLayer = L.tileLayer.wms(radarUrl, {
        layers: ["IDZ20019_c2g_2h"],
        styles: "default",
        format: "image/png",
        transparent: true,
        bgcolor: "0xFFFFFF",
        version: "1.3.0",
        crs: L.CRS.EPSG4326,
        attribution: "Bureau of Meteorology",
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}