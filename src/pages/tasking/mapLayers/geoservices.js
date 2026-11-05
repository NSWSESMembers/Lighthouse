import BeaconClient from "../../../shared/BeaconClient";
import { unitColorMap } from "../utils/unitColorMap";
import L from "leaflet";


async function fetchUnitBoundariesAsync(units, apiHost, userId, token) {
  const results = await Promise.all(
    units.map(async (unit) => {
      const response = await BeaconClient.geoservices.unitBoundary(unit.id, { host: apiHost, userId, token });
      return { data: response && response[0], unit };
    })
  );
  return { ok: true, response: results };
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
          pane: 'pane-lowest',
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
        `https://map.lighthouse-extension.com/seszones/tiles/{z}/{x}/{y}.pbf`, // Replace with actual path
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
            pane: 'pane-middle',
            icon: L.divIcon({
              className: 'zone-label',
              html: name,
              iconSize: [0, 0]
            })
          });
        }
      });

      fetch('https://map.lighthouse-extension.com/seszones/labels.geojson')
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
      const LABEL_ZOOM_THRESHOLD = 9;  // tweak to taste

      const vectorGrid = L.vectorGrid.protobuf(
        `https://map.lighthouse-extension.com/sesunits/tiles/{z}/{x}/{y}.pbf`, // Replace with actual path
        {
          pane: 'pane-lowest',
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
            pane: 'pane-middle-plus',
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
            pane: 'pane-middle-plus',
            icon: L.divIcon({
              className: 'unit-label',
              html: name,
              iconSize: [0, 0]
            })
          });
        }
      });


      // Load unit labels
      fetch('https://map.lighthouse-extension.com/sesunits/labels.geojson')
        .then(r => r.json())
        .then(data => {
          unitLabelLayer.addData(data);
          updateLabelVisibility(LABEL_ZOOM_THRESHOLD);
        });

      // Load zone labels
      fetch('https://map.lighthouse-extension.com/seszones/labels.geojson')
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

      // drawFn runs again each time the layer is switched on: drop the
      // previous draw's handler, which still holds that draw's label layers.
      if (layerGroup._labelZoomHandler) map.off('zoomend', layerGroup._labelZoomHandler);
      layerGroup._labelZoomHandler = () => updateLabelVisibility(LABEL_ZOOM_THRESHOLD);
      map.on('zoomend', layerGroup._labelZoomHandler);

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
  return unitColorMap[code] || '#999';
}




function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Escape, then allow line breaks after @ and . so a long email wraps between
// its parts rather than mid-word.
function softBreaks(s) {
  return escapeHtml(s).replace(/([@.])/g, '$1<wbr>');
}

// Beacon HeadquartersStatusType ids: 1 monitoring, 2 not monitoring, 3 unavailable.
const HQ_STATUS_CLASS = { 1: 'lhq-status--monitoring', 2: 'lhq-status--not-monitoring', 3: 'lhq-status--unavailable' };

function hqPopupHeader(name, statusHtml = '') {
  return `<div class="lhq-popup__header"><span class="lhq-popup__name">${escapeHtml(name)}</span>${statusHtml}</div>`;
}

function hqPopupLoadingHtml(name) {
  return `<div class="lhq-popup">${hqPopupHeader(name)}
    <div class="lhq-popup__muted"><i class="fa fa-spinner fa-spin"></i> Loading unit details…</div></div>`;
}

function hqPopupErrorHtml(name) {
  return `<div class="lhq-popup">${hqPopupHeader(name)}
    <div class="lhq-popup__muted"><i class="fa fa-exclamation-triangle"></i> Couldn't load unit details.</div></div>`;
}

function hqPopupHtml(name, details) {
  const status = details.HeadquartersStatus
    ? `<span class="lhq-status ${HQ_STATUS_CLASS[details.HeadquartersStatusId] || ''}">${escapeHtml(details.HeadquartersStatus)}</span>`
    : '';
  const acred = details.acred || [];
  const contacts = details.contacts || [];
  return `
    <div class="lhq-popup">
      ${hqPopupHeader(name, status)}
      <div class="lhq-popup__stats">
        <div class="lhq-popup__stat"><span class="lhq-popup__stat-value">${escapeHtml(details.currentTeamCount)}</span><span class="lhq-popup__stat-label">Active teams</span></div>
        <div class="lhq-popup__stat"><span class="lhq-popup__stat-value">${escapeHtml(details.currentJobCount)}</span><span class="lhq-popup__stat-label">Active incidents</span></div>
      </div>
      <div class="lhq-popup__section">SRB accreditations</div>
      ${acred.length
        ? `<div class="lhq-popup__tags">${acred.map((a) => `<span class="lhq-popup__tag">${escapeHtml(a)}</span>`).join('')}</div>`
        : '<div class="lhq-popup__muted">None</div>'}
      <div class="lhq-popup__section">Contacts</div>
      ${contacts.length
        ? `<dl class="lhq-popup__contacts">${contacts.map((c) => `<div><dt>${escapeHtml(c.Description)}</dt><dd>${softBreaks(c.Detail)}</dd></div>`).join('')}</dl>`
        : '<div class="lhq-popup__muted">None</div>'}
    </div>`;
}

export function registerSESUnitLocationsLayer(vm) {
  vm.mapVM.registerPollingLayer("sesUnitLocations", {
    label: "SES Units",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // No auto-refresh, only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.unit-locations`) || false,
    fetchFn: async () => {
      const response = await fetch('/resources/SES_HQs.geojson');
      if (!response.ok) throw new Error("Failed to fetch SES Units");
      return await response.json();
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      const unitLayer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          const name = `${feature.properties.HQNAME}` || "Unknown Unit";
          const marker = L.marker(latlng, {
            pane: 'pane-middle',
            icon: L.icon({
              iconUrl: '/icons/ses_small.png',
              iconSize: [16, 16], // Adjust size as needed
              iconAnchor: [8, 16], // Anchor point of the icon
              popupAnchor: [0, -16] // Point from which the popup opens relative to the iconAnchor
            })
          }).bindPopup(hqPopupLoadingHtml(name), { pane: "pane-popup-top", maxWidth: 320 });

          marker.on('popupopen', async () => {
            try {
              const details = await vm.fetchHQDetails({ code: feature.properties.UNIT_CODE, name: feature.properties.HQNAME });
              const popupContent = hqPopupHtml(name, details);
              marker.getPopup().setContent(popupContent);
            } catch (error) {
              marker.getPopup().setContent(hqPopupErrorHtml(name));
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