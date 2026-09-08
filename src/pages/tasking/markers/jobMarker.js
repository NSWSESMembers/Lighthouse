var L = require('leaflet');
var ko = require('knockout');

import { buildJobPopupKO } from '../components/job_popup.js';
import { makeShapeIcon, styleForJob, buildPulseRingSvg, buildStatusRingSvg } from '../components/job_icon.js';
import { statusHasRing } from '../utils/jobTypesToUI.js';


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
    const showStatus = !!vm.config?.showJobStatusOnMarkers?.();
    const style = styleForJob(job, { showStatus });
    const html = buildJobPopupKO();
    const contentEl = makePopupNode(html, 'job-pop-root')

    var popup = L.popup({
        minWidth: 380,
        maxWidth: 760,
        minHeight: 300,
        autoPan: true,
        autoPanPadding: [16, 16],
        pane: 'pane-popup-top'
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
        if (!m._popupBound) { m.setPopupContent(node); wireKoForPopup(ko, m, job, vm, vm.mapVM.makeJobPopupVM(job)); }

        // keep the "New" pulse ring and the Active marching ring in correct state
        upsertPulseRing(pulseLayer, job, m);
        if (showStatus) upsertStatusRing(vm.mapVM.jobStatusRingLayer, job, m);
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
                    // restyle icon (strike / X) + Active marching ring when the option is on
                    if (vm.config?.showJobStatusOnMarkers?.()) syncMarkerStyle(m, job, vm, pulseLayer);
                })
            );
        }

        // ensure we have a priority subscription exactly once
        if (!m._prioritySub) {
            m._prioritySub = job.jobPriorityType.subscribe(() => {
                syncMarkerStyle(m, job, vm, pulseLayer);
            });
            (m._subs ||= []).push(m._prioritySub);
        }

        // action-required tags → "!" pip on the icon
        if (!m._alertSub && job.actionRequiredTags) {
            m._alertSub = job.actionRequiredTags.subscribe(() => {
                if (vm.config?.showJobStatusOnMarkers?.()) syncMarkerStyle(m, job, vm, pulseLayer);
            });
            (m._subs ||= []).push(m._alertSub);
        }

        job.marker = m;
        return m;
    }



    marker._styleKey = JSON.stringify(style);
    marker._isRescue = isRescue;
    marker._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
    marker._priorityColor = style.fill || '#6b7280';
    if (targetLayer === vm.mapVM.jobClusterGroup) {
        marker.addTo(targetLayer);
    } else {
        marker.addTo(targetLayer);
    }
    markers.set(id, marker);
    job.marker = marker;

    upsertPulseRing(pulseLayer, job, marker);
    if (showStatus) upsertStatusRing(vm.mapVM.jobStatusRingLayer, job, marker);
    (marker._pulseSubs ||= []).push(
        job.statusName.subscribe(() => {
            upsertPulseRing(pulseLayer, job, marker);
            const wasNew = marker._isNew;
            marker._isNew = (job.statusName?.() || '').toLowerCase() === 'new';
            // If the flag changed, refresh ancestor cluster icons
            if (wasNew !== marker._isNew && vm.mapVM.clusteringEnabled) {
                vm.mapVM.jobClusterGroup.refreshClusters(marker);
            }
            // restyle icon (strike / X) + Active marching ring when the option is on
            if (vm.config?.showJobStatusOnMarkers?.()) syncMarkerStyle(marker, job, vm, pulseLayer);
        })
    );


    const popupVM = vm.mapVM.makeJobPopupVM(job);
    wireKoForPopup(ko, marker, job, vm, popupVM);

    // live priority updates — restyle icon when priority changes
    marker._prioritySub = job.jobPriorityType.subscribe(() => {
        syncMarkerStyle(marker, job, vm, pulseLayer);
    });

    // action-required tags → "!" pip on the icon
    marker._alertSub = job.actionRequiredTags
        ? job.actionRequiredTags.subscribe(() => {
            if (vm.config?.showJobStatusOnMarkers?.()) syncMarkerStyle(marker, job, vm, pulseLayer);
        })
        : null;

    // live position updates from KO observables
    marker._subs = [
        job.address.latitude.subscribe(() => safeMove(marker, job)),
        job.address.longitude.subscribe(() => safeMove(marker, job)),
        marker._prioritySub,
        marker._alertSub,
    ].filter(Boolean);

    // Sync pulse / status ring visibility after adding
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

    if (m._pendingUnbindTimer) {
        clearTimeout(m._pendingUnbindTimer);
        m._pendingUnbindTimer = null;
    }

    // dispose KO subscriptions
    (m._subs || []).forEach(s => { try { s.dispose?.(); } catch { /* empty */ } });
    m._subs = [];

    // unbind KO from popup if ever opened
    const popupEl = m.getPopup()?.getElement?.();
    if (popupEl && popupEl.__ko_bound__) { try { ko.cleanNode(popupEl); } catch { /* empty */ } delete popupEl.__ko_bound__; }

    // statusName subscription drives both the pulse ring and the Active ring
    (m._pulseSubs || []).forEach(s => { try { s.dispose?.(); } catch { /* empty */ } });
    m._pulseSubs = [];

    if (m._pulseRing) {
        m._pulseRing._detach?.();
        pulseLayer.removeLayer(m._pulseRing);
        m._pulseRing = null;
    }

    if (m._statusRing) {
        m._statusRing._detach?.();
        vm.mapVM.jobStatusRingLayer?.removeLayer(m._statusRing);
        m._statusRing = null;
    }

    // Remove from whichever layer it's in
    if (clusterGroup.hasLayer(m)) clusterGroup.removeLayer(m);
    if (rescueLayer.hasLayer(m)) rescueLayer.removeLayer(m);
    markers.delete(id);

    const job = vm.jobsById?.get?.(id);
    if (job) job.marker = null;
}

