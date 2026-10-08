var L = require('leaflet');
import { makePopupNode, bindKoToPopup, unbindKoFromPopup, deferPopupUpdate } from '../utils/popup_dom_utils.js';

import { buildAssetPopupKO } from '../components/asset_popup.js';
import { buildIcon } from '../components/asset_icon.js';
import { restorePinPlacement } from './assetPinLayout.js';

function refreshAssetMarkerIcons(asset) {
  //check the html of a new icon vs the current icon to avoid unnecessary updates

  // matched marker
  if (asset.marker) {
    const newIcon = buildIcon(asset, 'matched');
    if (asset.marker.options.icon.options.html !== newIcon.options.html) {
      asset.marker.setIcon(newIcon);
      restorePinPlacement(asset.marker);
    }
  }

  // unmatched marker
  if (asset.unmatchedMarker) {
    const newIcon = buildIcon(asset, 'unmatched');
    if (asset.unmatchedMarker.options.icon.options.html !== newIcon.options.html) {
      asset.unmatchedMarker.setIcon(newIcon);
      restorePinPlacement(asset.unmatchedMarker);
    }
  }
}


/**
 * While a marker's popup is open (clicked, or zoomed to from a team or the
 * asset library), draw it above its neighbours with the hover highlight, so
 * it's obvious which pin the popup belongs to.
 */
function focusWhilePopupOpen(marker) {
  const set = (on) => {
    marker.setZIndexOffset(on ? 1000 : 0);
    marker.getElement()?.querySelector('.asset-pin')?.classList.toggle('is-focused', on);
  };
  marker.on('popupopen', () => set(true));
  marker.on('popupclose', () => set(false));
}

/**
 * Smoothly move (or just set) the marker to a position. onMove runs after
 * every step, including the last. marker._pinMoving is true while it's on
 * the way, so the pin layout lets it fit in around pins that aren't moving.
 */
