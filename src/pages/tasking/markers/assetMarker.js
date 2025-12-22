var L = require('leaflet');
import { makePopupNode, bindKoToPopup, unbindKoFromPopup, deferPopupUpdate } from '../utils/popup_dom_utils.js';

import { buildAssetPopupKO } from '../components/asset_popup.js';
import { buildIcon } from '../components/asset_icon.js';



/**
 * Smoothly move (or just set) the marker to a position.
 */
function moveMarker(marker, lat, lng, { duration = 700, fps = 60 } = {}) {
    if (!marker) return;
    const to = L.latLng(lat, lng);
    const from = marker.getLatLng?.() || to;
    const dist = from.distanceTo ? from.distanceTo(to) : 0;

    // small move -> no animation
    if (dist < 1) {
        marker.setLatLng(to);
        return;
    }

    // cancel previous animation
    if (marker._moveAnimCancel) marker._moveAnimCancel();

    const frames = Math.max(1, Math.round((duration / 1000) * fps));
    let f = 0;
    let rafId = null;

    const step = () => {
        f += 1;
        const t = f / frames;
        const latS = from.lat + (to.lat - from.lat) * t;
        const lngS = from.lng + (to.lng - from.lng) * t;
        marker.setLatLng([latS, lngS]);
        if (f < frames) rafId = requestAnimationFrame(step);
        else marker._moveAnimCancel = null;
    };

    marker._moveAnimCancel = () => { if (rafId) cancelAnimationFrame(rafId); };
    rafId = requestAnimationFrame(step);
}

/**
 * Create (if missing) and attach per-asset subscriptions that keep the
 * marker updated without walking the whole asset list.
 */
export function attachAssetMarker(ko, map, viewModel, asset) {
    if (!asset) return;

    // Ensure layer exists
    const layer = viewModel.mapVM.assetLayer;

    // Marker create (once)
    const lat = +asset.latitude?.();
    const lng = +asset.longitude?.();
    if (Number.isFinite(lat) && Number.isFinite(lng) && !asset.marker) {
        const icon = buildIcon(asset, 'matched');
        const m = L.marker([lat, lng], { icon, pane: 'pane-top' });
        m._assetId = asset.id?.();
        const html = buildAssetPopupKO();
        const contentEl = makePopupNode(html, 'veh-pop-root'); // stable node
        const popup = L.popup({
            minWidth: 360,
            maxWidth: 360,
            maxHeight: 360,
            autoPan: true,
            autoPanPadding: [16, 16],
        }).setContent(contentEl);

        
        m.bindPopup(popup)
        m.addTo(layer);
        asset.marker = m;

        // Ask MapVM to create the AssetPopupViewModel for this asset:
        const popupVm = viewModel.mapVM.makeAssetPopupVM(asset);
        bindPopupWithKO(ko, asset.marker, viewModel, asset, popupVm);

        // Track what's open
        asset.marker.on('popupopen', () => {
            viewModel.mapVM.setOpen('asset', asset);
        });
    }

    // Already wired? Done.
    if (asset._markerSubs && asset._markerSubs.length) return;

    // Per-asset subscriptions (store so we can dispose later)
    const subs = [];

    // Position changes -> smooth move
    subs.push(asset.latitude.subscribe(v => {
        const latNow = +v, lngNow = +asset.longitude();
        if (asset.marker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
            moveMarker(asset.marker, latNow, lngNow);
        }
    }));
    subs.push(asset.longitude.subscribe(v => {
        const latNow = +asset.latitude(), lngNow = +v;
        if (asset.marker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
            moveMarker(asset.marker, latNow, lngNow);
        }
    }));



    asset._markerSubs = subs;

}



/**
 * Detach subscriptions and remove the marker for an asset.
 */
export function detachAssetMarker(ko, map, viewModel, asset) {
    if (!asset) return;
    if (asset._markerSubs) {
        asset._markerSubs.forEach(s => s.dispose?.());
        asset._markerSubs = [];
    }
    if (asset.marker) {
        viewModel.mapVM.assetLayer.removeLayer(asset.marker);
        asset.marker = null;
    }
    viewModel.mapVM.destroyAssetPopupVM(asset);
}