/**
 * Re-evaluate every existing job marker — used when the `showJobStatusOnMarkers`
 * config option is toggled, so the strike / X / "!" pip and the Active marching
 * ring are added to / removed from markers already on the map.
 */
export function restyleAllJobMarkers(vm) {
    const showStatus = !!vm.config?.showJobStatusOnMarkers?.();
    const pulseLayer = vm.mapVM?.jobPulseLayer;
    const statusRingLayer = vm.mapVM?.jobStatusRingLayer;
    vm.jobsById?.forEach((job) => {
        const m = job.marker;
        if (!m) return;

        const newStyle = styleForJob(job, { showStatus });
        const key = JSON.stringify(newStyle);
        if (m._styleKey !== key) {
            m.setIcon(makeShapeIcon(newStyle));
            m._styleKey = key;
            m._priorityColor = newStyle.fill || '#6b7280';
            // icon box may have resized — rebuild the pulse ring against it
            if (m._pulseRing && pulseLayer) {
                m._pulseRing._detach?.();
                pulseLayer.removeLayer(m._pulseRing);
                m._pulseRing = null;
                upsertPulseRing(pulseLayer, job, m);
            }
        }

        // Active marching ring: rebuild if on, tear down if the option is off
        if (m._statusRing && statusRingLayer) {
            m._statusRing._detach?.();
            statusRingLayer.removeLayer(m._statusRing);
            m._statusRing = null;
        }
        if (showStatus) upsertStatusRing(statusRingLayer, job, m);
    });
    vm.mapVM?._syncPulseRings?.();
}

