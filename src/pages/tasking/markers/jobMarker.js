var L = require('leaflet');
var ko = require('knockout');

import { buildJobPopupKO } from '../components/job_popup.js';
import { makeShapeIcon, styleForJob } from '../components/job_icon.js';


import { makePopupNode, bindKoToPopup, unbindKoFromPopup, deferPopupUpdate } from '../utils/popup_dom_utils.js';


export function addOrUpdateJobMarker(ko, map, vm, job) {
    const id = job.id?.();
    const lat = job.address.latitude(); // null if null
    const lng = job.address.longitude(); //null if null

    if (!(Number.isFinite(lat) && Number.isFinite(lng)) || id == null) return;

    const type = job.typeName?.() || "default";
    const { layerGroup, markers } = ensureGroup(vm, map, type);
    const style = styleForJob(job);
    const html = buildJobPopupKO();
    const contentEl = makePopupNode(html, 'job-pop-root')

    var popup = L.popup({
        minWidth: 380,
        maxWidth: 380,
        minHeight: 300,
        autoPan: true,
        autoPanPadding: [16, 16]
    }).setContent(contentEl);


    const marker = L.marker([lat, lng], {
        icon: makeShapeIcon(style),
        title: job.identifier?.()
    }).bindPopup(popup);

    if (markers.has(id)) {
        // update in place
        const node = makePopupNode(html, 'job-pop-root');
        const m = markers.get(id);
        const pt = m.getLatLng();
        if (pt.lat !== lat || pt.lng !== lng) m.setLatLng([lat, lng]);
        const key = JSON.stringify(style);
        if (m._styleKey !== key) { m.setIcon(makeShapeIcon(style)); m._styleKey = key; }
        if (!m._popupBound) { m.setPopupContent(node); wireKoForPopup(ko, m, job, vm, popupVM); }

        // keep the "New" ring in correct state
        upsertPulseRing(layerGroup, job, m);

        // ensure we have a status subscription exactly once
        if (!m._pulseSubs || m._pulseSubs.length === 0) {
            (m._pulseSubs ||= []).push(
                job.statusName.subscribe(() => upsertPulseRing(layerGroup, job, m))
            );
        }

        job.marker = m;
        return m;
    }



    marker._styleKey = JSON.stringify(style);
    marker.addTo(layerGroup);
    markers.set(id, marker);
    job.marker = marker;

    upsertPulseRing(layerGroup, job, marker);
    (marker._pulseSubs ||= []).push(
        job.statusName.subscribe(() => upsertPulseRing(layerGroup, job, marker))
    );


    const popupVM = vm.mapVM.makeJobPopupVM(job);
    wireKoForPopup(ko, marker, job, vm, popupVM);

    // live position updates from KO observables
    marker._subs = [
        job.address.latitude.subscribe(() => safeMove(marker, job)),
        job.address.longitude.subscribe(() => safeMove(marker, job)),
    ];

    return marker;
}

export function removeJobMarker(vm, jobOrId) {
    const id = typeof jobOrId === 'number' ? jobOrId : jobOrId?.id?.();
    if (id == null) return;

    // find marker in any group
    for (const { layerGroup, markers } of vm.mapVM.jobMarkerGroups.values()) {
        const m = markers.get(id);
        if (!m) continue;

        // dispose KO subscriptions
        (m._subs || []).forEach(s => { try { s.dispose?.(); } catch { /* empty */ } });
        m._subs = [];

        // unbind KO from popup if ever opened
        const popupEl = m.getPopup()?.getElement?.();
        if (popupEl && popupEl.__ko_bound__) { try { ko.cleanNode(popupEl); } catch { /* empty */ } delete popupEl.__ko_bound__; }

        if (m._pulseRing) {
            m._pulseRing._detach?.();
            (m._pulseSubs || []).forEach(s => { try { s.dispose?.(); } catch { /* empty */ } });
            m._pulseSubs = [];
            layerGroup.removeLayer(m._pulseRing);
            m._pulseRing = null;
        }

        layerGroup.removeLayer(m);
        markers.delete(id);
        break;
    }

    const job = vm.jobsById?.get?.(id);
    if (job) job.marker = null;
}

//complicated for some reason. has to support different icons sizes and anchors
function upsertPulseRing(layerGroup, job, marker) {
  const isNew = (job.statusName?.() || '').toLowerCase() === 'new';
  const base = marker.options.icon?.options || {};
  const baseSize   = base.iconSize  || [14, 14];
  const baseAnchor = base.iconAnchor|| [baseSize[0]/2, baseSize[1]/2];

  if (isNew && !marker._pulseRing) {
    const k = 4;
    const ringSize   = [Math.round(baseSize[0]*k),   Math.round(baseSize[1]*k)];
    const ringAnchor = [Math.round(baseAnchor[0]*k), Math.round(baseAnchor[1]*k)];

    const ring = L.marker(marker.getLatLng(), {
      pane: 'pane-top',
      icon: L.divIcon({
        className: 'pulse-ring-icon',
        html: '<div class="pulse-ring"></div>',
        iconSize: ringSize,
        iconAnchor: ringAnchor
      }),
      interactive: false,
      keyboard: false
    });

    const follow = () => ring.setLatLng(marker.getLatLng());
    marker.on('move', follow);
    ring._detach = () => marker.off('move', follow);

    ring.setZIndexOffset((marker.options?.zIndexOffset||0)+1);
    ring.addTo(layerGroup);
    marker._pulseRing = ring;
  }

  if (!isNew && marker._pulseRing) {
    marker._pulseRing._detach?.();
    layerGroup.removeLayer(marker._pulseRing);
    marker._pulseRing = null;
  }
}

// --- internals ---
function ensureGroup(vm, map, typeName) {
    if (!vm.mapVM.jobMarkerGroups.has(typeName)) {
        const group = L.layerGroup().addTo(map);
        vm.mapVM.jobMarkerGroups.set(typeName, { layerGroup: group, markers: new Map() });
    }
    return vm.mapVM.jobMarkerGroups.get(typeName);
}

function safeMove(marker, job) {
    const lat = +job.address.latitude?.();
    const lng = +job.address.longitude?.();
    if (Number.isFinite(lat) && Number.isFinite(lng)) marker.setLatLng([lat, lng]);
}



function wireKoForPopup(ko, marker, job, vm, popupVM) {
    if (marker._koWired) return;
    marker.on('popupopen', e => {
        const el = e.popup.getContent();
        vm.mapVM.setOpen?.('job', job);
        bindKoToPopup(ko, popupVM, el);
        job.onPopupOpen && job.onPopupOpen();
        popupVM.updatePopup?.();
        deferPopupUpdate(e.popup);
    });
    marker.on('popupclose', e => {
        const el = e.popup.getContent();
        unbindKoFromPopup(ko, el);       // clean -> reset
        job.onPopupClose && job.onPopupClose();
        vm.mapVM.clearCrowFliesLine();
        vm.mapVM.clearRoutes();
        vm.mapVM.clearOpen?.();
        if (vm?.mapVM?.openPopup()?.ref === job) vm.mapVM.clearOpen();

    });
    marker._popupBound = true;
    marker._koWired = true;
}






