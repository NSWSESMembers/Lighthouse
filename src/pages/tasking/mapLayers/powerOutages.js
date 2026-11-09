import L from "leaflet";
import { escapeHtml } from "../../../shared/feedHtml.js";
import { fetchPowerOutages, outageRows, outageTitle } from "../../../shared/powerOutages.js";

// Current Ausgrid / Endeavour Energy / Essential Energy outages, from the
// power-outages Lambda (it fetches the companies' feeds and caches them for
// a couple of minutes). Unplanned and planned outages are separate overlays
// sharing one request.

const REFRESH_MS = 5 * 60 * 1000;
const SHARE_MS = 60 * 1000; // both overlays refreshing together share a fetch

let shared = null; // { at, promise }

function loadShared(getToken) {
  const now = Date.now();
  if (shared && now - shared.at < SHARE_MS) return shared.promise;
  const promise = getToken().then((token) => fetchPowerOutages(token));
  shared = { at: now, promise };
  promise.catch(() => {
    if (shared?.promise === promise) shared = null; // let the next refresh retry
  });
  return promise;
}

const STYLE = {
  unplanned: { colour: "#c62828", iconFill: "#ffd21f", iconBolt: "#1f1f1f" },
  planned: { colour: "#1a7bbf", iconFill: "#ffffff", iconBolt: "#1a7bbf" },
};

// An electrical warning triangle, centred on the outage.
function outageIcon({ colour, iconFill, iconBolt }) {
  const triangle = "M14 3.5 25.5 23H2.5Z";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="26" viewBox="0 0 28 26">` +
    `<path d="${triangle}" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>` +
    `<path d="${triangle}" fill="${iconFill}" stroke="${colour}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M15 9 10 16.4h3.2l-.9 4.8 5.7-7.3h-3.4z" fill="${iconBolt}"/>` +
    `</svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [28, 26],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

function popupHtml(props, meta) {
  const rows = outageRows(props, meta)
    .map(([label, text]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}`)
    .join("<br>");
  return `<strong>${escapeHtml(outageTitle(props))}</strong><br>${rows}`;
}

function registerOutageLayer(vm, getToken, key, type, label) {
  vm.mapVM.registerPollingLayer(key, {
    label,
    menuGroup: "Infrastructure",
    refreshMs: REFRESH_MS,
    stackAbove: "powerBoundaries",
    visibleByDefault: localStorage.getItem(`ov.${key}`) || false,
    fetchFn: async () => {
      const body = await loadShared(getToken);
      const providers = Object.values(body.meta?.providers || {});
      // Every company failing with nothing cached: report it as a failure
      // so the Layers menu shows the error instead of an empty layer.
      if (providers.length && providers.every((p) => !p.ok && !p.count)) {
        throw new Error("Power outage feeds are not responding");
      }
      return {
        meta: body.meta,
        features: body.features.filter((f) => f?.properties?.type === type),
      };
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;
      const style = STYLE[type];
      const icon = outageIcon(style);
      for (const f of data.features) {
        const p = f.properties;
        const html = popupHtml(p, data.meta);
        const geomType = f.geometry?.type;
        if (geomType === "Polygon" || geomType === "MultiPolygon") {
          layerGroup.addLayer(
            L.geoJSON(f, {
              pane: "pane-lowest-plus",
              style: { color: style.colour, weight: 1.5, fillColor: style.colour, fillOpacity: 0.25 },
            }).bindPopup(html, { pane: "pane-popup-top" }),
          );
        }
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        layerGroup.addLayer(
          L.marker([p.lat, p.lng], {
            pane: "pane-middle",
            title: outageTitle(p),
            icon,
          }).bindPopup(html, { pane: "pane-popup-top" }),
        );
      }
    },
  });
}

export function registerPowerOutagesLayers(vm, getToken) {
  registerOutageLayer(vm, getToken, "powerOutagesUnplanned", "unplanned", "Power Outages (Unplanned)");
  registerOutageLayer(vm, getToken, "powerOutagesPlanned", "planned", "Power Outages (Planned, next 48 hrs)");
}
