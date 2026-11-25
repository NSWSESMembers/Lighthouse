import L from "leaflet";
import { escapeHtml } from "../../../shared/feedHtml.js";
import { fetchCouncilDataset } from "../../../shared/councilSystems.js";

// Councils' FloodSmart dashboards (the Lizard platform), through the council
// systems Lambda (lambda/council-systems-v2), which fetches and caches them.
// City of Parramatta: the flood warning areas with their FloodSmart forecast
// alerts, forecast flood hazard (H1-H6), the council's impact assets
// forecast flooded or not, and the catchment rainfall totals. Northern Beaches Council FLASH
// (also on Lizard, same rainfall tables): the catchment rainfall totals.
//
// Anything forecast is labelled as a forecast wherever it shows (layer name,
// map label, popup), so it can't be read as observed or as an issued warning.
//
// Parramatta's gauge water levels aren't shown (the Lambda has them): a level
// in m AHD means nothing without that gauge's warning thresholds.

const ATTRIBUTION = "City of Parramatta FloodSmart";
const MENU = { menuGroup: "Council Systems", menuSubgroup: "Parramatta FloodSmart" };
const REFRESH_MS = 5 * 60 * 1000;
const SHARE_MS = 60 * 1000; // rainfall layers refreshing together share a fetch

// One layer per rainfall total, in the Lambda's names (lambda/council-systems-v2/floodsmart.mjs).
// The Lambda returns every total each council's dashboard offers; these are the ones shown.
const RAINFALL_PERIODS = [
  ["since9am", "since 9am"],
  ["next3hr", "forecast next 3 hrs"],
];

// The FloodSmart dashboard's rainfall scale: [up to (mm), colour]
const RAIN_SCALE = [
  [10, "#F5F5FF"], [20, "#B4B4FF"], [30, "#7878FF"], [50, "#1414FF"],
  [60, "#00D8C3"], [80, "#009690"], [100, "#15a345"], [150, "#006666"],
  [200, "#FFFF00"], [250, "#FFC800"], [300, "#FF6400"], [400, "#FF0000"],
  [500, "#C80000"], [600, "#780000"], [700, "#280000"], [Infinity, "#000000"],
];
const rainColour = (mm) => (mm == null ? "#cccccc" : RAIN_SCALE.find(([max]) => mm < max)[1]);
const mmText = (mm) => (mm == null ? "–" : Number(mm).toFixed(1));

/** A council's catchment rainfall, shared by its rainfall layers. */
function rainfallLoader(council, getToken) {
  let shared = null; // { at, promise }
  return () => {
    const now = Date.now();
    if (shared && now - shared.at < SHARE_MS) return shared.promise;
    const promise = getToken().then((token) => fetchCouncilDataset(council, "catchment-rainfall", token));
    shared = { at: now, promise };
    promise.catch(() => {
      if (shared?.promise === promise) shared = null; // let the next refresh retry
    });
    return promise;
  };
}

const forecastTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const whenText = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : forecastTime.format(d);
};

// Forecast alert states (lambda/council-systems-v2/parramatta.mjs warningAreaFeatures)
const FORECAST_STATES = {
  none: { text: "no alert set up for this area", colour: "#0b5c8a", fill: "#2f8fc9", fillOpacity: 0.12 },
  clear: { text: "no warning level", colour: "#0b5c8a", fill: "#2f8fc9", fillOpacity: 0.12 },
  unknown: { text: "unavailable", colour: "#6c757d", fill: "#adb5bd", fillOpacity: 0.25, dashed: true, label: "Forecast unavailable" },
  pim: { text: "Public information level", colour: "#0277bd", fill: "#4fc3f7", fillOpacity: 0.35, dashed: true, label: "Forecast: public info" },
  minor: { text: "Minor flood level", colour: "#b38f00", fill: "#ffd400", fillOpacity: 0.4, dashed: true, label: "Forecast: Minor" },
  moderate: { text: "Moderate flood level", colour: "#c25e00", fill: "#ff8c00", fillOpacity: 0.45, dashed: true, label: "Forecast: Moderate" },
  major: { text: "Major flood level", colour: "#b71c1c", fill: "#e53935", fillOpacity: 0.45, dashed: true, label: "Forecast: Major" },
};
const LEVEL_TEXT = { pim: "Public info", minor: "Minor", moderate: "Moderate", major: "Major" };
const mAHD = (v) => `${Number(v).toFixed(2)} m AHD`;

