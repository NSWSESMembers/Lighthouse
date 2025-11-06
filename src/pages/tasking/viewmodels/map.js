/* eslint-disable @typescript-eslint/no-this-alias */
var ko = require('knockout');
var L = require('leaflet');


export function MapVM(Lmap, root) {
  const self = this;
  self.map = Lmap;

  // what popup is open
  self.openPopup = ko.observable(null); // { kind: 'job'|'asset', id, ref }

  // active route/overlays
  self.activeRouteControl = null;
  self.distanceMarker = null;
  self.crowFliesLine = null;

  // layers
  self.vehicleLayer = L.layerGroup().addTo(Lmap);
  self.jobMarkerGroups = new Map();

  // helpers
  self.setOpen = (kind, ref) => self.openPopup({ kind, id: ref.id?.(), ref });
  self.clearOpen = () => self.openPopup(null);

  self.clearRoutes = () => {
    console.log('clearing routes');

    if (self.activeRouteControl) { self.map.removeControl(self.activeRouteControl); self.activeRouteControl = null; }
    if (self.distanceMarker) { self.map.removeLayer(self.distanceMarker); self.distanceMarker = null; }

  };

  self.closeAllPopups = () => { self.map.closePopup(); self.clearOpen(); self.clearRoutes(); };

  self.ensureJobGroup = (typeName) => {
    if (!self.jobMarkerGroups.has(typeName)) {
      const group = L.layerGroup().addTo(self.map);
      self.jobMarkerGroups.set(typeName, { layerGroup: group, markers: new Map() });
    }
    return self.jobMarkerGroups.get(typeName);
  };
}