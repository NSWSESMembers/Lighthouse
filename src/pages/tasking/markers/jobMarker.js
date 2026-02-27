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

    const isRescue = (job.priorityName?.() || '').toLowerCase() === 'rescue';
    const clusterRescue = !!vm.config?.clusterRescueJobs?.();
    const clusteringOn = vm.mapVM.clusteringEnabled;
    const targetLayer = !clusteringOn
        ? vm.mapVM.unclusteredJobLayer          // clustering disabled – plain layer
        : (isRescue && !clusterRescue)
            ? vm.mapVM.rescueJobLayer            // rescue excluded from clusters
            : vm.mapVM.jobClusterGroup;          // normal clustering
    const markers = vm.mapVM.jobMarkerIndex;
    const pulseLayer = vm.mapVM.jobPulseLayer;
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
        pane: 'pane-tippy-top',
        icon: makeShapeIcon(style),
        title: job.identifier?.()
    }).bindPopup(popup);

    if (markers.has(id)) {
        // update in place
        const node = makePopupNode(html, 'job-pop-root');
        const m = markers.get(id);
        const pt = m.getLatLng();
        // When spiderfied, _latlng is the spider position — don't overwrite
        // it or the spider layout breaks.  The real position is stored in
        // _preSpiderfyLatlng and will be restored on unspiderfy.
        if (!m._spiderLeg && (pt.lat !== lat || pt.lng !== lng)) m.setLatLng([lat, lng]);
        const key = JSON.stringify(style);
        if (m._styleKey !== key) { m.setIcon(makeShapeIcon(style)); m._styleKey = key; }
        m._priorityColor = style.fill || '#6b7280';
        if (!m._popupBound) { m.setPopupContent(node); wireKoForPopup(ko, m, job, vm, popupVM); }

        // keep the "New" ring and _isNew flag in correct state
        upsertPulseRing(pulseLayer, job, m);
        const wasNew = m._isNew;
        m._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
        if (wasNew !== m._isNew && vm.mapVM.clusteringEnabled) {
            vm.mapVM.jobClusterGroup.refreshClusters(m);
        }

        // ensure we have a status subscription exactly once
        if (!m._pulseSubs || m._pulseSubs.length === 0) {
            (m._pulseSubs ||= []).push(
                job.statusName.subscribe(() => {
                    upsertPulseRing(pulseLayer, job, m);
                    const prev = m._isNew;
                    m._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
                    if (prev !== m._isNew && vm.mapVM.clusteringEnabled) {
                        vm.mapVM.jobClusterGroup.refreshClusters(m);
                    }
                })
            );
        }

        job.marker = m;
        return m;
    }



    marker._styleKey = JSON.stringify(style);
    marker._isRescue = isRescue;
    marker._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
    marker._priorityColor = style.fill || '#6b7280';
    marker.addTo(targetLayer);
    markers.set(id, marker);
    job.marker = marker;

    upsertPulseRing(pulseLayer, job, marker);
    (marker._pulseSubs ||= []).push(
        job.statusName.subscribe(() => {
            upsertPulseRing(pulseLayer, job, marker);
            const wasNew = marker._isNew;
            marker._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
            // If the flag changed, refresh ancestor cluster icons
            if (wasNew !== marker._isNew && vm.mapVM.clusteringEnabled) {
                vm.mapVM.jobClusterGroup.refreshClusters(marker);
            }
        })
    );


    const popupVM = vm.mapVM.makeJobPopupVM(job);
    wireKoForPopup(ko, marker, job, vm, popupVM);

    // live position updates from KO observables
    marker._subs = [
        job.address.latitude.subscribe(() => safeMove(marker, job)),
        job.address.longitude.subscribe(() => safeMove(marker, job)),
    ];

    // Sync pulse ring visibility after adding
    vm.mapVM._syncPulseRings?.();

    return marker;
}

export function removeJobMarker(vm, jobOrId) {
    const id = typeof jobOrId === 'number' ? jobOrId : jobOrId?.id?.();
    if (id == null) return;

    const markers = vm.mapVM.jobMarkerIndex;
    const clusterGroup = vm.mapVM.jobClusterGroup;
    const rescueLayer = vm.mapVM.rescueJobLayer;
    const pulseLayer = vm.mapVM.jobPulseLayer;

    const m = markers.get(id);
    if (!m) return;

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
        pulseLayer.removeLayer(m._pulseRing);
        m._pulseRing = null;
    }

    // Remove from whichever layer it's in
    if (clusterGroup.hasLayer(m)) clusterGroup.removeLayer(m);
    if (rescueLayer.hasLayer(m)) rescueLayer.removeLayer(m);
    markers.delete(id);

    const job = vm.jobsById?.get?.(id);
    if (job) job.marker = null;
}

//complicated for some reason. has to support different icons sizes and anchors
function upsertPulseRing(layerGroup, job, marker) {
    const isNew = (job.statusName?.() || '').toLowerCase() === 'new';
    const base = marker.options.icon?.options || {};
    const baseSize = base.iconSize || [14, 14];
    const baseAnchor = base.iconAnchor || [baseSize[0] / 2, baseSize[1] / 2];

    if (isNew && !marker._pulseRing) {
        const k = 3;
        const ringSize = [Math.round(baseSize[0] * k), Math.round(baseSize[1] * k)];
        const ringAnchor = [Math.round(baseAnchor[0] * k), Math.round(baseAnchor[1] * k)];

        const ring = L.marker(marker.getLatLng(), {
            pane: 'pane-tippy-top',
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

        ring.setZIndexOffset((marker.options?.zIndexOffset || 0) + 1);
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

function safeMove(marker, job) {
    // Skip if the marker is currently spiderfied — moving it would break the
    // spider layout.  The real position is restored on unspiderfy.
    if (marker._spiderLeg) return;
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
        // Defer unbinding to after the close animation completes
        setTimeout(() => {
            unbindKoFromPopup(ko, el);
        }, 250); // 250ms matches Leaflet's default fade animation
        job.onPopupClose && job.onPopupClose();
        // Don't clear routes/crow-flies if the popup was closed as a
        // side-effect of a flyToBounds animation (e.g. spider collapse
        // from a zoom change after drawing a route).
        if (!vm.mapVM._flyingToBounds) {
            vm.mapVM.clearCrowFliesLine();
            vm.mapVM.clearRoutes();
        }
        vm.mapVM.clearOpen?.();
        if (vm?.mapVM?.openPopup()?.ref === job) vm.mapVM.clearOpen();

    });
    marker._popupBound = true;
    marker._koWired = true;
}