function warningAreaPopup(p) {
  const fc = p.forecast || { status: "none" };
  const state = FORECAST_STATES[fc.status] || FORECAST_STATES.unknown;
  const lines = [`<strong>${escapeHtml(p.name)}</strong> flood warning area`];
  if (p.description) lines.push(`<small>${escapeHtml(p.description)}</small>`);
  const hours = fc.hours || 5;
  lines.push(`<strong>Flood model forecast, next ${hours} hrs: ${escapeHtml(state.text)}</strong>`);
  if (fc.to) {
    const short = Date.parse(fc.to) - Date.parse(fc.from) < (hours * 3600 - 600) * 1000;
    lines.push(`<small>Forecast window ${escapeHtml(whenText(fc.from))} to ${escapeHtml(whenText(fc.to))}${short ? " (the forecast ends early)" : ""}</small>`);
  }
  if (LEVEL_TEXT[fc.status] && Number.isFinite(fc.value)) {
    lines.push(`Forecast to go above the ${LEVEL_TEXT[fc.status]} level (${mAHD(fc.thresholdValue)}) around ${escapeHtml(whenText(fc.expectedAt))}, peaking at ${mAHD(fc.value)} around ${escapeHtml(whenText(fc.peakAt))}.`);
  } else if (fc.status === "clear" && Number.isFinite(fc.value)) {
    lines.push(`Forecast peak ${mAHD(fc.value)} around ${escapeHtml(whenText(fc.peakAt))}, below every warning level.`);
  } else if (fc.status === "unknown") {
    lines.push("The flood model doesn't have a current forecast for this area, so nothing can be shown.");
  }
  if (fc.thresholds?.length) {
    lines.push(`<small>Warning levels: ${fc.thresholds.map((t) => `${LEVEL_TEXT[t.level] || escapeHtml(t.level)} ${Number(t.value).toFixed(2)}`).join(" · ")} m AHD</small>`);
  }
  lines.push(`<small>A forecast from the ${ATTRIBUTION} flood model, not an observed level or an issued warning. Check NSW SES warnings.</small>`);
  return lines.join("<br>");
}

function catchmentPopup(p, period, attribution) {
  const rows = RAINFALL_PERIODS.map(([key, text]) => {
    const row = `${escapeHtml(text[0].toUpperCase() + text.slice(1))}: ${mmText(p.totals?.[key])} mm`;
    return key === period ? `<strong>${row}</strong>` : row;
  });
  return `<strong>${escapeHtml(p.name)} catchment</strong><br>${rows.join("<br>")}<br><small>${attribution}</small>`;
}

/** One layer per rainfall period for a council's catchments, e.g. "Parramatta Rainfall since 9am". */
function registerCatchmentRainfallLayers(vm, getToken, { council, place, keyPrefix, attribution, menu }) {
  const load = rainfallLoader(council, getToken);
  for (const [period, text] of RAINFALL_PERIODS) {
    const key = `${keyPrefix}-${period}`;
    vm.mapVM.registerPollingLayer(key, {
      label: `${place} Rainfall ${text}`,
      ...menu,
      refreshMs: REFRESH_MS,
      visibleByDefault: localStorage.getItem(`ov.${key}`) || false,
      fetchFn: load,
      drawFn: (layerGroup, data) => {
        if (!data) return;
        for (const f of data.features) {
          const p = f.properties || {};
          const mm = p.totals?.[period] ?? null;
          const poly = L.geoJSON(f, {
            pane: "pane-lowest-plus",
            attribution,
            style: { color: "#555", weight: 1, opacity: 0.8, fillColor: rainColour(mm), fillOpacity: 0.6 },
          }).bindPopup(catchmentPopup(p, period, attribution), { pane: "pane-popup-top" });
          layerGroup.addLayer(poly);
          // The total, at the catchment's label point like the FloodSmart map
          const at = p.anchor ? [p.anchor[1], p.anchor[0]] : poly.getBounds().getCenter();
          layerGroup.addLayer(
            L.tooltip({ pane: "pane-middle", permanent: true, direction: "center", className: "lh-rain-label", interactive: false })
              .setLatLng(at)
              .setContent(mmText(mm)),
          );
        }
      },
    });
  }
}

