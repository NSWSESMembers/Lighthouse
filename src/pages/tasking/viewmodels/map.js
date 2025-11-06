/* eslint-disable @typescript-eslint/no-this-alias */
var ko = require('knockout');
var L = require('leaflet');

import { AssetPopupViewModel } from './AssetPopUp';
import { JobPopupViewModel } from './JobPopUp';

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




  self.assetPopups = new Map();
  self.jobPopups = new Map();

  self.makeAssetPopupVM = (asset) => {
    let vm = self.assetPopups.get(asset.id());
    if (!vm) {
      vm = new AssetPopupViewModel({ asset, map: self.map, api: PopupStuff });
      self.assetPopups.set(asset.id(), vm);
    }
    return vm;
  };

  self.destroyAssetPopupVM = (asset) => {
    const vm = self.assetPopups.get(asset.id());
    if (vm) {
      vm.dispose();
      self.assetPopups.delete(asset.id());
    }
  };

  self.makeJobPopupVM = (job) => {
    let vm = self.jobPopups.get(job.id());
    if (!vm) {
      vm = new JobPopupViewModel({ job, map: self.map, api: PopupStuff, filteredTeams: root.filteredTeams });
      self.jobPopups.set(job.id(), vm);
    }
    return vm;
  }

  self.destroyJobPopupVM = (job) => {
    const vm = self.jobPopups.get(job.id());
    if (vm) {
      vm.dispose();
      self.jobPopups.delete(job.id());
    }
  }

  self.clearRoutes = () => {
    console.log('clearing routes');
    if (self.activeRouteControl) { self.map.removeControl(self.activeRouteControl); self.activeRouteControl = null; }
    if (self.distanceMarker) { self.map.removeLayer(self.distanceMarker); self.distanceMarker = null; }
  }

  const PopupStuff = {

    flyToBounds: (bounds, { opts }) => {
      self.map.flyToBounds(bounds, opts);
    },

    clearRoutes: self.clearRoutes,

    registerRouteControl: (rc) => {
      self.activeRouteControl = rc;
      self.activeRouteControl.addTo(self.map);
    },

    registerDistanceMarker: (dm) => {
      self.distanceMarker = dm;
      self.distanceMarker.addTo(self.map);
    },

    registerCrowFliesLine: (line) => {
      self.crowFliesLine = line;
      self.crowFliesLine.addTo(self.map);
    },

    clearCrowFliesLine: () => {
      if (self.crowFliesLine) { self.map.removeLayer(self.crowFliesLine); self.crowFliesLine = null; }
    },

  }

  self.closeAllPopups = () => { self.map.closePopup(); self.clearOpen(); self.clearRoutes(); };

  self.ensureJobGroup = (typeName) => {
    if (!self.jobMarkerGroups.has(typeName)) {
      const group = L.layerGroup().addTo(self.map);
      self.jobMarkerGroups.set(typeName, { layerGroup: group, markers: new Map() });
    }
    return self.jobMarkerGroups.get(typeName);
  };


}