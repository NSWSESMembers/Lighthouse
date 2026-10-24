import BeaconClient from '../../../shared/BeaconClient.js';
import L from "leaflet";
import {
  transportHazardColour,
  transportHazardIcon,
  transportHazardRows,
  transportHazardShapes,
} from "../utils/transportHazard.js";

const escapeHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


export function registerTransportCamerasLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("transport-cameras", {
    label: "Transport NSW Cameras",
    menuGroup: "Transport NSW",
    refreshMs: 3600000, // 1 hr poll. the cameras list doesnt change and the images auto-refresh
    visibleByDefault: localStorage.getItem(`ov.transport-cameras`) || false,
    fetchFn: async () => {
      const t = await getToken(); // blocks until token is ready
      const res = await fetchTransportCamerasAsync(apiHost, params.userId, t);
      if (!res.ok) throw new Error("transport-cameras fetch failed: " + res.status);
      return res.response;
    },
    drawFn: (layerGroup, geojson) => {
      if (!geojson || !Array.isArray(geojson.features)) return;

      geojson.features.forEach((f) => {
        if (!f.geometry || f.geometry.type !== "Point") return;

        const iconUrl = `https://www.livetraffic.com/assets/icons/map/others/camera-${f.properties.direction}.svg`;
        const details = `
          ${f.properties.view}
          <br><br>
          <div style="height:190px;width:240px;display:block">
              <a target="_blank" href="${f.properties.href}">
                  <img width="100%" src="${f.properties.href}"></img>
              </a>
          </div>
          <sub>Click image to enlarge</sub>
        `;

        const [lng, lat] = f.geometry.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
          }),
        }).bindPopup(details, { pane: "pane-popup-top" });

        layerGroup.addLayer(marker);
      });
    },
  });
}

// Transport NSW managed incidents plus council (LGA) reported closures/hazards,
// e.g. regional road closures entered via OneRoad. The council reports are a
// separate Live Traffic feed (v1/live/hazards/regional-lga-incident/open), so
// fetch both and draw them as one layer.
export function registerTransportIncidentsLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("transport-incidents", {
    label: "Transport NSW Incidents",
    menuGroup: "Transport NSW",
    refreshMs: 600000, // 10 mins poll
    visibleByDefault: localStorage.getItem("ov.transport-incidents") || false,
    fetchFn: async () => {
      const t = await getToken(); // blocks here until token is ready
      // type is also the background.js message type
      const [incidents, council] = await Promise.allSettled(
        ["transport-incidents", "transport-local-reports"].map((type) =>
          fetchTransportFeedAsync(type, apiHost, params.userId, t),
        ),
      );
      if (incidents.status === "rejected" && council.status === "rejected") {
        throw new Error("transport-incidents fetch failed: " + (incidents.reason?.httpCode ?? ""));
      }
      const features = (result) =>
        result.status === "fulfilled" && Array.isArray(result.value.response?.features)
          ? result.value.response.features
          : [];
      return {
        incidents: features(incidents),
        // Live Traffic hides ended council reports; the old Lighthouse map also left out council roadworks.
        council: features(council).filter(
          (f) => !f.properties?.ended && f.properties?.CategoryIcon !== "Roadworks",
        ),
      };
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;
      const drawHazard = (f, council) => {
        if (!f?.properties) return;
        const { points, lines, areas } = transportHazardShapes(f);
        if (points.length === 0 && lines.length === 0 && areas.length === 0) return;

        const icon = transportHazardIcon(f, { council });
        const colour = transportHazardColour(f, { council });
        const popupTitle = council ? "Council Report" : "Traffic Hazard";

        const details = [
          `<strong>${escapeHtml(popupTitle)}: ${escapeHtml(f.properties.displayName || f.properties.mainCategory || "Incident")}</strong>`,
          ...transportHazardRows(f, { council }).map(
            ([label, text]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(text)}`,
          ),
        ].join("<br>");

        // Affected areas and stretches of road, as Live Traffic draws them; click for the same popup.
        areas.forEach((rings) => {
          layerGroup.addLayer(
            L.polygon(rings, { color: colour, weight: 1, fillColor: colour, fillOpacity: 0.2, pane: "pane-lowest-plus" })
              .bindPopup(details, { pane: "pane-popup-top" }),
          );
        });
        lines.forEach((line) => {
          layerGroup.addLayer(
            L.polyline(line, { color: colour, weight: 6, opacity: 0.8, pane: "pane-middle" })
              .bindPopup(details, { pane: "pane-popup-top" }),
          );
        });

        points.forEach((latLng) => {
          const marker = L.marker(latLng, {
            icon: L.icon({
              iconUrl: icon,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -16],
            }),
          }).bindPopup(details, { pane: "pane-popup-top" });

          layerGroup.addLayer(marker);
        });
      };
      data.incidents.forEach((f) => drawHazard(f, false));
      data.council.forEach((f) => drawHazard(f, true));
    },
  });
}


async function getTransportApiKeyOpsLog(apiHost, userId, token) {

    var opsId = null;
    switch (apiHost) {
        case 'https://previewbeacon.ses.nsw.gov.au':
            opsId = '46273';
            break
        case 'https://apibeacon.ses.nsw.gov.au':
            opsId = '515514';
            break
        case 'https://apitrainbeacon.ses.nsw.gov.au':
            opsId = '36753';
            break
        default:
            opsId = '0';
    }

    const response = await BeaconClient.operationslog.get(opsId, { host: apiHost, userId, token });
    return response.Text;
}


async function fetchTransportCamerasAsync(apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await getTransportApiKeyOpsLog(apiHost, userId, token);
        sessionStorage.setItem(sessionKey, transportApiKeyCache);
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'transport-cameras', params: { apiKey: transportApiKeyCache } }, function (response) {
            if (response.error) {
                console.error(`Update to transport-cameras failed: ${response.error} http-code:${response.httpCode}`);
                reject(response);
            } else {
                resolve({ok: true, response});
            }
        });
    });
}

// type is the background.js message type: 'transport-incidents' or 'transport-local-reports'
async function fetchTransportFeedAsync(type, apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await getTransportApiKeyOpsLog(apiHost, userId, token);
        sessionStorage.setItem(sessionKey, transportApiKeyCache);
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type, params: { apiKey: transportApiKeyCache } }, function (response) {
            if (response.error) {
                console.error(`Update to ${type} failed: ${response.error} http-code:${response.httpCode}`);
                reject(response);
            } else {
                resolve({ok: true, response});
            }
        });
    });
}

