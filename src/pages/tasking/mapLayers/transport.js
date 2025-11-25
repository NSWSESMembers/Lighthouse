import BeaconClient from '../../../shared/BeaconClient.js';
import L from "leaflet";


export function registerTransportCamerasLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("transport-cameras", {
    label: "Transport NSW Cameras",
    menuGroup: "Transport NSW",
    refreshMs: 601200000, // 20 mins poll. the cameras list doesnt change and the images auto-refresh
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
        }).bindPopup(details);

        layerGroup.addLayer(marker);
      });
    },
  });
}

export function registerTransportIncidentsLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("transport-incidents", {
    label: "Transport NSW Incidents",
    menuGroup: "Transport NSW",
    refreshMs: 601200000, // 20 mins poll
    visibleByDefault: localStorage.getItem(`ov.transport-incidents`) || false,
    fetchFn: async () => {
      const t = await getToken(); // blocks here until token is ready
      const res = await fetchTransportIncidentsAsync(apiHost, params.userId, t);
      if (!res.ok) throw new Error("transport-incidents fetch failed: " + res.status);
      return res.response;
    },
    drawFn: (layerGroup, geojson) => {
      if (!geojson || !Array.isArray(geojson.features)) return;

      geojson.features.forEach((f) => {
        if (!f.geometry || f.geometry.type.toLowerCase() !== "point") return;

        let icon =
          "https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg";

        switch (f.properties.mainCategory) {
          case "Hazard":
            icon =
              "https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg";
            break;
          case "Crash":
            icon =
              "https://www.livetraffic.com/assets/icons/map/crashes/moderate-now.svg";
            break;
          case "Breakdown":
            icon =
              "https://www.livetraffic.com/assets/icons/map/breakdowns/moderate-now.svg";
            break;
          case "Traffic lights blacked out":
            icon =
              "https://www.livetraffic.com/assets/icons/map/other-hazards/tralights.svg";
            break;
          case "Changed traffic conditions":
            icon =
              "https://www.livetraffic.com/assets/icons/map/changed-traffic/moderate-now.svg";
            break;
        }

        const details = `
          <strong>Traffic Hazard: ${f.properties.displayName || "Unknown"}</strong>
          <br>
          <strong>Location:</strong> ${f.properties.roads[0]?.mainStreet || "Unknown"}
          ${f.properties.roads[0]?.locationQualifier || ""} 
          ${f.properties.roads[0]?.suburb || ""}
          <br>
          <strong>Category:</strong> ${f.properties.mainCategory || "Unknown"}
          <br>
          <strong>Advice:</strong> ${f.properties.adviceA || ""} ${f.properties.adviceB || ""} ${
            f.properties.adviceC || ""
          }
          <br>
          <strong>Details:</strong> ${
            f.properties.otherAdvice || "No additional details available."
          }
          <br>
          <strong>Speed Limit:</strong> ${f.properties.speedLimit || "N/A"} km/h
          <br>
          <strong>Start:</strong> ${
            f.properties.start ? new Date(f.properties.start).toLocaleString() : "Unknown"
          }
          <br>
          <strong>End:</strong> ${
            f.properties.hideEndDate
              ? "Ongoing"
              : f.properties.end
              ? new Date(f.properties.end).toLocaleString()
              : "Unknown"
          }
          <br>
          <strong>Managed By:</strong> ${
            f.properties.attendingGroups?.join(", ") || "Unknown"
          }
        `;

        const [lng, lat] = f.geometry.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: icon,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
          }),
        }).bindPopup(details);

        layerGroup.addLayer(marker);
      });
    },
  });
}


function getTransportApiKeyOpsLog(apiHost, userId, token, cb) {

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

    BeaconClient.operationslog.get(opsId, apiHost, userId, token, function (response) {
        let key = response.Text;
        cb(key)
    })
}


async function fetchTransportCamerasAsync(apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await new Promise((resolve) => {
            getTransportApiKeyOpsLog(apiHost, userId, token, function (key) {
                sessionStorage.setItem(sessionKey, key);
                resolve(key);
            });
        });
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

async function fetchTransportIncidentsAsync(apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await new Promise((resolve) => {
            getTransportApiKeyOpsLog('https://trainbeacon.ses.nsw.gov.au', apiHost, userId, token, function (key) {
                sessionStorage.setItem(sessionKey, key);
                resolve(key);
            });
        });
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'transport-incidents', params: { apiKey: transportApiKeyCache } }, function (response) {
            if (response.error) {
                console.error(`Update to transport-incidents failed: ${response.error} http-code:${response.httpCode}`);
                reject(response);
            } else {
                resolve({ok: true, response});
            }
        });
    });
}

