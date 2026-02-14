import L from "leaflet";

export function registerPowerBoundariesGridLayer(vm, _map) {
  vm.mapVM.registerPollingLayer("powerBoundaries", {
    label: "Electrical Distribution Boundaries",
    menuGroup: "Public Service",
    refreshMs: 0, // No auto-refresh, only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.powerBoundaries`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {

      if (!data) return;

      const vectorGrid = L.vectorGrid.protobuf(
        `https://map.lighthouse-extension.com/power/tiles/{z}/{x}/{y}.pbf`,
        {
          pane: 'pane-lowest',
          vectorTileLayerStyles: {
            'ausgrid_boundary': (_props) => {
              return {
                weight: 1.2,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: '#ff7800',
                fillOpacity: 0.3
              };
            },
            'endeavour_boundary': (_props) => {
              return {
                weight: 1.2,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: '#26229cff',
                fillOpacity: 0.3
              };
            },
            'essential_boundary': (_props) => {
              return {
                weight: 1.2,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: '#74ac7aff',
                fillOpacity: 0.3
              };
            },
            'evo_boundary': (_props) => {
              return {
                weight: 1.2,
                color: '#333',
                opacity: 1,
                fill: true,
                fillColor: '#812e2eff',
                fillOpacity: 0.3
              };
            },
          },
          interactive: true
        });


      layerGroup.addLayer(vectorGrid);

      const powerLabelLayer = L.geoJSON(null, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties.name;
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
      fetch('https://map.lighthouse-extension.com/power/power_labels.geojson')
        .then(r => r.json())
        .then(data => {
          powerLabelLayer.addData(data);
          layerGroup.addLayer(powerLabelLayer)
        });


    },
  });
}