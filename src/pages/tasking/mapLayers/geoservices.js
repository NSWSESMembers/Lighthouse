import BeaconClient from "../../../shared/BeaconClient";
import L from "leaflet";


async function fetchUnitBoundariesAsync(units, apiHost, userId, token) {
  return new Promise((resolve, reject) => {
    var unitIds = units.map((unit) => {
      return new Promise((res, rej) => {
        BeaconClient.geoservices.unitBoundary(unit.id, apiHost, userId, token, function (response) {
          if (response.error) {
            console.error(`Fetch of unit boundaries failed: ${response.error} http-code:${response.httpCode}`);
            rej(response);
          } else {
            res({ data: response[0], unit });
          }
        });
      });
    });

    Promise.all(unitIds)
      .then(results => {
        resolve({ ok: true, response: results });
      })
      .catch(error => {
        reject(error);
      });
  });
}

export function registerUnitBoundaryLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("unit-boundary", {
    label: "Filtered Unit Boundaries",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // 0 refresh. they dont change. only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.unit-boundary`) || false,
    fetchFn: async () => {
      if (vm.config.incidentFilters().length) {
        const t = await getToken(); // blocks until token is ready
        const res = await fetchUnitBoundariesAsync(
          vm.config.incidentFilters(),
          apiHost,
          params.userId,
          t
        );
        if (!res.ok) throw new Error("unit-boundary fetch failed: " + res.status);
        return res.response;
      }
      return undefined;
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      data.forEach((f) => {
        if (!f || !f.data || f.data.points.length === 0) return;

        const points = f.data.points.map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
        }));
        if (points.length === 0) return;

        const polygon = L.polygon(points, {
          color: "rgb(255, 56, 238)",
          fill: false,
        });

        polygon.on("mouseover", function () {
          this.setStyle({
            fill: true,
            fillColor: "rgba(255, 56, 238, 0.3)",
            fillOpacity: 0.5,
          });

          const popup = L.popup()
            .setContent(`${f.unit?.name || "Unknown Unit"} Unit`)
            .openOn(map);

          this._popup = popup;
        });

        polygon.on("mouseout", function () {
          this.setStyle({ fill: false });
          if (this._popup) {
            map.closePopup(this._popup);
            this._popup = null;
          }
        });

        layerGroup.addLayer(polygon);
      });
    },
  });

  // if the HQ filter changes we need to redraw the boundaries
  vm.config.incidentFilters.subscribe(() => {
    const online = vm.mapVM.onlineLayers.get("unit-boundary");
    const isVisible = online && map.hasLayer(online.layerGroup);
    if (!isVisible) return;
    vm.mapVM.refreshPollingLayer("unit-boundary");
  });
}


export function registerSESZonesGridLayer(vm) {
  vm.mapVM.registerPollingLayer("sesZones", {
    label: "NSW SES Zone Boundaries",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // No auto-refresh, only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.zones`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {

      if (!data) return;

      const vectorGrid = L.vectorGrid.protobuf(
        `https://gis.lighthouse-extension.com/map/seszones/tiles/{z}/{x}/{y}.pbf`, // Replace with actual path
        {
          vectorTileLayerStyles: {
            'SESZone_JSON': (props) => {
              const code = props.ZONECODE;   // e.g. "MTZ"
              const fill = zoneFillColor(code);

              return {
                weight: 1.5,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: fill,
                fillOpacity: 0.4
              };
            }
          },
          interactive: true
        });
      layerGroup.addLayer(vectorGrid);

      const zoneLabelLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties.ZONENAME;
          return L.marker(latlng, {
            interactive: false,
            icon: L.divIcon({
              className: 'zone-label',
              html: name,
              iconSize: [0, 0]
            })
          });
        }
      });

      fetch('https://gis.lighthouse-extension.com/map/seszones/labels.geojson')
        .then(r => r.json())
        .then(data => zoneLabelLayer.addData(data));

      layerGroup.addLayer(zoneLabelLayer);
    },
  });
}