// Australian flood hazard categories (AIDR Guideline 7-3, Table 2), as the
// Lambda works them out (lambda/council-systems-v2/hazard.mjs).
const HAZARD = [
  null,
  { colour: "#9ccc65", text: "Generally safe for vehicles, people and buildings" },
  { colour: "#fdd835", text: "Unsafe for small vehicles" },
  { colour: "#ffb74d", text: "Unsafe for vehicles, children and the elderly" },
  { colour: "#f57c00", text: "Unsafe for vehicles and people" },
  { colour: "#d32f2f", text: "Unsafe for vehicles and people. All buildings vulnerable to structural damage" },
  { colour: "#6a1b9a", text: "Unsafe for vehicles and people. All buildings vulnerable to failure" },
];

function decodeBase64(b64) {
  const bin = atob(b64 || "");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The Lambda's hazard grid: typed arrays plus its lat/lon bounds. */
function decodeHazardGrid(g) {
  const hazard = decodeBase64(g.hazard);
  const depth = new Uint16Array(decodeBase64(g.depth).buffer);
  const velocity = new Uint16Array(decodeBase64(g.velocity).buffer);
  const south = g.north - g.height * g.cellLat;
  const east = g.west + g.width * g.cellLon;
  return { ...g, hazard, depth, velocity, bounds: L.latLngBounds([south, g.west], [g.north, east]) };
}

/** The hazard grid as a PNG data URL, one pixel per cell, dry cells clear. */
function hazardImage(grid) {
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(grid.width, grid.height);
  const rgb = HAZARD.map((h) => h && [1, 3, 5].map((i) => parseInt(h.colour.slice(i, i + 2), 16)));
  for (let i = 0; i < grid.hazard.length; i++) {
    const c = rgb[grid.hazard[i]];
    if (!c) continue;
    img.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// Each model area's forecast window: the maxima are over all of it.
const untilText = (runs) => runs
  .filter((r) => r.available)
  .map((r) => `${escapeHtml(r.area)}: ${r.forecastFrom ? `${escapeHtml(whenText(r.forecastFrom))} to ` : "to "}${escapeHtml(whenText(r.forecastUntil))}`)
  .join("<br>");

function hazardLegendHtml(runs) {
  const rows = HAZARD.slice(1).map((h, i) =>
    `<div class="lh-hazard-row"><span class="lh-hazard-swatch" style="background:${h.colour}"></span><b>H${i + 1}</b> ${escapeHtml(h.text)}</div>`).join("");
  const missing = runs.filter((r) => !r.available).map((r) => r.area);
  return `<div class="lh-hazard-title">Forecast flood hazard (Parramatta)</div>${rows}` +
    `<div class="lh-hazard-note">From the flood model's <b>forecast</b> maximum depth and velocity over its whole run (about 36 hrs), not observed:<br>${untilText(runs)}</div>` +
    (missing.length ? `<div class="lh-hazard-note"><b>Forecast unavailable:</b> ${escapeHtml(missing.join(", "))} area</div>` : "") +
    `<div class="lh-hazard-note">Rivers, lakes and basins always show H5-H6: deep water even in dry weather.</div>`;
}

const HazardLegend = L.Control.extend({
  options: { position: "bottomright" },
  onAdd() {
    const div = L.DomUtil.create("div", "lh-hazard-legend leaflet-bar");
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  },
  setRuns(runs) {
    this.getContainer().innerHTML = hazardLegendHtml(runs);
  },
});

function hazardPopup(grid, i, runs) {
  const h = grid.hazard[i];
  const d = grid.depth[i] / 100;
  const v = grid.velocity[i] / 100;
  return [
    `<strong>Forecast flood hazard: H${h}</strong>`,
    escapeHtml(HAZARD[h].text),
    `Forecast maximum depth ${d.toFixed(2)} m, maximum velocity ${v.toFixed(2)} m/s (D×V ${(d * v).toFixed(2)} m²/s)`,
    `<small>The two maxima may not happen at the same time, so this can overstate the hazard at any one moment. ${untilText(runs)}</small>`,
    `<small>A forecast from the ${ATTRIBUTION} flood model (~25 m cells), not observed. Categories: AIDR Guideline 7-3.</small>`,
  ].join("<br>");
}

function registerFloodHazardLayer(vm, getToken, map) {
  const legend = new HazardLegend();
  let current = null; // { grid, runs }
  let layerGroup = null;

  const onMapClick = (e) => {
    if (!current?.grid) return;
    const { grid } = current;
    const col = Math.floor((e.latlng.lng - grid.west) / grid.cellLon);
    const row = Math.floor((grid.north - e.latlng.lat) / grid.cellLat);
    if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return;
    const i = row * grid.width + col;
    if (!grid.hazard[i]) return;
    L.popup({ pane: "pane-popup-top" }).setLatLng(e.latlng).setContent(hazardPopup(grid, i, current.runs)).openOn(map);
  };

  const entry = vm.mapVM.registerPollingLayer("floodsmartHazard", {
    label: "Parramatta Flood Hazard H1–H6 (forecast max, ~36 hrs)",
    ...MENU,
    refreshMs: 15 * 60 * 1000,
    defaultOpacity: 70,
    visibleByDefault: localStorage.getItem("ov.floodsmartHazard") || false,
    fetchFn: async () => fetchCouncilDataset("parramatta", "flood-hazard", await getToken()),
    drawFn: (group, data) => {
      const p = data?.features?.[0]?.properties;
      if (!p) return;
      const grid = p.grid ? decodeHazardGrid(p.grid) : null;
      current = { grid, runs: p.runs || [] };
      if (map.hasLayer(group)) legend.setRuns(current.runs);
      if (!grid) return;
      group.addLayer(L.imageOverlay(hazardImage(grid), grid.bounds, {
        pane: "pane-lowest",
        className: "lh-hazard-image",
        interactive: false,
        attribution: ATTRIBUTION,
      }));
    },
  });
  layerGroup = entry?.layerGroup;
  // The legend and the click lookup only while the layer is on
  layerGroup?.on("add", () => {
    legend.addTo(map);
    if (current) legend.setRuns(current.runs);
    map.on("click", onMapClick);
  });
  layerGroup?.on("remove", () => {
    legend.remove();
    map.off("click", onMapClick);
  });
}

// The council's FloodSmart impact assets: flooded or not in its 12-hour model
// run. Only the status is shown, no depths or levels.
const IMPACT_STYLE = {
  flooded: { size: 30, text: "Flooded" },
  not_flooded: { size: 22, text: "Not flooded" },
  unknown: { size: 22, text: "unavailable" },
};

// Font Awesome 5 icon per asset type (the Lambda's type names; FA5 has no bridge)
const IMPACT_ICONS = {
  "Road or crossing": "fa-road",
  Houses: "fa-home",
  Healthcare: "fa-hospital",
  "Historical landmark": "fa-landmark",
  Levee: "fa-water",
  Bushland: "fa-tree",
};

function impactIcon(p) {
  const status = IMPACT_STYLE[p.status] ? p.status : "unknown";
  const { size } = IMPACT_STYLE[status];
  return L.divIcon({
    className: "",
    html: `<div class="lh-impact lh-impact-${status}" style="width:${size}px;height:${size}px"><i class="fas ${IMPACT_ICONS[p.type] || "fa-map-marker-alt"}"></i></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [size / 2, 0],
  });
}

function impactPopup(p) {
  const style = IMPACT_STYLE[p.status] || IMPACT_STYLE.unknown;
  const lines = [
    `<strong>${escapeHtml(p.name)}</strong>`,
    escapeHtml(p.type),
    `<strong>Forecast, next ~12 hrs: ${style.text}</strong>`,
  ];
  if (p.forecastFrom && p.forecastUntil) {
    lines.push(`<small>Model run ${escapeHtml(whenText(p.forecastFrom))} to ${escapeHtml(whenText(p.forecastUntil))}</small>`);
  } else if (p.status === "unknown") {
    lines.push("<small>The council's flood model forecast isn't current, so this asset's forecast can't be shown.</small>");
  }
  lines.push(`<small>The ${ATTRIBUTION} forecast for this asset, not an observation. Check NSW SES warnings.</small>`);
  return lines.join("<br>");
}

function registerFloodImpactsLayer(vm, getToken) {
  vm.mapVM.registerPollingLayer("floodsmartImpacts", {
    label: "Parramatta Flood Impacts (forecast next ~12 hrs)",
    ...MENU,
    refreshMs: 10 * 60 * 1000,
    visibleByDefault: localStorage.getItem("ov.floodsmartImpacts") || false,
    fetchFn: async () => fetchCouncilDataset("parramatta", "flood-impacts", await getToken()),
    drawFn: (layerGroup, data) => {
      if (!data) return;
      // Flooded assets last, so they draw on top
      const order = { not_flooded: 0, unknown: 1, flooded: 2 };
      const features = [...data.features].sort((a, b) => (order[a.properties?.status] ?? 1) - (order[b.properties?.status] ?? 1));
      for (const f of features) {
        const p = f.properties || {};
        const [lng, lat] = f.geometry?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const style = IMPACT_STYLE[p.status] || IMPACT_STYLE.unknown;
        layerGroup.addLayer(
          L.marker([lat, lng], { pane: "pane-middle", attribution: ATTRIBUTION, icon: impactIcon(p), title: p.name })
            .bindTooltip(`${escapeHtml(p.name)}: ${style.text} (forecast next ~12 hrs)`)
            .bindPopup(impactPopup(p), { pane: "pane-popup-top" }),
        );
      }
    },
  });
}

export function registerFloodSmartLayers(vm, getToken) {
  vm.mapVM.registerPollingLayer("floodsmartWarningAreas", {
    label: "Parramatta Flood Warning Areas (forecast next 5 hrs)",
    ...MENU,
    refreshMs: REFRESH_MS,
    visibleByDefault: localStorage.getItem("ov.floodsmartWarningAreas") || false,
    fetchFn: async () => fetchCouncilDataset("parramatta", "warning-areas", await getToken()),
    drawFn: (layerGroup, data) => {
      if (!data) return;
      for (const f of data.features) {
        const p = f.properties || {};
        const state = FORECAST_STATES[p.forecast?.status] || FORECAST_STATES.unknown;
        const poly = L.geoJSON(f, {
          pane: "pane-lowest-plus",
          attribution: ATTRIBUTION,
          style: {
            color: state.colour,
            weight: state.dashed ? 3 : 2,
            dashArray: state.dashed ? "8 6" : null,
            fillColor: state.fill,
            fillOpacity: state.fillOpacity,
          },
        }).bindPopup(warningAreaPopup(p), { pane: "pane-popup-top" });
        layerGroup.addLayer(poly);
        // Areas with a forecast alert say so on the map
        if (state.label) {
          layerGroup.addLayer(
            L.tooltip({ pane: "pane-middle", permanent: true, direction: "center", className: `lh-forecast-label lh-forecast-${p.forecast.status}`, interactive: false })
              .setLatLng(poly.getBounds().getCenter())
              .setContent(escapeHtml(state.label)),
          );
        }
      }
    },
  });

  registerFloodImpactsLayer(vm, getToken);

  registerFloodHazardLayer(vm, getToken, vm.mapVM.map);

  registerCatchmentRainfallLayers(vm, getToken, {
    council: "parramatta",
    place: "Parramatta",
    keyPrefix: "floodsmartRain",
    attribution: ATTRIBUTION,
    menu: MENU,
  });

  registerCatchmentRainfallLayers(vm, getToken, {
    council: "northernbeaches",
    place: "Northern Beaches",
    keyPrefix: "nbFloodsmartRain",
    attribution: "Northern Beaches Council FLASH",
    menu: { menuGroup: "Council Systems", menuSubgroup: "Northern Beaches FLASH" },
  });
}
