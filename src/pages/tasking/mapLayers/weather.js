/**
 * Register BOM All WMS layer using provided URL
 */
export function registerBOMAllFloodLevelsLayer(vm) {
  const allUrl = "https://beacon.ses.nsw.gov.au/MappingLayers/RequestBomLayer";
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
        // Default bounding box for all, but map will handle view
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}
import L from "leaflet";

/**
 * Register BOM Rainfall WMS layer from Beacon Prod
 */
export function registerBOMRainfallLayer(vm) {
  const rainfallUrl = "https://beacon.ses.nsw.gov.au/MappingLayers/RequestBomLayer";
  vm.mapVM.registerPollingLayer("bomRainfall", {
    label: "BOM Rainfall (9am)",
    menuGroup: "Weather",
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
        // Default NSW bounding box, but map will handle view
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}


/**
 * Register BOM Radar WMS layer from Beacon Prod
 */
export function registerBOMRadarLayer(vm) {
  const radarUrl = "https://beacon.ses.nsw.gov.au/MappingLayers/RequestBomLayer";
  vm.mapVM.registerPollingLayer("bomRadar", {
    label: "BOM Rain Radar Still",
    menuGroup: "Weather",
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
        // Default bounding box for radar, but map will handle view
      });
      layerGroup.addLayer(wmsLayer);
    },
  });
}