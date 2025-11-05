var L = require('leaflet');
var moment = require('moment');
import { buildAssetPopupKO } from './map_popup.js';


function buildIcon(asset) {
    const capabilityColors = {
        'Bus': '#FFD600',
        'Command': '#1565C0',
        'Community First Responder': '#D32F2F',
        'General Purpose': '#8E24AA',
        'Logistics': '#795548',
        'Light Storm': '#FB8C00',
        'Medium Storm': '#EF6C00',
        'Light Rescue': '#C62828',
        'Medium Rescue': '#B71C1C',
        'Heavy Rescue': '#880E4F',
        'SHQ Pool': '#5D4037',
        'vessel': '#0288D1',
        'portable': '#43A047'
    };

    const bg = capabilityColors[asset.capability()] || '#1565C0';
    const dull = (() => {
        try {
            const days = moment().diff(asset.lastSeen(), 'days');
            return days > 1 ? 'filter:contrast(0.3);' : '';
        } catch { return ''; }
    })();

    const html =
        `<div style="background-color:${bg};${dull}" class="marker-pin"></div>
     <div class="assetMarker" style="position:absolute;margin:24px 13px;line-height:10px;text-align:center;color:white;font-size:11px;width:60%">
       <p>${asset.markerLabel()}</p>
     </div>`;

    return L.divIcon({
        className: 'custom-div-icon',
        html,
        iconSize: [40, 56],
        iconAnchor: [24, 56],
        popupAnchor: [0, -35]
    });
}

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
    const layer = viewModel.vehicleLayer;

    // Marker create (once)
    const lat = +asset.latitude?.();
    const lng = +asset.longitude?.();
    if (Number.isFinite(lat) && Number.isFinite(lng) && !asset.marker) {
        const icon = buildIcon(asset);
        const m = L.marker([lat, lng], { icon });
        m._assetId = asset.id?.();
        const html = buildAssetPopupKO();

        m.bindPopup(() =>
            html
        );
        m.addTo(layer);
        asset.marker = m;
        bindPopupWithKO(ko, asset.marker, asset);
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

    // Icon-affecting changes (label/capability/lastSeen)
    // const refreshIcon = (a) => {
    //     if (!asset.marker) return;
    //     asset.marker.setIcon(buildIcon(asset));
    // };
    // subs.push(asset.markerLabel.subscribe(refreshIcon));
    // subs.push(asset.capability.subscribe(refreshIcon));
    // subs.push(asset.lastSeen.subscribe(refreshIcon));

    // Popup-affecting changes (name/entity/capability)
    // const refreshPopup = () => {
    //     if (!asset.marker) return;
    //     asset.marker.setPopupContent(
    //         `<div class="p-1"><strong>${asset.name()}</strong><br/>${asset.entity()}<br/>${asset.capability()}</div>`
    //     );
    // };
    // subs.push(asset.name.subscribe(refreshPopup));
    // subs.push(asset.entity.subscribe(refreshPopup));
    // subs.push(asset.capability.subscribe(refreshPopup)); // also included above, but harmless

    asset._markerSubs = subs;

    asset.marker.on('popupclose', () => {
        const taskings = viewModel.taskings ? viewModel.taskings() : [];
        for (const t of taskings) {
            if (t && typeof t.clearRoute === 'function') t.clearRoute();
            t.removeLine()
        }
    });
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
        viewModel.vehicleLayer.removeLayer(asset.marker);
        asset.marker = null;
    }
}


function bindPopupWithKO(ko, marker, asset) {

    const openHandler = (e) => {
        const el = e.popup.getElement();
        if (el && !el.__ko_bound__) {
            ko.applyBindings({ asset }, el);
            el.__ko_bound__ = true;
        }
    };

    const closeHandler = (e) => {
        const el = e.popup && e.popup.getElement();
        if (el && el.__ko_bound__) {
            ko.cleanNode(el);
            delete el.__ko_bound__;
        }
    };
    marker._koWired = true;
    marker.on('popupopen', openHandler);
    marker.on('popupclose', closeHandler);
    marker.on('remove', closeHandler); // safety
}