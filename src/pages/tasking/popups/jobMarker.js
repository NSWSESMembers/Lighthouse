var L = require('leaflet');
var ko = require('knockout');

import { buildJobPopupKO } from '../components/job_popup.js';


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
        job.marker = m;
        return m;
    }



    marker._styleKey = JSON.stringify(style);
    marker.addTo(layerGroup);
    markers.set(id, marker);
    job.marker = marker;
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

        layerGroup.removeLayer(m);
        markers.delete(id);
        break;
    }

    const job = vm.jobsById?.get?.(id);
    if (job) job.marker = null;
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


// Build icon style for a given job
function styleForJob(job) {
    const type = job.typeName() || "default";
    const shape = typeShape[type] || typeShape.default;
    const fill = typeFill[type] || typeFill.default;

    // Stroke: Flood Rescue categories override priority
    let stroke;
    if (type === "FR") {
        const catKey = floodRescueCategoryKey(job);
        stroke = (catKey && floodCatStroke[catKey]) || "#0EA5E9";
    } else {
        const pr = job.priorityName();
        stroke = priorityStroke[pr] || "#4B5563";
    }

    // Emphasise Priority/Immediate with larger radius
    const radius = (/^(Priority|Immediate)$/i.test(job.priorityName())) ? 8.5 : 7;

    return { shape, fill, stroke, radius, strokeWidth: 2.25 };
    // tweak strokeWidth if you need stronger outlines
}



// --- SVG factory (shape+style → L.divIcon) ---
function makeShapeIcon({ shape, fill, stroke, radius = 7, strokeWidth = 2 }) {
    const d = radius * 2;
    const cx = radius, cy = radius;

    let inner = "";
    switch (shape) {
        case "circle":
            inner = `<circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        case "square": {
            const s = d - strokeWidth;
            const o = strokeWidth / 2;
            inner = `<rect x="${o}" y="${o}" width="${s}" height="${s}"
                          rx="2" ry="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }
        case "diamond": {
            const r = radius - strokeWidth / 2;
            inner = `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }
        case "triangle": {
            const r = radius - strokeWidth / 2;
            const h = r * Math.sqrt(3);
            const p1 = `${cx},${cy - r}`;
            const p2 = `${cx - h / 2},${cy + r / 2}`;
            const p3 = `${cx + h / 2},${cy + r / 2}`;
            inner = `<polygon points="${p1} ${p2} ${p3}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }
        case "hex": {
            const r = radius - strokeWidth / 2;
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
            }
            inner = `<polygon points="${pts.join(" ")}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }
        default:
            inner = `<circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">
              ${inner}
            </svg>`;

    return L.divIcon({
        className: "job-svg-marker",
        html: svg,
        iconSize: [d, d],
        iconAnchor: [radius, radius],
        popupAnchor: [0, -radius]
    });
};

// type → shape
const typeShape = {
    "Storm": "circle",
    "Flood Misc": "diamond",
    "Flood": "square",
    "FR": "diamond",
    "Rescue": "triangle",
    "Welfare": "square",
    "Evacuation Secondary": "hex",
    default: "circle"
};

// type → fill color
const typeFill = {
    "Storm": "#22C55E",
    "Flood Misc": "#1C7ED6",
    "Flood": "#ffa200ff",
    "FR": "#000000",
    "Rescue": "#EF4444",
    default: "#9CA3AF"
};

// Priority → stroke color
const priorityStroke = {
    "Priority": "#FFA500",  // goldy yellow
    "Immediate": "#4F92FF",  // blue
    "Rescue": "#FF0000",  // red
    "General": "#000000"   // black
};

// Flood Rescue categories → stroke color (overrides priority if job is Flood Rescue)
const floodCatStroke = {
    "Category1": "#7F1D1D", // Critical assistance
    "Category2": "#DC2626", // Imminent threat
    "Category3": "#EA580C", // Trapped - rising
    "Category4": "#EAB308", // Trapped - stable
    "Category5": "#16A34A", // Animal
    "Red": "#DC2626",
    "Orange": "#EA580C"
};

function floodRescueCategoryKey(job) {
    // pick first matching known category if present
    const cat = job.categoriesName();
    if (floodCatStroke[cat]) return cat;
    return null;
}