function moveMarker(marker, lat, lng, { duration = 700, fps = 60, onMove } = {}) {
  if (!marker) return;
  const to = L.latLng(lat, lng);
  const from = marker.getLatLng?.() || to;
  const dist = from.distanceTo ? from.distanceTo(to) : 0;

  // small move -> no animation
  if (dist < 1) {
    marker.setLatLng(to);
    onMove?.();
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
    if (f >= frames) {
      marker._moveAnimCancel = null;
      marker._pinMoving = false;
    }
    onMove?.();
    if (f < frames) rafId = requestAnimationFrame(step);
  };

  marker._pinMoving = true;
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
    // riseOnHover: a hovered pin comes to the front, with its leader line.
    const m = L.marker([lat, lng], { icon, pane: 'pane-top', riseOnHover: true });
    m._assetId = asset.id?.();
    const html = buildAssetPopupKO();
    const contentEl = makePopupNode(html, 'veh-pop-root'); // stable node
    const popup = L.popup({
      minWidth: 360,
      maxWidth: 360,
      maxHeight: 360,
      // Leaflet auto-pans synchronously the instant the popup opens --
      // before its KO-unbound (pristine, near-empty) content is replaced
      // with the real thing in bindPopupWithKO's openHandler. Starting
      // with autoPan off and switching it on there, once real content is
      // bound, means autoPan only ever runs once per open, against real
      // content, instead of once against a placeholder and again a
      // moment later against the real (usually much bigger) popup.
      // autoPanPadding comes from Popup.mergeOptions in
      // utils/popupAutoPan.js, which keeps padding in sync with the map's
      // corner controls (alerts banners, zoom tools, legend, ...).
      autoPan: false,
      pane: 'pane-popup-top',
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
    focusWhilePopupOpen(asset.marker);
  }

  // Already wired? Done.
  if (asset._markerSubs && asset._markerSubs.length) return;

  // Per-asset subscriptions (store so we can dispose later)
  const subs = [];

  // Position changes -> smooth move
  subs.push(asset.latLng.subscribe(v => {
    const latNow = +v?.lat, lngNow = +v?.lng;
    if (asset.marker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
      moveMarker(asset.marker, latNow, lngNow, {
        // Re-lay out pins on the way, so a pin straightens up as soon as it
        // leaves a crowd rather than when it arrives (schedule() coalesces
        // to one layout per frame).
        onMove: viewModel.mapVM.assetPinLayout?.schedule,
      });
    }
  }));

  // lastSeen updated -> rebuild icon so dull/contrast updates
  subs.push(asset.lastSeen.subscribe(() => {
    refreshAssetMarkerIcons(asset);
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
    const m = L.marker([lat, lng], { icon, pane: 'pane-top', riseOnHover: true });
    m._assetId = asset.id?.();

    const html = buildAssetPopupKO();
    const contentEl = makePopupNode(html, 'veh-pop-root');
    const popup = L.popup({
      minWidth: 360,
      maxWidth: 360,
      maxHeight: 360,
      // See the matching comment on the matched-asset popup above.
      autoPan: false,
      pane: 'pane-popup-top',
    }).setContent(contentEl);

    m.bindPopup(popup);
    m.addTo(layer);
    asset.unmatchedMarker = m;

    const popupVm = viewModel.mapVM.makeAssetPopupVM(asset);
    bindPopupWithKO(ko, asset.unmatchedMarker, viewModel, asset, popupVm);

    asset.unmatchedMarker.on('popupopen', () => {
      viewModel.mapVM.setOpen('asset', asset);
    });
    focusWhilePopupOpen(asset.unmatchedMarker);
  }

  // subs (separate from asset._markerSubs)
  if (asset._unmatchedMarkerSubs && asset._unmatchedMarkerSubs.length) return;

  const subs = [];

  //location changes
  subs.push(asset.latLng.subscribe(v => {
    const latNow = +v?.lat, lngNow = +v?.lng;
    if (asset.unmatchedMarker && Number.isFinite(latNow) && Number.isFinite(lngNow)) {
      moveMarker(asset.unmatchedMarker, latNow, lngNow, { onMove: viewModel.mapVM.assetPinLayout?.schedule });
    }
  }));

  //last seen changes
  subs.push(asset.lastSeen.subscribe(() => {
    refreshAssetMarkerIcons(asset);
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
}



function bindPopupWithKO(ko, marker, vm, asset, popupVm) {
  const openHandler = (e) => {
    const el = e.popup.getContent(); // our stable node
    vm.mapVM.setOpen?.('asset', asset);
    bindKoToPopup(ko, popupVm, el);

    // If no team row has focus, open the first team's popup.
    if (!asset.matchingTeamsInView()?.some(team => team.rowHasFocus && team.rowHasFocus())) {
      asset.matchingTeamsInView()?.length !== 0 && asset.matchingTeamsInView()[0].onPopupOpen();
    }
    popupVm.updatePopup?.();

    // Real content is bound now -- turn autoPan on (it starts off, see
    // the popup's own options) so the resulting pan is against the real
    // content instead of the pristine placeholder Leaflet would
    // otherwise have already panned for the instant the popup opened.
    e.popup.options.autoPan = true;
    deferPopupUpdate(e.popup);
  };

  // Unbind after popup is fully closed for visual cleanliness
  const closeHandler = (e) => {
    const el = e.popup?.getContent();
    // Turn autoPan back off for the next open -- see the popup's own
    // options above for why.
    if (e.popup) e.popup.options.autoPan = false;
    // Don't clear routes/crow-flies if the popup was closed as a
    // side-effect of a flyToBounds animation (e.g. spider collapse
    // from a zoom change after drawing a route).
    if (!vm.mapVM._flyingToBounds) {
        vm.mapVM.clearCrowFliesLine();
        vm.mapVM.clearRoutes?.();
    }
    vm.mapVM.clearOpen?.();
    asset.matchingTeamsInView()?.length !== 0 && asset.matchingTeamsInView()[0].onPopupClose();

    // Defer unbinding to after the close animation completes
    setTimeout(() => {
      unbindKoFromPopup(ko, el);
    }, 250); // 250ms matches Leaflet's default fade animation
  };

  marker._koWired = true;
  marker.on('popupopen', openHandler);
  marker.on('popupclose', closeHandler);
  marker.on('remove', closeHandler); // safety
}