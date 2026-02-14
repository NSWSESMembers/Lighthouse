import L from "leaflet";
import * as esri from "esri-leaflet";

/**
 * Colour by WaterNSW Special/Controlled Area class.
 * Mirrors the service's own renderer colours.
 */
function styleByClass(cls) {
  switch (cls) {
    case "Schedule 1 Controlled Area":
      return { color: "#0070FF", fillColor: "#0070FF" }; // blue
    case "Schedule 1 Special Area":
      return { color: "#FF0000", fillColor: "#FF0000" }; // red
    case "Schedule 2 Special Area":
      return { color: "#FFAA00", fillColor: "#FFAA00" }; // orange
    default:
      return { color: "#888888", fillColor: "#888888" };
  }
}

export function registerWaterNSWBoundariesLayer(vm) {
  vm.mapVM.registerPollingLayer("waternswBoundaries", {
    label: "WaterNSW Special & Controlled Areas",
    menuGroup: "Public Service",
    refreshMs: 0, // static data – no auto-refresh
    visibleByDefault: localStorage.getItem(`ov.waternswBoundaries`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      const featureLayer = esri.featureLayer({
        url: "https://nula.waternsw.com.au/arcgis/rest/services/WaterNSW_Boundaries/WaterNSW_Boundaries/FeatureServer/1",
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "Class", "NAME"],
        style: (feature) => {
            console.log(feature)
          const cls = feature.properties.Class;
          const colours = styleByClass(cls);
          return {
            weight: 1.5,
            color: colours.color,
            opacity: 1,
            fill: true,
            fillColor: colours.fillColor,
            fillOpacity: 0.3,
          };
        },
      });

      featureLayer.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>${p.NAME || "Unknown"}</strong><br>${p.Class || ""}`;
      });

      layerGroup.addLayer(featureLayer);
    },
  });
}

export function registerEPAContaminationSitesLayer(vm) {
  vm.mapVM.registerPollingLayer("epaContamination", {
    label: "EPA Contamination Sites",
    menuGroup: "Public Service",
    refreshMs: 0, // updated monthly server-side – no client poll
    visibleByDefault: localStorage.getItem(`ov.epaContamination`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      const featureLayer = esri.featureLayer({
        url: "https://nula.waternsw.com.au/arcgis/rest/services/External_Data/Contamination_Sites_EPA/FeatureServer/0",
        where: "1=1",
        fields: ["OBJECTID", "SiteName", "Address", "Suburb", "ContaminationActivityType", "ManagementClass"],
        pointToLayer: (_geojson, latlng) => {
          return L.circleMarker(latlng, {
            pane: "pane-middle",
            radius: 5,
            weight: 0.6,
            color: "#000",
            fillColor: "#E60000",
            fillOpacity: 0.85,
          });
        },
      });

      featureLayer.bindPopup((layer) => {
        const p = layer.feature.properties;
        return [
          `<strong>${p.SiteName || "Unknown Site"}</strong>`,
          p.Address ? `<br>${p.Address}` : "",
          p.Suburb ? `, ${p.Suburb}` : "",
          p.ContaminationActivityType
            ? `<br><strong>Activity:</strong> ${p.ContaminationActivityType}`
            : "",
          p.ManagementClass
            ? `<br><strong>Management:</strong> ${p.ManagementClass}`
            : "",
        ].join("");
      });

      layerGroup.addLayer(featureLayer);
    },
  });
}
