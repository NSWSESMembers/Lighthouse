import * as esri from "esri-leaflet";

const BASE_URL =
  "https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/BOM_Land_Warnings_RO/FeatureServer";

/* ── Flood Warning severity colours (layer 0 & 1) ────────────── */
function floodSeverityStyle(severity) {
  switch (severity) {
    case "MAJ":
      return { color: "#E60000", fillColor: "#FF0000", fillOpacity: 0.4 };
    case "MOD":
      return { color: "#FFAA00", fillColor: "#FFAA00", fillOpacity: 0.4 };
    case "MIN":
      return { color: "#38A800", fillColor: "#B4D79E", fillOpacity: 0.4 };
    case "BMIN":
      return { color: "#00C5FF", fillColor: "#FFFFFF", fillOpacity: 0.3 };
    case "FINAL":
      return { color: "#CDCD66", fillColor: "#F2F2E1", fillOpacity: 0.3 };
    case "UNCL":
    default:
      return { color: "#C8C3FF", fillColor: "#EFEDFF", fillOpacity: 0.3 };
  }
}

/* ── Fire Weather severity colours (layer 4) ──────────────────── */
function fireSeverityStyle(severity) {
  switch (severity) {
    case "CAT":
      return { color: "#730000", fillColor: "#730000", fillOpacity: 0.45 };
    case "EXT":
      return { color: "#E60000", fillColor: "#E60000", fillOpacity: 0.4 };
    case "SEV":
    default:
      return { color: "#E69800", fillColor: "#E69800", fillOpacity: 0.4 };
  }
}

/* ── Human-readable severity label ────────────────────────────── */
function severityLabel(code) {
  const map = {
    MAJ: "Major",
    MOD: "Moderate",
    MIN: "Minor",
    BMIN: "Below Minor",
    UNCL: "Generalised",
    FINAL: "Final Warning",
    SEV: "Severe",
    CAT: "Catastrophic",
    EXT: "Extreme",
  };
  return map[code] || code || "";
}

/**
 * Register a single toggle that draws all five BOM Land Warning sub-layers.
 */