export function registerSESUnitsZonesHybridGridLayer(vm, map) {
  vm.mapVM.registerPollingLayer("sesUnitsZonesHybrid", {
    label: "Unit/Zone Boundaries Hybrid",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // No auto-refresh, only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.sesUnitsZonesHybrid`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {

      if (!data) return;
      const LABEL_ZOOM_THRESHOLD = 10;  // tweak to taste

      const vectorGrid = L.vectorGrid.protobuf(
        `https://gis.lighthouse-extension.com/map/sesunits/tiles/{z}/{x}/{y}.pbf`, // Replace with actual path
        {

          vectorTileLayerStyles: {
            'SESUnit_JSON': (props, zoom) => {
              const zoneColor = zoneFillColor(props.ZONECODE);     // shared per zone
              const unitColor = colorByUnitCode(props.UNITCODE);   // unique per unit

              const useUnitColors = zoom >= LABEL_ZOOM_THRESHOLD;
              const fill = useUnitColors ? unitColor : zoneColor;

              return {
                weight: useUnitColors ? 1 : 1.2,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: fill,
                fillOpacity: 0.3
              };
            }
          },
          interactive: true
        });


      layerGroup.addLayer(vectorGrid);

      const zoneLabelLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties.ZONENAME;
          return L.marker(latlng, {
            interactive: false,
            icon: L.divIcon({
              className: 'zone-label',
              html: name,
              iconSize: [0, 0]
            })
          });
        }
      });

      const unitLabelLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties.UNITNAME || feature.properties.UNITCODE;

          return L.marker(latlng, {
            interactive: false,
            icon: L.divIcon({
              className: 'unit-label',
              html: name,
              iconSize: [0, 0]
            })
          });
        }
      });


      // Load unit labels
      fetch('https://gis.lighthouse-extension.com/map/sesunits/labels.geojson')
        .then(r => r.json())
        .then(data => {
          unitLabelLayer.addData(data);
          updateLabelVisibility(LABEL_ZOOM_THRESHOLD);
        });

      // Load zone labels
      fetch('https://gis.lighthouse-extension.com/map/seszones/labels.geojson')
        .then(r => r.json())
        .then(data => {
          zoneLabelLayer.addData(data);
          updateLabelVisibility(LABEL_ZOOM_THRESHOLD);
        });

      function updateLabelVisibility(thres) {
        const z = map.getZoom();

        if (z >= thres - 1) {
          // Zoomed IN → show UNIT labels, hide ZONE labels
          if (!layerGroup.hasLayer(unitLabelLayer)) layerGroup.addLayer(unitLabelLayer);
          if (layerGroup.hasLayer(zoneLabelLayer)) layerGroup.removeLayer(zoneLabelLayer);
        } else {
          // Zoomed OUT → show ZONE labels, hide UNIT labels
          if (!layerGroup.hasLayer(zoneLabelLayer)) layerGroup.addLayer(zoneLabelLayer);
          if (layerGroup.hasLayer(unitLabelLayer)) layerGroup.removeLayer(unitLabelLayer);
        }
      }

      map.on('zoomend', () => updateLabelVisibility(LABEL_ZOOM_THRESHOLD));

    },
  });
}

function zoneFillColor(code) {
  switch (code) {
    case 'MTZ': return '#ff9800'; // Metro
    case 'NEZ': return '#00bcd4'; // North Eastern
    case 'NHZ': return '#2196f3'; // Northern
    case 'NWZ': return '#3f51b5'; // North Western
    case 'SEZ': return '#4caf50'; // South Eastern
    case 'SHZ': return '#9c27b0'; // Southern
    case 'WTZ': return '#f44336'; // Western
    default: return '#9e9e9e'; // fallback
  }
}


function colorByUnitCode(code) {
  if (!code) return '#999';

  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }

  // Spread around 360° hue wheel
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}




export function registerSESUnitLocationsLayer(vm) {
  vm.mapVM.registerPollingLayer("sesUnitLocations", {
    label: "SES Unit Locations",
    menuGroup: "Lighthouse Geoservices",
    refreshMs: 0, // No auto-refresh, only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.unit-locations`) || false,
    fetchFn: async () => {
      const response = await fetch('/resources/SES_HQs.geojson');
      if (!response.ok) throw new Error("Failed to fetch SES Unit Locations");
      return await response.json();
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      const unitLayer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          const name = `${feature.properties.HQNAME}` || "Unknown Unit";
          const marker = L.marker(latlng, {
            icon: L.icon({
              iconUrl: '/icons/ses_small.png',
              iconSize: [16, 16], // Adjust size as needed
              iconAnchor: [8, 16], // Anchor point of the icon
              popupAnchor: [0, -16] // Point from which the popup opens relative to the iconAnchor
            })
          }).bindPopup(`<strong>Loading ${name}...</strong>`);

          marker.on('popupopen', async () => {
            try {
              const details = await vm.fetchHQDetails(feature.properties.HQNAME);
              console.log("Fetched HQ details for popup:", details);
              const popupContent = `
            <div style="background-color: #333; color: #fff; padding: 5px; text-align: center; font-weight: bold; width: 300px;">
              ${name}
            </div>
            <div style="display: flex; justify-content: center;">
            <strong>${details.isMonitoring ? "Unit Is Monitoring" : "Unit Is Not Monitoring"}</strong>
            </div>
            <div style="padding: 5px;">
              
              <div style="display: flex; justify-content: space-between;">
              <p><strong>Active Teams:</strong> ${details.currentTeamCount}</p>
              <p><strong>Active Incidents:</strong> ${details.currentJobCount}</p>
              </div>
              <p><strong>SRB Accreditations:</strong></p>
              <ul>
              ${details.acred.map(acred => `<li>${acred}</li>`).join('')}
              </ul>
              <p><strong>Contacts:</strong></p>
              <table border="1" style="width: 300px; border-collapse: collapse; table-layout: fixed;">
              <thead>
              <tr>
              <th style="width: 40%;">Description</th>
              <th style="width: 60%;">Detail</th>
              </tr>
              </thead>
              <tbody>
              ${details.contacts.map(contact => `
              <tr>
              <td>${contact.Description}</td>
              <td>${contact.Detail}</td>
              </tr>
              `).join('')}
              </tbody>
              </table>
            </div>
            `;
              marker.getPopup().setContent(popupContent);
            } catch (error) {
              marker.getPopup().setContent(`<strong>${name}</strong><br><em>Failed to load details</em>`);
              console.error("Error fetching HQ details:", error);
            }
          });

          return marker;
        }
      });

      layerGroup.addLayer(unitLayer);
    },
  });
}