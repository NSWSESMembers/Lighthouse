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
      console.log(vm);
      vm.dispose();
      self.assetPopups.delete(asset.id());
    }
  };

  self.makeJobPopupVM = (job) => {
    let vm = self.jobPopups.get(job.id());
    if (!vm) {
      vm = new JobPopupViewModel({
        job,
        map: self.map,
        api: PopupStuff,
        filteredTeams: root.filteredTeams,
      });
      self.jobPopups.set(job.id(), vm);
    }
    return vm;
  };

  self.destroyJobPopupVM = (job) => {
    const vm = self.jobPopups.get(job.id());
    if (vm) {
      vm.dispose();
      self.jobPopups.delete(job.id());
    }
  };

  self.clearRoutes = () => {
    console.log('clearing routes');
    if (self.activeRouteControl) {
      self.map.removeControl(self.activeRouteControl);
      self.activeRouteControl = null;
    }
    if (self.distanceMarker) {
      self.map.removeLayer(self.distanceMarker);
      self.distanceMarker = null;
    }
  };

  self.clearCrowFliesLine = () => {
    if (self.crowFliesLine) {
      self.map.removeLayer(self.crowFliesLine);
      self.crowFliesLine = null;
    }
  };

  // --- distance rings state ---
  self.jobAssetRings = [];

  self.clearJobAssetRings = () => {
    if (!self.jobAssetRings || !self.jobAssetRings.length) return;
    self.jobAssetRings.forEach((layer) => {
      try {
        self.map.removeLayer(layer);
      } catch (_e) {
        // ignore
      }
    });
    self.jobAssetRings = [];
  };

  self.drawJobAssetDistanceRings = (job) => {
    // clear any existing rings first
    self.clearJobAssetRings();

    if (!job || !job.address || typeof job.address.latitude !== 'function') return;

    const lat = job.address.latitude();
    const lng = job.address.longitude();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const center = L.latLng(lat, lng);

    // Prefer filteredTrackableAssets, fall back to all trackableAssets
    const assets =
      (root.filteredTrackableAssets && root.filteredTrackableAssets()) ||
      (root.trackableAssets && root.trackableAssets()) ||
      [];

    if (!assets || !assets.length) return;

    // Build distance list
    const withDistance = assets
      .map((a) => {
        const alat = typeof a.latitude === 'function' ? a.latitude() : null;
        const alng = typeof a.longitude === 'function' ? a.longitude() : null;
        if (!Number.isFinite(alat) || !Number.isFinite(alng)) return null;

        const p = L.latLng(alat, alng);
        const d = self.map.distance(center, p); // metres
        return { asset: a, distance: d };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    if (!withDistance.length) return;

    withDistance.forEach((row, idx) => {
      const circle = L.circle(center, {
        radius: row.distance, // metres
        color: '#2563eb',
        weight: 1,
        dashArray: '4 4',
        fill: false,
        interactive: false,
      });

      const km = row.distance / 1000;
      const aName =
        row.asset && typeof row.asset.name === 'function'
          ? row.asset.name()
          : 'Asset';

      const label = `${idx + 1}. ${aName} — ${km.toFixed(2)} km`;

      circle.bindTooltip(label, {
        permanent: false,
        sticky: true,
      });

      circle.addTo(self.map);
      self.jobAssetRings.push(circle);
      self.fitRingsBounds();
    });
  };

  self.fitRingsBounds = () => {
    if (!self.jobAssetRings || self.jobAssetRings.length === 0) return;

    const fg = L.featureGroup(self.jobAssetRings);
    const b = fg.getBounds();

    if (b.isValid()) {
      self.map.fitBounds(b, {
        padding: [40, 40],
        maxZoom: 15
      });
    }
  };

  // Clear rings whenever the map is clicked
  self.map.on('click', () => {
    self.clearJobAssetRings();
  });

  const PopupStuff = {
    flyToBounds: (bounds, { opts }) => {
      self.map.flyToBounds(bounds, opts);
    },

    clearRoutes: self.clearRoutes,

    registerRouteControl: (rc) => {
      self.clearRoutes();
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

    clearCrowFliesLine: self.clearCrowFliesLine,

    // expose rings via popup API so Job/Asset popups can trigger them
    drawJobAssetDistanceRings: (job) => self.drawJobAssetDistanceRings(job),
    clearJobAssetRings: () => self.clearJobAssetRings(),

    taskTeamToJobWithConfirm: (job, team) => {
      root.showConfirmTaskingModal(job, team);
    },
  };

  self.closeAllPopups = () => {
    self.map.closePopup();
    self.clearOpen();
    self.clearRoutes();
    self.clearJobAssetRings();
  };

  self.ensureJobGroup = (typeName) => {
    if (!self.jobMarkerGroups.has(typeName)) {
      const group = L.layerGroup().addTo(self.map);
      self.jobMarkerGroups.set(typeName, { layerGroup: group, markers: new Map() });
    }
    return self.jobMarkerGroups.get(typeName);
  };
}