export function registerBOMLandWarningsLayer(vm) {
  vm.mapVM.registerPollingLayer("bomLandWarnings", {
    label: "BOM Land Warnings",
    menuGroup: "Bureau of Meteorology",
    refreshMs: 300000, // 5 min – warnings update frequently
    visibleByDefault: localStorage.getItem(`ov.bomLandWarnings`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      /* --- 0  Flood Warning ----------------------------------- */
      const floodWarning = esri.featureLayer({
        url: `${BASE_URL}/0`,
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "name", "severity", "status", "phase", "start_time_local", "end_time_local"],
        style: (feature) => {
          const s = floodSeverityStyle(feature.properties.severity);
          return { weight: 2, color: s.color, opacity: 1, fill: true, fillColor: s.fillColor, fillOpacity: s.fillOpacity };
        },
      });
      floodWarning.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>🌊 Flood Warning</strong><br>
          ${p.name || "Unknown"}<br>
          <strong>Severity:</strong> ${severityLabel(p.severity)}<br>
          ${p.phase ? `<strong>Phase:</strong> ${p.phase}<br>` : ""}
          ${p.start_time_local ? `<strong>From:</strong> ${new Date(p.start_time_local).toLocaleString()}<br>` : ""}
          ${p.end_time_local ? `<strong>Until:</strong> ${new Date(p.end_time_local).toLocaleString()}` : ""}`;
      });
      layerGroup.addLayer(floodWarning);

      /* --- 1  Flood Watch -------------------------------------- */
      const floodWatch = esri.featureLayer({
        url: `${BASE_URL}/1`,
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "name", "severity", "status", "phase", "start_time_local", "end_time_local"],
        style: (feature) => {
          const s = floodSeverityStyle(feature.properties.severity);
          return { weight: 2, dashArray: "6 4", color: s.color, opacity: 1, fill: true, fillColor: s.fillColor, fillOpacity: s.fillOpacity * 0.6 };
        },
      });
      floodWatch.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>👁️ Flood Watch</strong><br>
          ${p.name || "Unknown"}<br>
          <strong>Severity:</strong> ${severityLabel(p.severity)}<br>
          ${p.phase ? `<strong>Phase:</strong> ${p.phase}<br>` : ""}
          ${p.start_time_local ? `<strong>From:</strong> ${new Date(p.start_time_local).toLocaleString()}<br>` : ""}
          ${p.end_time_local ? `<strong>Until:</strong> ${new Date(p.end_time_local).toLocaleString()}` : ""}`;
      });
      layerGroup.addLayer(floodWatch);

      /* --- 2  Severe Weather Warning --------------------------- */
      const severeWeather = esri.featureLayer({
        url: `${BASE_URL}/2`,
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "product", "phenomena", "warning", "validfrom_utc", "validto_utc"],
        style: () => ({
          weight: 1.5,
          color: "#6E6E6E",
          opacity: 1,
          fill: true,
          fillColor: "#F7E363",
          fillOpacity: 0.45,
        }),
      });
      severeWeather.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>⚠️ Severe Weather Warning</strong><br>
          ${p.phenomena || p.product || "Unknown"}<br>
          ${p.warning ? `${p.warning}<br>` : ""}
          ${p.validfrom_utc ? `<strong>From:</strong> ${new Date(p.validfrom_utc).toLocaleString()}<br>` : ""}
          ${p.validto_utc ? `<strong>Until:</strong> ${new Date(p.validto_utc).toLocaleString()}` : ""}`;
      });
      layerGroup.addLayer(severeWeather);

      /* --- 3  Thunderstorm Warning ----------------------------- */
      const thunderstorm = esri.featureLayer({
        url: `${BASE_URL}/3`,
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "severity", "status", "phase", "start_time_local", "end_time_local", "state_code"],
        style: () => ({
          weight: 1.5,
          color: "#6E6E6E",
          opacity: 1,
          fill: true,
          fillColor: "#C896FF",
          fillOpacity: 0.4,
        }),
      });
      thunderstorm.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>⛈️ Thunderstorm Warning</strong><br>
          <strong>Severity:</strong> ${severityLabel(p.severity)}<br>
          ${p.phase ? `<strong>Phase:</strong> ${p.phase}<br>` : ""}
          ${p.start_time_local ? `<strong>From:</strong> ${new Date(p.start_time_local).toLocaleString()}<br>` : ""}
          ${p.end_time_local ? `<strong>Until:</strong> ${new Date(p.end_time_local).toLocaleString()}` : ""}`;
      });
      layerGroup.addLayer(thunderstorm);

      /* --- 4  Fire Weather Warnings ---------------------------- */
      const fireWeather = esri.featureLayer({
        url: `${BASE_URL}/4`,
        pane: "pane-lowest",
        where: "1=1",
        fields: ["OBJECTID", "severity", "status", "headline", "day", "start_time_local", "end_time_local", "state_code"],
        style: (feature) => {
          const s = fireSeverityStyle(feature.properties.severity);
          return { weight: 1.5, color: s.color, opacity: 1, fill: true, fillColor: s.fillColor, fillOpacity: s.fillOpacity };
        },
      });
      fireWeather.bindPopup((layer) => {
        const p = layer.feature.properties;
        return `<strong>🔥 Fire Weather Warning</strong><br>
          ${p.headline || ""}<br>
          <strong>Severity:</strong> ${severityLabel(p.severity)}<br>
          ${p.day ? `<strong>Day:</strong> ${p.day}<br>` : ""}
          ${p.start_time_local ? `<strong>From:</strong> ${new Date(p.start_time_local).toLocaleString()}<br>` : ""}
          ${p.end_time_local ? `<strong>Until:</strong> ${new Date(p.end_time_local).toLocaleString()}` : ""}`;
      });
      layerGroup.addLayer(fireWeather);
    },
  });
}
