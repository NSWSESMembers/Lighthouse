/* eslint-disable @typescript-eslint/no-this-alias */
var ko = require('knockout');
var L = require('leaflet');
import 'leaflet.markercluster';

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

  // Guard flag: true while a flyToBounds animation is in progress.
  // popupclose handlers check this to avoid clearing routes/crow-flies
  // when the close was merely a side-effect of the zoom change (e.g.
  // markercluster collapsing a spider during the animation).
  self._flyingToBounds = false;

  // Layers drawer control (for basemap switching)
  self.layersDrawer = null;

  // layers
  self.assetLayer = L.layerGroup();             // not added by default – layers drawer handles visibility
  self.unmatchedAssetLayer = L.layerGroup();   // not added by default

  // --- Job marker clustering ---
  // Single cluster group for all job markers (replaces per-type layerGroups)
  self.jobClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 60,           // default; overridden by Config.afterConfigLoad
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.8,
    animate: true,
    clusterPane: 'pane-tippy-top',
    spiderLegPolylineOptions: { weight: 1.5, color: '#888', opacity: 0.5, interactive: false },
    iconCreateFunction: function (cluster) {
      const children = cluster.getAllChildMarkers();
      const count = children.length;
      const hasRescue = children.some(m => m._isRescue);
      const hasNew = children.some(m => m._isNew);

      // Size tier based on child count
      const tier = count >= 20 ? 'lg' : count >= 6 ? 'md' : 'sm';
      const cls = 'job-cluster-count cluster-' + tier
        + (hasRescue ? ' has-rescue' : '')
        + (hasNew ? ' has-new' : '');

      // --- Hexagonal ring dimensions ---
      // outerR = circumradius of outer hex, innerR = inner hex
      const outerR = tier === 'lg' ? 24 : tier === 'md' ? 21 : 18;
      const innerR = tier === 'lg' ? 19 : tier === 'md' ? 17 : 14;
      const size = outerR * 2;
      const cx = size / 2, cy = size / 2;

      // Helper: hex vertex at angle offset (flat-top: first vertex at 0°)
      var hexPt = function(cxx, cyy, r, i) {
        var a = Math.PI / 3 * i - Math.PI / 6; // flat-top hex
        return [cxx + r * Math.cos(a), cyy + r * Math.sin(a)];
      };
      var hexPoints = function(cxx, cyy, r) {
        var pts = [];
        for (var i = 0; i < 6; i++) pts.push(hexPt(cxx, cyy, r, i));
        return pts;
      };

      // tally colours
      const colorCounts = new Map();
      for (const m of children) {
        const c = m._priorityColor || '#6b7280';
        colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
      }

      let ringPaths = '';
      if (colorCounts.size === 1) {
        // single colour – full outer hex
        const col = colorCounts.keys().next().value;
        var op = hexPoints(cx, cy, outerR).map(function(p){ return p[0]+','+p[1]; }).join(' ');
        ringPaths = '<polygon points="' + op + '" fill="' + col + '"/>';
      } else {
        // multiple colours – walk outer hex perimeter, cut back along inner
        // Total outer perimeter length
        var outerPts = hexPoints(cx, cy, outerR);
        var innerPts = hexPoints(cx, cy, innerR);
        var segLen = Math.sqrt(Math.pow(outerPts[1][0]-outerPts[0][0],2) + Math.pow(outerPts[1][1]-outerPts[0][1],2));
        var totalPerim = segLen * 6;

        // Build perimeter as sequence of points with cumulative distance
        var perimPts = [];  // [{x,y,d}]
        var cumD = 0;
        for (var si = 0; si < 6; si++) {
          perimPts.push({ x: outerPts[si][0], y: outerPts[si][1], d: cumD });
          cumD += segLen;
        }
        perimPts.push({ x: outerPts[0][0], y: outerPts[0][1], d: cumD }); // close

        var innerPerimPts = [];
        var cumD2 = 0;
        var innerSegLen = Math.sqrt(Math.pow(innerPts[1][0]-innerPts[0][0],2) + Math.pow(innerPts[1][1]-innerPts[0][1],2));
        for (var si2 = 0; si2 < 6; si2++) {
          innerPerimPts.push({ x: innerPts[si2][0], y: innerPts[si2][1], d: cumD2 });
          cumD2 += innerSegLen;
        }
        innerPerimPts.push({ x: innerPts[0][0], y: innerPts[0][1], d: cumD2 });
        var totalInnerPerim = innerSegLen * 6;

        var interpPerim = function(pts, total, frac) {
          var target = frac * total;
          for (var k = 0; k < pts.length - 1; k++) {
            if (target >= pts[k].d && target <= pts[k+1].d) {
              var seg = pts[k+1].d - pts[k].d;
              var t = seg > 0 ? (target - pts[k].d) / seg : 0;
              return { x: pts[k].x + (pts[k+1].x - pts[k].x) * t, y: pts[k].y + (pts[k+1].y - pts[k].y) * t };
            }
          }
          return { x: pts[pts.length-1].x, y: pts[pts.length-1].y };
        };

        // Collect all outer & inner points within each segment's fraction range
        var perimPointsBetween = function(pts, total, f1, f2) {
          var result = [];
          for (var k = 0; k < pts.length - 1; k++) {
            var fk = pts[k].d / total;
            if (fk > f1 && fk < f2) result.push(pts[k].x + ',' + pts[k].y);
          }
          return result;
        };

        var frac = 0;
        for (var entry of colorCounts) {
          var col = entry[0], n = entry[1];
          var segFrac = n / count;
          var f1 = frac;
          var f2 = frac + segFrac;

          // outer: start point, vertices in range, end point
          var oStart = interpPerim(perimPts, totalPerim, f1);
          var oEnd   = interpPerim(perimPts, totalPerim, f2);
          var oMid   = perimPointsBetween(perimPts, totalPerim, f1, f2);

          // inner: same fractions, reversed
          var iStart = interpPerim(innerPerimPts, totalInnerPerim, f2);
          var iEnd   = interpPerim(innerPerimPts, totalInnerPerim, f1);
          var iMid   = perimPointsBetween(innerPerimPts, totalInnerPerim, f1, f2).reverse();

          var pts2 = [oStart.x+','+oStart.y]
            .concat(oMid)
            .concat([oEnd.x+','+oEnd.y])
            .concat([iStart.x+','+iStart.y])
            .concat(iMid)
            .concat([iEnd.x+','+iEnd.y]);
          ringPaths += '<polygon points="' + pts2.join(' ') + '" fill="' + col + '"/>';
          frac = f2;
        }
      }

      // Always draw inner hex fill (badge background) in SVG so it
      // perfectly matches the ring geometry.
      var innerHexPts = hexPoints(cx, cy, innerR).map(function(p){ return p[0]+','+p[1]; }).join(' ');
      ringPaths += '<polygon points="' + innerHexPts + '" fill="rgba(50,50,50,0.88)"/>';

      // Count text rendered in SVG directly so it always paints on top
      var textColor = hasRescue ? '#dc3545' : '#fff';
      var fontSize = tier === 'lg' ? 15 : tier === 'md' ? 14 : 13;
      ringPaths += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central"'
        + ' fill="' + textColor + '" font-size="' + fontSize + '" font-weight="700" font-family="system-ui,sans-serif">'
        + count + '</text>';

      const ringSvg = '<svg class="cluster-ring ' + cls + '" xmlns="http://www.w3.org/2000/svg"'
        + ' width="' + size + '" height="' + size + '"'
        + ' viewBox="0 0 ' + size + ' ' + size + '">'
        + ringPaths + '</svg>';

      // Pulse ring: an SVG hex outline that scales+fades
      var pulseSvg = '';
      if (hasNew) {
        var pulsePts = hexPoints(cx, cy, outerR).map(function(p){ return p[0]+','+p[1]; }).join(' ');
        pulseSvg = '<svg class="cluster-pulse-hex" xmlns="http://www.w3.org/2000/svg"'
          + ' width="' + size + '" height="' + size + '"'
          + ' viewBox="0 0 ' + size + ' ' + size + '">'
          + '<polygon points="' + pulsePts + '" fill="none" stroke="rgba(247,147,29,0.9)" stroke-width="2"/>'
          + '</svg>';
      }

      return L.divIcon({
        className: 'job-cluster-icon',
        html: '<div class="cluster-wrap">' + ringSvg + pulseSvg + '</div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
  });
  // Only add to map if incidents are visible (checked in main.js VM initialization)
  if (localStorage.getItem('map.incidentsVisible') !== 'false') {
    self.jobClusterGroup.addTo(self.map);
  }

  // ── Fix: prevent spider collapse when clicking a spiderfied marker ──
  // When a spiderfied child marker is clicked, Leaflet's event propagation
  // carries the 'click' up through _featureGroup → clusterGroup → map
  // BEFORE _fireDOMEvent can check _stopped.  This triggers _unspiderfyWrapper
  // on the map, which collapses the spider and immediately closes the popup
  // that just opened.  Fix: replace the default _unspiderfyWrapper with one
  // that checks whether a popup from a spiderfied child is currently open.
  (function () {
    var cg = self.jobClusterGroup;
    // Remove the default wrapper that markercluster registered in _spiderfierOnAdd
    self.map.off('click', cg._unspiderfyWrapper, cg);
    // Replace with guarded version
    cg._unspiderfyWrapper = function () {
      if (!cg._spiderfied) return;
      // If a popup belonging to a spiderfied child is currently open on the
      // map, don't collapse.  The popup's autoClose (via preclick) will close
      // it on the next outside click, and THAT click will then collapse the
      // spider normally.  We must check map.hasLayer() because map._popup is
      // never cleared — it always references the last-opened popup.
      var popup = self.map._popup;
      if (popup && self.map.hasLayer(popup) && popup._source && popup._source._spiderLeg) {
        return;   // popup is open on a spider child – leave the spider alone
      }
      cg._unspiderfy();
    };
    self.map.on('click', cg._unspiderfyWrapper, cg);
  })();

  // Plain layer for rescue markers when clustering is disabled for them
  self.rescueJobLayer = L.layerGroup().addTo(self.map);

  // Plain layer for ALL job markers when clustering is entirely disabled
  self.unclusteredJobLayer = L.layerGroup();  // not added to map by default

  // Track whether clustering is currently active
  self.clusteringEnabled = true;

  // Separate plain layer for pulse rings – not clustered
  self.jobPulseLayer = L.layerGroup().addTo(self.map);

  // id → marker lookup (flat, no per-type groups)
  self.jobMarkerIndex = new Map();

  // Legacy compat: jobMarkerGroups iterator for tryInitialFit etc.
  // Now wraps both the cluster group and the rescue layer
  self.jobMarkerGroups = {
    values: function () {
      return [
        { layerGroup: self.clusteringEnabled ? self.jobClusterGroup : self.unclusteredJobLayer, markers: self.jobMarkerIndex },
        { layerGroup: self.rescueJobLayer, markers: new Map() }
      ][Symbol.iterator]();
    }
  };

  /**
   * Move rescue markers between the cluster group and the standalone
   * rescue layer based on the clusterRescueJobs setting.
   */
  self.applyRescueClusterSetting = function (clusterThem) {
    self.jobMarkerIndex.forEach((marker) => {
      if (!marker._isRescue) return;
      if (clusterThem) {
        // move into cluster group
        if (self.rescueJobLayer.hasLayer(marker)) {
          self.rescueJobLayer.removeLayer(marker);
          self.jobClusterGroup.addLayer(marker);
        }
      } else {
        // move out of cluster group into plain layer
        if (self.jobClusterGroup.hasLayer(marker)) {
          self.jobClusterGroup.removeLayer(marker);
          self.rescueJobLayer.addLayer(marker);
        }
      }
    });
    self._syncPulseRings();
  };

  /**
   * Change the clustering aggressiveness by updating maxClusterRadius.
   * markercluster doesn't support changing this dynamically, so we
   * collect all markers, update the option, then re-add them which
   * forces the internal grids to rebuild.
   */
  self.applyClusterRadius = function (radius) {
    radius = Number(radius) || 60;
    if (!self.clusteringEnabled) {
      // Just store for when clustering is re-enabled
      self.jobClusterGroup.options.maxClusterRadius = radius;
      return;
    }
    if (self.jobClusterGroup.options.maxClusterRadius === radius) return;

    // Collect current markers from the cluster group
    const markers = [];
    self.jobClusterGroup.eachLayer(m => markers.push(m));

    // Update the option BEFORE clearLayers — clearLayers internally calls
    // _generateInitialClusters which rebuilds the DistanceGrid structures
    // using options.maxClusterRadius.  Setting after would leave stale grids.
    self.jobClusterGroup.options.maxClusterRadius = radius;
    self.jobClusterGroup.clearLayers();

    // Re-add — clearLayers rebuilt grid structures with the new radius so
    // addLayers will cluster correctly.
    if (markers.length) self.jobClusterGroup.addLayers(markers);
    self._syncPulseRings();
  };

  /**
   * Enable or disable marker clustering entirely.
   * When disabled, all markers are moved from jobClusterGroup to a plain
   * layerGroup so they display individually without clustering behaviour.
   */
  self.applyClusterEnabled = function (enabled) {
    if (enabled === self.clusteringEnabled) return;
    self.clusteringEnabled = enabled;

    const incidentsVisible = localStorage.getItem('map.incidentsVisible') !== 'false';

    if (enabled) {
      // Move all markers from the plain layer back into the cluster group
      // (rescue markers go back to rescueJobLayer or clusterGroup per the
      // clusterRescueJobs setting — we re-apply that afterwards).
      self.map.removeLayer(self.unclusteredJobLayer);
      const markers = [];
      self.unclusteredJobLayer.eachLayer(m => markers.push(m));
      self.unclusteredJobLayer.clearLayers();
      // Also grab any rescue markers sitting on the rescue layer
      self.rescueJobLayer.eachLayer(m => markers.push(m));
      self.rescueJobLayer.clearLayers();
      self.jobClusterGroup.addLayers(markers);
      if (incidentsVisible && !self.map.hasLayer(self.jobClusterGroup)) {
        self.jobClusterGroup.addTo(self.map);
      }
      // Now re-sort rescue markers per the rescue clustering setting
      const clusterRescue = !!root.config?.clusterRescueJobs?.();
      self.applyRescueClusterSetting(clusterRescue);
    } else {
      // Move all markers out of the cluster group (and rescue layer)
      // into a single plain layer.
      const markers = [];
      self.jobClusterGroup.eachLayer(m => markers.push(m));
      self.jobClusterGroup.removeLayers(markers);
      self.map.removeLayer(self.jobClusterGroup);
      self.rescueJobLayer.eachLayer(m => markers.push(m));
      self.rescueJobLayer.clearLayers();
      markers.forEach(m => self.unclusteredJobLayer.addLayer(m));
      if (incidentsVisible) {
        self.unclusteredJobLayer.addTo(self.map);
      }
    }

    self._syncPulseRings();
  };

  /**
   * Ensure markercluster internal distance grids are compatible with the
   * map's current min/max zoom constraints.
   *
   * Some overlay layers can change map zoom levels (`zoomlevelschange`).
   * markercluster keeps prebuilt grids keyed by zoom level; if map minZoom
   * drops below those keys, `addLayer` can hit an undefined grid entry and
   * throw in `_addLayer`.
   */
  self.ensureClusterGridCompatibility = function () {
    const cg = self.jobClusterGroup;
    if (!cg || !cg._map) return;

    const minZoom = Math.floor(self.map.getMinZoom());
    const expectedTopZoom = minZoom - 1;
    const disableAt = cg.options?.disableClusteringAtZoom;
    const expectedMaxZoom = Number.isFinite(disableAt)
      ? (disableAt - 1)
      : Math.ceil(self.map.getMaxZoom());

    const grids = cg._gridClusters;
    const unclustered = cg._gridUnclustered;
    const gridsMissingForMinZoom = !grids || !unclustered || !grids[minZoom] || !unclustered[minZoom];
    const maxZoomMismatch = !Number.isFinite(cg._maxZoom) || cg._maxZoom !== expectedMaxZoom;
    const topZoomMismatch = !cg._topClusterLevel || !Number.isFinite(cg._topClusterLevel._zoom)
      || cg._topClusterLevel._zoom !== expectedTopZoom;

    const safeCurrentZoom = Number.isFinite(self.map.getZoom())
      ? Math.round(self.map.getZoom())
      : (expectedTopZoom + 1);

    if (!gridsMissingForMinZoom && !maxZoomMismatch && !topZoomMismatch) {
      const minClusterZoom = (cg._topClusterLevel?._zoom ?? expectedTopZoom) + 1;
      if (!Number.isFinite(cg._zoom) || cg._zoom < minClusterZoom) {
        cg._zoom = Math.max(safeCurrentZoom, minClusterZoom);
      }
      return;
    }

    const markers = [];
    cg.eachLayer((m) => markers.push(m));

    // clearLayers() on an attached cluster group rebuilds internal grids.
    cg.clearLayers();
    const minClusterZoom = (cg._topClusterLevel?._zoom ?? expectedTopZoom) + 1;
    cg._zoom = Math.max(safeCurrentZoom, minClusterZoom);
    if (markers.length) cg.addLayers(markers);
  };

  // Reconcile cluster grids whenever any layer changes map min/max zooms.
  self.map.on('zoomlevelschange', self.ensureClusterGridCompatibility);

  self.applyPaneOrder = function (paneOrderTopToBottom) {
    if (!Array.isArray(paneOrderTopToBottom) || paneOrderTopToBottom.length === 0) return;

    // Keep big gaps so you can still place other UI panes/overlays between if needed
    const base = 300;
    const step = 100;

    paneOrderTopToBottom.forEach((paneName, idx) => {
      const pane = self.map.getPane(paneName);
      const panePlus = self.map.getPane(`${paneName}-plus`);

      if (!pane || !panePlus) return;
      // topmost gets highest zIndex
      const z = base + (step * (paneOrderTopToBottom.length - 1 - idx));
      pane.style.zIndex = String(z);
      panePlus.style.zIndex = String(z + 1);

    });
  };

  self.changeBasemap = function (basemapKey) {
    if (!self.layersDrawer || !self.layersDrawer._setBasemap) return;
    self.layersDrawer._setBasemap(basemapKey, self.map);
    self.layersDrawer._baseKey = basemapKey;
    localStorage.setItem("map.base", basemapKey);

    // Basemap definitions
    const basemapNames = [
      { name: "Esri Topographic", key: "Topographic" },
      { name: "Esri Streets", key: "Streets" },
      { name: "Esri Imagery", key: "Imagery" },
      { name: "Esri Dark", key: "DarkGray" },
      { name: "Spatial NSW", key: "nsw-vector" },
      { name: "SIX Maps Base Map", key: "nsw-base" },
      { name: "SIX Maps Imagery", key: "nsw-imagery" }
    ];

    // Update the UI label if the drawer is rendered
    const label = document.querySelector(".ld-basemap-label");
    if (label) {
      const basemapName = basemapNames.find(b => b.key === basemapKey)?.name || "Basemap";
      label.textContent = basemapName;
    }

    // Update active state in dropdown menu
    const menu = document.querySelector(".ld-basemap-menu");
    if (menu) {
      menu.querySelectorAll(".dropdown-item").forEach(item => {
        item.classList.remove("active");
      });
      // Find and activate the matching button
      const buttons = menu.querySelectorAll(".dropdown-item");
      basemapNames.forEach(({ key }, index) => {
        if (key === basemapKey && buttons[index]) {
          buttons[index].classList.add("active");
        }
      });
    }
  };


  // --- online/polling overlay layers registry ---
  // key -> { key, label, layerGroup, refreshMs, timerId, visibleByDefault, fetchFn, drawFn }
  self.onlineLayers = new Map();

  /**
   * Register a polling overlay layer that:
   *  - owns its own L.layerGroup
   *  - polls `fetchFn()` on an interval
   *  - renders into the group via `drawFn(layerGroup, data)`
   *
   * @param {string} key - unique id for this overlay
   * @param {{
   *   label: string,
   *   refreshMs?: number,
   *   visibleByDefault?: boolean,
   *   fetchFn: () => Promise<any>,
   *   drawFn: (layerGroup: L.LayerGroup, data: any) => void
   * }} opts
   */
  self.registerPollingLayer = function (key, opts) {

    if (!opts || typeof opts.fetchFn !== 'function' || typeof opts.drawFn !== 'function') {
      console.warn('registerPollingLayer requires fetchFn and drawFn');
      return null;
    }

    // If already exists, clear its timer + layer
    if (self.onlineLayers.has(key)) {
      const existing = self.onlineLayers.get(key);
      if (existing.timerId) clearInterval(existing.timerId);
      if (existing.layerGroup) existing.layerGroup.clearLayers();
    }

    const layerGroup = L.layerGroup();
    const entry = {
      key,
      label: opts.label || key,
      layerGroup,
      refreshMs: opts.refreshMs,
      visibleByDefault: opts.visibleByDefault === true,
      fetchFn: opts.fetchFn,
      drawFn: opts.drawFn,
      timerId: null,
      menuGroup: opts.menuGroup || null,
    };


    // Only fetch/draw if the layer is actually on the map
    async function refreshIfVisible() {
      if (!self.map.hasLayer(layerGroup)) return;

      try {
        const data = await entry.fetchFn();
        layerGroup.clearLayers();
        entry.drawFn(layerGroup, data);
      } catch (err) {
        console.error('Polling layer [' + key + '] refresh failed:', err);
      }
    }

    // expose for manual refresh
    entry.refresh = refreshIfVisible;

    self.onlineLayers.set(key, entry);

    // Add to map first if visibleByDefault, then do the initial fetch
    if (entry.visibleByDefault) {
      self.map.addLayer(layerGroup);
      refreshIfVisible();
    }

    // Periodic refreshes – but still only fetch if visible
    if (entry.refreshMs > 0) {
      entry.timerId = setInterval(refreshIfVisible, entry.refreshMs);
    }

    return entry;
  };


  self.refreshPollingLayer = function (key) {
    const entry = self.onlineLayers.get(key);
    if (!entry) return;

    async function run() {
      // bail if layer is not currently visible on the map
      if (!self.map.hasLayer(entry.layerGroup)) return;

      try {
        const data = await entry.fetchFn();
        entry.layerGroup.clearLayers();
        entry.drawFn(entry.layerGroup, data);
      } catch (e) {
        console.error("Manual refresh failed for layer:", key, e);
      }
    }

    run();
  };

  /**
   * Return an array of overlay definitions for the layer control.
   * Each item: { key, label, layer }
   */
  self.getOverlayDefsForControl = function () {
    const defs = [];


    // matched assets layer
    if (self.assetLayer) {
      defs.push({
        key: 'matched-assets',
        label: 'Assets Matched against Teams',
        layer: self.assetLayer,
        group: 'Visibility',
        visibleByDefault: true,
      });
    }


    // unmatched assets layer
    if (self.unmatchedAssetLayer) {
      defs.push({
        key: 'unmatched-assets',
        label: 'Assets Unmatched against Teams',
        layer: self.unmatchedAssetLayer,
        group: 'Visibility',
        visibleByDefault: false,
      });
    }


    // Online/polling overlays
    for (const [k, entry] of self.onlineLayers.entries()) {
      if (entry.layerGroup) {
        defs.push({
          key: 'online-' + k,
          label: entry.label || k,
          layer: entry.layerGroup,
          group: entry.menuGroup || null,
        });
      }
    }
    return defs;
  };

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
      vm = new JobPopupViewModel({
        job,
        api: PopupStuff,
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

  self.registerCrowFliesLine = (line) => {
    self.crowFliesLine = line;
    self.crowFliesLine.addTo(self.map);
  };

  /**
   * Draw a road-route polyline on the map (reuses the crowFliesLine slot
   * so it is cleared by the same `clearCrowFliesLine` call).
   *
   * @param {number[][]} latLngs  Array of [lat, lng] pairs.
   */
  self.drawRoutePolyline = (latLngs) => {
    self.clearCrowFliesLine();
    if (!latLngs || latLngs.length < 2) return;
    self.crowFliesLine = L.polyline(latLngs, {
      weight: 4,
      color: '#2196F3',
      opacity: 0.85,
    }).addTo(self.map);
  };

  self.drawCrowsFliesToAssetPassedTeam = (team, job) => {
    self.clearCrowFliesLine();
    if (!team || !job) return;
    // pick the team’s first asset coordinates
    let fromLat = null, fromLng = null;
    if (team.trackableAssets && team.trackableAssets().length > 0) {
      const a = team.trackableAssets()[0];
      fromLat = +ko.unwrap(a.latitude);
      fromLng = +ko.unwrap(a.longitude);
    }
    const toLat = +ko.unwrap(job.address.latitude);
    const toLng = +ko.unwrap(job.address.longitude);

    if (!(Number.isFinite(fromLat) && Number.isFinite(fromLng) &&
      Number.isFinite(toLat) && Number.isFinite(toLng))) return;

    this._polyline = L.polyline(
      [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      { weight: 4, color: 'green', dashArray: '6' }
    )
    self.registerCrowFliesLine(this._polyline);
  }

  self.drawCrowsFliesToAssetFromTasking = (tasking, asset) => {
    if (tasking.job.isFilteredIn() === false) {
      return;
    }
    if (tasking.team.isFilteredIn() === false) {
      return;
    }
    // clear any existing one first
    self.clearCrowFliesLine();
    if (!tasking) return;

    // pick the team’s first asset coordinates
    let fromLat = null, fromLng = null;
    if (tasking.team.trackableAssets && tasking.team.trackableAssets().length > 0) {
      const a = asset || tasking.team.trackableAssets()[0];
      fromLat = +ko.unwrap(a.latitude);
      fromLng = +ko.unwrap(a.longitude);
    }
    const toLat = +ko.unwrap(tasking.job.address.latitude);
    const toLng = +ko.unwrap(tasking.job.address.longitude);

    if (!(Number.isFinite(fromLat) && Number.isFinite(fromLng) &&
      Number.isFinite(toLat) && Number.isFinite(toLng))) return;

    this._polyline = L.polyline(
      [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      { weight: 4, color: 'green', dashArray: '6' }
    )
    self.registerCrowFliesLine(this._polyline);
  }

  // --- distance rings state ---
  self.jobAssetRings = [];
  self.jobAssetSpokes = [];
  self.jobAssetLabels = [];

  self.clearJobAssetBullseye = () => {
    self.jobAssetRings.forEach(l => { try { self.map.removeLayer(l); } catch (e) { /* empty */ } });
    self.jobAssetSpokes.forEach(l => { try { self.map.removeLayer(l); } catch (e) { /* empty */ } });
    self.jobAssetLabels.forEach(l => { try { self.map.removeLayer(l); } catch (e) { /* empty */ } });

    self.jobAssetRings = [];
    self.jobAssetSpokes = [];
    self.jobAssetLabels = [];
  };

  self.drawJobAssetDistanceRings = (job) => {
    // clear existing bullseye
    self.clearJobAssetBullseye();

    //close the job popup
    self.map.closePopup();

    if (!job || !job.address || typeof job.address.latitude !== 'function') return;

    const lat = job.address.latitude();
    const lng = job.address.longitude();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const center = L.latLng(lat, lng);

    const assets =
      (root.filteredTrackableAssets && root.filteredTrackableAssets()) || [];

    if (!assets || !assets.length) return;

    const withDistance = assets
      .map(a => {
        const alat = typeof a.latitude === 'function' ? a.latitude() : null;
        const alng = typeof a.longitude === 'function' ? a.longitude() : null;
        if (!Number.isFinite(alat) || !Number.isFinite(alng)) return null;

        const p = L.latLng(alat, alng);
        const d = self.map.distance(center, p); // metres
        return { asset: a, distance: d, point: p };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    if (!withDistance.length) return;

    withDistance.forEach((row) => {
      const km = row.distance / 1000;

      // --- concentric circle ---
      const circle = L.circle(center, {
        radius: row.distance,
        color: '#2563eb',
        weight: 1,
        dashArray: '4 4',
        fill: false,
        interactive: false,
      });
      circle.addTo(self.map);
      self.jobAssetRings.push(circle);

      // --- spoke line job -> asset ---
      const spoke = L.polyline([center, row.point], {
        weight: 2,
        dashArray: '4 4',
        color: '#16a34a',
        interactive: false,
      });
      spoke.addTo(self.map);
      self.jobAssetSpokes.push(spoke);

      // --- angled distance label along the line ---
      // midpoint of the line
      const mid = L.latLng(
        (center.lat + row.point.lat) / 2,
        (center.lng + row.point.lng) / 2
      );

      // angle in screen space so it matches the drawn line
      const p1 = self.map.latLngToLayerPoint(center);
      const p2 = self.map.latLngToLayerPoint(row.point);
      let angleDeg = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

      if (angleDeg > 90 || angleDeg < -90) {
        angleDeg += 180;
      }

      const html =
        '<div class="bullseye-distance-label" ' +
        'style="transform: rotate(' + angleDeg + 'deg);">' +
        km.toFixed(2) + ' km' +
        '</div>';

      const labelMarker = L.marker(mid, {
        icon: L.divIcon({
          className: 'bullseye-distance-wrapper',
          html,
          iconSize: null,
        }),
        interactive: false,
      });

      labelMarker.addTo(self.map);
      self.jobAssetLabels.push(labelMarker);
    });

    // fit to full bullseye
    const fg = L.featureGroup([
      ...self.jobAssetRings,
      ...self.jobAssetSpokes,
      ...self.jobAssetLabels,
    ]);
    const b = fg.getBounds();
    if (b.isValid()) {
      self.map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
    }
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

  // Clear overlays whenever the map is clicked
  self.map.on('click', () => {
    self.clearJobAssetBullseye();
    self.clearCrowFliesLine();
    self.clearRoutes();
  });

  const PopupStuff = {
    flyToBounds: (bounds, { opts }) => {
      self._flyingToBounds = true;
      self.map.flyToBounds(bounds, opts);
      self.map.once('moveend zoomend', () => {
        // Small delay so the popupclose that fires synchronously during
        // the same tick as the final moveend is still covered.
        setTimeout(() => { self._flyingToBounds = false; }, 100);
      });
    },

    clearRoutes: self.clearRoutes,

    registerRouteControl: (rc) => {
      self.clearRoutes();
      self.activeRouteControl = rc;
      self.activeRouteControl.addTo(self.map);
    },

    isRouteActive: (rc) => !!(rc && self.activeRouteControl === rc && rc._map),

    registerDistanceMarker: (dm) => {
      if (self.distanceMarker) {
        self.map.removeLayer(self.distanceMarker);
        self.distanceMarker = null;
      }
      self.distanceMarker = dm;
      self.distanceMarker.addTo(self.map);
    },

    // expose rings via popup API so Job/Asset popups can trigger them
    drawJobAssetDistanceRings: (job) => self.drawJobAssetDistanceRings(job),

    clearJobAssetRings: () => self.clearJobAssetRings(),

    drawCrowsFliesToAssetFromTasking: (tasking, asset) => {
      self.drawCrowsFliesToAssetFromTasking(tasking, asset);
    },

    clearCrowFliesLine: () => {
      self.clearCrowFliesLine();
    }


  };


  self.taskTeamToJobWithConfirm = (job, team) => {
    root.showConfirmTaskingModal(job, team);
  }

  self.closeAllPopups = () => {
    self.map.closePopup();
    self.clearOpen();
    self.clearRoutes();
    self.clearJobAssetBullseye();
  };

  // Pulse ring visibility management for clustering
  // When markers get clustered, hide their pulse rings.
  // When unclustered or spiderfied, show them again.
  self._syncPulseRings = function () {
    self.jobMarkerIndex.forEach((marker) => {
      if (!marker._pulseRing) return;

      // Markers on the standalone rescue layer (not in the cluster group)
      // are always individually visible – skip cluster logic for them.
      if (self.rescueJobLayer.hasLayer(marker)) {
        if (!self.jobPulseLayer.hasLayer(marker._pulseRing)) {
          self.jobPulseLayer.addLayer(marker._pulseRing);
        }
        return;
      }

      // When clustering is disabled, all markers are individually visible.
      if (!self.clusteringEnabled || self.unclusteredJobLayer.hasLayer(marker)) {
        if (!self.jobPulseLayer.hasLayer(marker._pulseRing)) {
          self.jobPulseLayer.addLayer(marker._pulseRing);
        }
        return;
      }

      let visibleParent;
      try {
        visibleParent = self.jobClusterGroup.getVisibleParent(marker);
      } catch (err) {
        // On error, hide the pulse ring to be safe
        if (self.jobPulseLayer.hasLayer(marker._pulseRing)) {
          self.jobPulseLayer.removeLayer(marker._pulseRing);
        }
        return;
      }

      if (visibleParent === marker) {
        // Marker is individually visible – show pulse ring
        if (!self.jobPulseLayer.hasLayer(marker._pulseRing)) {
          self.jobPulseLayer.addLayer(marker._pulseRing);
        }
      } else {
        // Marker is inside a cluster – hide pulse ring
        if (self.jobPulseLayer.hasLayer(marker._pulseRing)) {
          self.jobPulseLayer.removeLayer(marker._pulseRing);
        }
      }
    });
  };

  self.jobClusterGroup.on('animationend', self._syncPulseRings);
  self.jobClusterGroup.on('spiderfied', self._syncPulseRings);
  self.jobClusterGroup.on('unspiderfied', self._syncPulseRings);
  self.map.on('zoomend', self._syncPulseRings);

  self.map.on('layeradd', (ev) => {
    // find which polling layer this corresponds to
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [key, entry] of self.onlineLayers.entries()) {
      if (entry.layerGroup === ev.layer) {
        // trigger immediate fetch now that it's visible
        if (typeof entry.refresh === 'function') {
          entry.refresh();
        }
        break;
      }
    }
  });

}
