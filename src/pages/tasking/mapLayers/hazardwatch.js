import L from "leaflet";

/**
 * NSW SES HazardWatch - Active Warnings (training feed)
 * Source: https://training.hazardwatch.gov.au/feed/v1/nswses-cap-au-active-warnings.geojson
 *
 * Feature properties used (from sample):
 * - hw_event
 * - hw_AustralianWarningSystem:WarningLevel
 * - hw_title
 * - hw_headline
 * - hw_description (HTML)
 * - hw_web
 * - hw_sent / hw_NextUpdateDate
 */

const LEVEL_STYLE = {
    Advice: {
        fillColor: "#FFD54F",
        color: "#B28704",
    },
    "Watch and Act": {
        fillColor: "#FFB74D",
        color: "#C66900",
    },
    "Emergency Warning": {
        fillColor: "#EF5350",
        color: "#B71C1C",
    },
};

function getLevelStyle(level) {
    return LEVEL_STYLE[level] || { fillColor: "#BDBDBD", color: "#616161" };
}

function slug(s) {
    return String(s || "")
        .toLowerCase()
        .trim()
        .replace(/[:/\\]/g, "-")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/**
 * You said: “switch on hw_event and hw_AustralianWarningSystem:WarningLevel
 * to work out what png logo is displayed”.
 *
 * This expects icons to exist at:
 *   /icons/hazardwatch/<event>-<warninglevel>.png
 * e.g. /icons/hazardwatch/storm-emergency-warning.png
 *
 * Adjust this path/naming to whatever you actually deploy.
 */
function iconUrlFor(event, level) {

    let event_icon;
    switch (event) {
        case "flood":
            event_icon = "flood";
            break;
        case "riverine flood":
            event_icon = "flood";
            break;
        case "storm":
            event_icon = "storm";
            break;
        case "fire":
            event_icon = "fire";
            break;
        case "tsunami":
            event_icon = "other";
            break;
        case "heatwave":
            event_icon = "heat";
            break;
        default:
            event_icon = "other";
            break;
    }
    const level_icon = level;
    const e = slug(event_icon);
    const l = slug(level_icon);

    return `/icons/hazardwatch/v2/${e}/${l}.png`;
}

function popupHtml(p) {


    const event = p?.hw_event || "Unknown Event";
    const level = p?.["hw_AustralianWarningSystem:WarningLevel"] || "Unknown Level";
    const title = p?.hw_title || p?.hw_headline;
    const desc = p?.hw_description || "";
    const web = p?.hw_web;

    const iconUrl = iconUrlFor(p?.hw_event.toLowerCase(), p?.["hw_AustralianWarningSystem:WarningLevel"]?.toLowerCase() || "unknown");

    return `
    <div class="hw-pop" style="min-width:280px;max-width:420px;max-height:300px;overflow-y:scroll;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <img src="${iconUrl}" alt="${event} ${level}" style="width:32px;height:32px;object-fit:contain;" />
        <div style="line-height:1.2;">
          <div style="font-weight:700;">${title}</div>
          <div style="font-size:12px;opacity:.8;">${event} • ${level}</div>
        </div>
      </div>

      <div class="hw-desc">
        ${desc}
      </div>

      ${web
            ? `<div style="margin-top:8px;font-size:12px;">
              <a href="${web}" target="_blank" rel="noopener noreferrer">More info</a>
            </div>`
            : ""
        }
    </div>
  `;
}

export function registerHazardWatchWarningsLayer(vm, apiHost) {
    let hazardenv

        switch (apiHost) {
        case 'https://previewbeacon.ses.nsw.gov.au':
            hazardenv = 'hazard-watch-training';
            break
        case 'https://apibeacon.ses.nsw.gov.au':
            hazardenv = 'hazard-watch';
            break
        case 'https://apitrainbeacon.ses.nsw.gov.au':
            hazardenv = 'hazard-watch-training';
            break
        default:
            hazardenv = 'hazard-watch-training';
    }


    vm.mapVM.registerPollingLayer("hazardwatch-warnings", {
        label: "HazardWatch Active Warnings",
        menuGroup: "HazardWatch",
        refreshMs: 5 * 60 * 1000, // 5 minutes in milliseconds
        visibleByDefault: localStorage.getItem("ov.hazardwatch-warnings") || false,

        fetchFn: async () => {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: hazardenv }, function (response) {
                    resolve(response);
                });
            });
        },

        drawFn: (layerGroup, data) => {
            if (!data?.features?.length) return;
            const gj = L.geoJSON(data, {
                pane: "pane-lowest",
                style: (feature) => {
                    const p = feature?.properties || {};
                    const level = p["hw_AustralianWarningSystem:WarningLevel"];
                    const st = getLevelStyle(level);
                    return {
                        weight: 2,
                        color: st.color,
                        opacity: 0.9,
                        fill: true,
                        fillColor: st.fillColor,
                        fillOpacity: 0.35,
                    };
                },
                onEachFeature: (feature, layer) => {
                    const iconUrl = iconUrlFor(feature?.properties?.hw_event.toLowerCase(), feature?.properties?.["hw_AustralianWarningSystem:WarningLevel"]?.toLowerCase() || "unknown");

                    const p = feature?.properties || {};
                    const html = popupHtml(p);

                    layer.bindPopup(html, { maxWidth: 460 });

                    let center;
                    try {
                        center = layer.getBounds().getCenter();
                    } catch (e) {
                        return;
                    }

                    const icon = L.icon({
                        iconUrl,
                        iconSize: [32, 17],
                        iconAnchor: [16, 16],
                        popupAnchor: [0, -16],
                    });

                    const marker = L.marker(center, {
                        icon,
                        pane: "pane-lowest",
                        interactive: true,
                    });

                    marker.bindPopup(html, { maxWidth: 460 });

                    layerGroup.addLayer(marker);

                    // Optional: make click feel responsive
                    layer.on("click", () => {
                        try {
                            layer.openPopup();
                        } catch (e) {
                            /* noop */
                        }
                    });
                },
            });

            layerGroup.addLayer(gj);
        },
    });
}