//complicated for some reason. has to support different icons sizes and anchors
function upsertPulseRing(layerGroup, job, marker) {
    const isNew = (job.statusName?.() || '').toLowerCase() === 'new';
    const base = marker.options.icon?.options || {};
    const iconSize = base.iconSize || [14, 14];
    // Ring is sized to the actual shape, not the (possibly pip-padded) icon box.
    const shapeD = base.shapeDiameter || Math.min(iconSize[0], iconSize[1]);
    const baseSize = [shapeD, shapeD];

    if (isNew && !marker._pulseRing) {
        const k = 3;
        const ringSize = [Math.round(baseSize[0] * k), Math.round(baseSize[1] * k)];
        const ringAnchor = [Math.round(ringSize[0] / 2), Math.round(ringSize[1] / 2)];

        const shape = styleForJob(job).shape || 'circle';
        const pulseSvg = buildPulseRingSvg(shape, ringSize[0], ringSize[1]);

        const ring = L.marker(marker.getLatLng(), {
            pane: 'pane-tippy-top',
            icon: L.divIcon({
                className: 'pulse-ring-icon',
                html: pulseSvg,
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

/**
 * Active jobs get a magenta "marching ring" — a sibling non-interactive marker
 * on jobStatusRingLayer, following the main marker, sized to the real shape.
 * Same lifecycle model as the pulse ring.  Callers gate on the config option.
 */
function upsertStatusRing(layerGroup, job, marker) {
    if (!layerGroup) return;
    const want = statusHasRing(job.statusName?.());

    if (want && !marker._statusRing) {
        const base = marker.options.icon?.options || {};
        const iconSize = base.iconSize || [14, 14];
        const shapeD = base.shapeDiameter || Math.min(iconSize[0], iconSize[1]);
        const ringR = shapeD / 2 + 4;                 // clear of the shape edge
        const size = Math.ceil((ringR + 3) * 2);
        const anchor = [Math.round(size / 2), Math.round(size / 2)];

        const ring = L.marker(marker.getLatLng(), {
            pane: 'pane-tippy-top',
            icon: L.divIcon({
                className: 'status-ring-icon',
                html: buildStatusRingSvg(size, ringR),
                iconSize: [size, size],
                iconAnchor: anchor
            }),
            interactive: false,
            keyboard: false
        });

        const follow = () => ring.setLatLng(marker.getLatLng());
        marker.on('move', follow);
        ring._detach = () => marker.off('move', follow);

        // Sit behind the marker so the shape and the "!" pip always win their
        // pixels — the ring is a background accent, not an overlay.
        ring.setZIndexOffset((marker.options?.zIndexOffset || 0) - 100);
        ring.addTo(layerGroup);
        marker._statusRing = ring;
    }

    if (!want && marker._statusRing) {
        marker._statusRing._detach?.();
        layerGroup.removeLayer(marker._statusRing);
        marker._statusRing = null;
    }
}

/** Tear down and (if still wanted) rebuild the status ring against the current icon. */
function rebuildStatusRing(layerGroup, job, marker) {
    if (marker._statusRing && layerGroup) {
        marker._statusRing._detach?.();
        layerGroup.removeLayer(marker._statusRing);
        marker._statusRing = null;
    }
    upsertStatusRing(layerGroup, job, marker);
}

// --- internals ---

/**
 * Re-evaluate a marker's icon style after a priority (or category) change.
 * Updates icon, _priorityColor, _isRescue and handles rescue-layer
 * reassignment + cluster refresh as needed.
 */
function syncMarkerStyle(marker, job, vm, pulseLayer) {
    const showStatus = !!vm.config?.showJobStatusOnMarkers?.();
    const newStyle = styleForJob(job, { showStatus });
    const newKey = JSON.stringify(newStyle);

    // Update icon if the visual style actually changed
    if (marker._styleKey !== newKey) {
        marker.setIcon(makeShapeIcon(newStyle));
        marker._styleKey = newKey;
    }
    marker._priorityColor = newStyle.fill || '#6b7280';

    // Active marching ring — rebuild against the (possibly resized) icon
    if (showStatus) {
        rebuildStatusRing(vm.mapVM.jobStatusRingLayer, job, marker);
    } else if (marker._statusRing) {
        marker._statusRing._detach?.();
        vm.mapVM.jobStatusRingLayer?.removeLayer(marker._statusRing);
        marker._statusRing = null;
    }

    // Check whether rescue status flipped
    const wasRescue = marker._isRescue;
    const isRescue = (job.priorityName?.() || '').toLowerCase() === 'rescue';
    marker._isRescue = isRescue;

    if (wasRescue !== isRescue) {
        const clusterRescue = !!vm.config?.clusterRescueJobs?.();
        const clusteringOn = vm.mapVM.clusteringEnabled;

        if (clusteringOn) {
            if (isRescue && !clusterRescue) {
                // Was normal, now rescue and rescues are unclustered
                if (vm.mapVM.jobClusterGroup.hasLayer(marker)) {
                    vm.mapVM.jobClusterGroup.removeLayer(marker);
                    vm.mapVM.rescueJobLayer.addLayer(marker);
                }
            } else if (!isRescue || clusterRescue) {
                // Was rescue (unclustered), now normal — put back into cluster group
                if (vm.mapVM.rescueJobLayer.hasLayer(marker)) {
                    vm.mapVM.rescueJobLayer.removeLayer(marker);
                    vm.mapVM.jobClusterGroup.addLayer(marker);
                }
            }
        }
    }

    // Refresh the pulse ring shape (it depends on style.shape)
    upsertPulseRing(pulseLayer, job, marker);
    vm.mapVM._syncPulseRings?.();

    // Refresh ancestor cluster icons so the hex ring redraws with the new colour
    if (vm.mapVM.clusteringEnabled && vm.mapVM.jobClusterGroup.hasLayer(marker)) {
        vm.mapVM.jobClusterGroup.refreshClusters(marker);
    }
}

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
        // A reopen (e.g. a double-click toggling closed->open again) can
        // land inside the 250ms deferred-unbind window below. If so, the
        // pending unbind is now stale -- cancel it, or it'll fire later and
        // ko.cleanNode/reset a popup that's live and visibly open again.
        if (marker._pendingUnbindTimer) {
            clearTimeout(marker._pendingUnbindTimer);
            marker._pendingUnbindTimer = null;
        }
        vm.mapVM.setOpen?.('job', job);
        bindKoToPopup(ko, popupVM, el);
        job.onPopupOpen && job.onPopupOpen();
        popupVM.updatePopup?.();
        deferPopupUpdate(e.popup);

        // Auto-widen: if the popup overflows the viewport, switch to 2-col
        requestAnimationFrame(() => {
            const wrapper = e.popup.getElement();
            if (!wrapper) return;
            const jp = wrapper.querySelector('.job-popup');
            if (!jp) return;
            // reset first so we measure single-col height
            jp.classList.remove('job-popup--wide');
            e.popup.update();
            requestAnimationFrame(() => {
                const rect = wrapper.getBoundingClientRect();
                const overflows = rect.bottom > window.innerHeight - 8
                               || rect.top < 8;
                if (overflows) {
                    jp.classList.add('job-popup--wide');
                    e.popup.update();
                }
            });
        });
    });
    marker.on('popupclose', e => {
        const el = e.popup.getContent();
        // Defer unbinding to after the close animation completes. Tracked
        // on the marker so a fast reopen (see 'popupopen' above) can cancel
        // it -- otherwise this fires after the reopen and tears down a
        // popup that's live and visibly open again.
        if (marker._pendingUnbindTimer) clearTimeout(marker._pendingUnbindTimer);
        marker._pendingUnbindTimer = setTimeout(() => {
            marker._pendingUnbindTimer = null;
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