export function attachUnmatchedAssetMarker(ko, map, viewModel, asset) {
  if (!asset) return;

  const layer = viewModel.mapVM.unmatchedAssetLayer;

  const lat = +asset.latitude?.();
  const lng = +asset.longitude?.();

  if (Number.isFinite(lat) && Number.isFinite(lng) && !asset.unmatchedMarker) {
    const icon = buildIcon(asset, 'unmatched');
    const m = L.marker([lat, lng], { icon, pane: 'pane-middle' });
    m._assetId = asset.id?.();

    const html = buildAssetPopupKO();
    const contentEl = makePopupNode(html, 'veh-pop-root');
    const popup = L.popup({
      minWidth: 360,
      maxWidth: 360,
      maxHeight: 360,
      autoPan: true,
      autoPanPadding: [16, 16],
    }).setContent(contentEl);

    m.bindPopup(popup);
    m.addTo(layer);
    asset.unmatchedMarker = m;

    const popupVm = viewModel.mapVM.makeAssetPopupVM(asset);
    bindPopupWithKO(ko, asset.unmatchedMarker, viewModel, asset, popupVm);

    asset.unmatchedMarker.on('popupopen', () => {
      viewModel.mapVM.setOpen('asset', asset);
    });
  }

  // subs (separate from asset._markerSubs)
  if (asset._unmatchedMarkerSubs && asset._unmatchedMarkerSubs.length) return;

  const subs = [];
  subs.push(asset.latitude.subscribe(v => {
    const latNow = +v, lngNow = +asset.longitude();
    if (asset.unmatchedMarker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
      moveMarker(asset.unmatchedMarker, latNow, lngNow);
    }
  }));
  subs.push(asset.longitude.subscribe(v => {
    const latNow = +asset.latitude(), lngNow = +v;
    if (asset.unmatchedMarker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
      moveMarker(asset.unmatchedMarker, latNow, lngNow);
    }
  }));

  asset._unmatchedMarkerSubs = subs;
}

export function detachUnmatchedAssetMarker(ko, map, viewModel, asset) {
  if (!asset) return;

  if (asset._unmatchedMarkerSubs) {
    asset._unmatchedMarkerSubs.forEach(s => s.dispose?.());
    asset._unmatchedMarkerSubs = [];
  }
  if (asset.unmatchedMarker) {
    viewModel.mapVM.unmatchedAssetLayer.removeLayer(asset.unmatchedMarker);
    asset.unmatchedMarker = null;
  }

  // keep popup VM (shared) alive; OR destroy if you prefer symmetry:
  // viewModel.mapVM.destroyAssetPopupVM(asset);
}



function bindPopupWithKO(ko, marker, vm, asset, popupVm) {
    const openHandler = (e) => {
        const el = e.popup.getContent(); // our stable node
        vm.mapVM.setOpen?.('asset', asset);
        bindKoToPopup(ko, popupVm, el);
        // If no team row has focus, open the first team's popup. stops fucky UI jumps when theres multiple teams bound to one asset
        // where it would jump to a different row when you cycle the assets
        if (!asset.matchingTeamsInView()?.some(team => team.rowHasFocus && team.rowHasFocus())) {
          asset.matchingTeamsInView()?.length !== 0 && asset.matchingTeamsInView()[0].onPopupOpen();
        }
        popupVm.updatePopup?.();
        deferPopupUpdate(e.popup);
    };
    const closeHandler = (e) => {
        const el = e.popup?.getContent();
        vm.mapVM.clearCrowFliesLine();
        vm.mapVM.clearRoutes?.();
        vm.mapVM.clearOpen?.();
        unbindKoFromPopup(ko, el);
        asset.matchingTeamsInView()?.length !==0 && asset.matchingTeamsInView()[0].onPopupClose()
    };
    marker._koWired = true;
    marker.on('popupopen', openHandler);
    marker.on('popupclose', closeHandler);
    marker.on('remove', closeHandler); // safety
}