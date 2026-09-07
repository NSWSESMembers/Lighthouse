import {jobsToUI, statusClosedMark, ACTIVE_RING_COLOUR} from "../utils/jobTypesToUI.js";

// --- SVG factory (shape+style → L.divIcon) ---
import L from "leaflet";
function shapeInnerSvg({ shape, fill, stroke, radius = 7, strokeWidth = 2 }) {
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
        } case "star": {
            const r = radius - strokeWidth / 2;
            const spikes = 5;
            const step = Math.PI / spikes;
            const pts = [];
            for (let i = 0; i < 2 * spikes; i++) {
                const len = i % 2 === 0 ? r : r / 2.5;
                const a = i * step - Math.PI / 2;
                pts.push(`${cx + Math.cos(a) * len},${cy + Math.sin(a) * len}`);
            }
            inner = `<polygon points="${pts.join(" ")}"
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }

        case "pentagon": {
            const r = radius - strokeWidth / 2;
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const a = (2 * Math.PI / 5) * i - Math.PI / 2;
                pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
            }
            inner = `<polygon points="${pts.join(" ")}"
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }

        case "wave": {
            const w = radius * 2 - strokeWidth;
            const h = radius;
            const path = `
            M ${cx - w / 2} ${cy}
            C ${cx - w / 4} ${cy - h / 2},
              ${cx} ${cy + h / 2},
              ${cx + w / 4} ${cy}
            S ${cx + w / 2} ${cy - h / 2},
              ${cx + w / 2} ${cy}
        `;
            inner = `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"
                        stroke-linecap="round" />`;
            break;
        }

        case "cross": {
            const r = radius - strokeWidth;
            const s = strokeWidth * 1.5;
            const rects = [
                `<rect x="${cx - s / 2}" y="${cy - r}" width="${s}" height="${2 * r}" />`,
                `<rect x="${cx - r}" y="${cy - s / 2}" width="${2 * r}" height="${s}" />`
            ];
            inner = `<g fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}">${rects.join("")}</g>`;
            break;
        }

        case "teardrop": {
            const r = radius - strokeWidth / 2;
            const path = `
            M ${cx} ${cy - r}
            C ${cx + r} ${cy - r / 3},
              ${cx + r / 2} ${cy + r},
              ${cx} ${cy + r}
            C ${cx - r / 2} ${cy + r},
              ${cx - r} ${cy - r / 3},
              ${cx} ${cy - r} Z
        `;
            inner = `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        }
        default:
            inner = `<circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth / 2}"
                          fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }

    return inner;
}

// Diagonal strike ("/") or cross ("✕") overlaid on a closed job's marker.
// Dark line with a thin white casing underneath so it reads on any fill.
// Sits right across the shape — barely past its edge.
function closedMarkSvg(kind, c, radius) {
    const e = radius + 1;
    const w = Math.max(1.3, radius * 0.22);
    const seg = (x1, y1, x2, y2) =>
        `<line x1="${(c + x1).toFixed(2)}" y1="${(c + y1).toFixed(2)}" x2="${(c + x2).toFixed(2)}" y2="${(c + y2).toFixed(2)}" />`;
    const lines = kind === "cross"
        ? seg(-e, -e, e, e) + seg(e, -e, -e, e)
        : seg(-e, e, e, -e); // "/"
    return `<g stroke="#ffffff" stroke-width="${(w + 1.1).toFixed(2)}" stroke-linecap="round">${lines}</g>` +
           `<g stroke="#12181e" stroke-width="${w.toFixed(2)}" stroke-linecap="round">${lines}</g>`;
}

// Red "!" pip in the NE corner — a job carrying an action-required tag.
function alertPipSvg(pad, d, radius) {
    const pr = Math.max(3.4, radius * 0.6);
    const halo = pr + 1.1;
    const x = pad + d - pr * 0.35;
    const y = pad + pr * 0.35;
    const n = (v) => v.toFixed(2);
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(halo)}" fill="#ffffff" />` +
           `<circle cx="${n(x)}" cy="${n(y)}" r="${n(pr)}" fill="#e5484d" stroke="rgba(0,0,0,0.3)" stroke-width="0.7" />` +
           `<g fill="#ffffff">` +
             `<rect x="${n(x - pr * 0.16)}" y="${n(y - pr * 0.55)}" width="${n(pr * 0.32)}" height="${n(pr * 0.72)}" rx="${n(pr * 0.16)}" />` +
             `<circle cx="${n(x)}" cy="${n(y + pr * 0.52)}" r="${n(pr * 0.17)}" />` +
           `</g>`;
}

export function makeShapeIcon({ shape, fill, stroke, radius = 7, strokeWidth = 2, closedMark = null, alert = false }) {
    const d = radius * 2;
    const inner = shapeInnerSvg({ shape, fill, stroke, radius, strokeWidth });

    if (!closedMark && !alert) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">
              ${inner}
            </svg>`;

        return L.divIcon({
            className: "job-svg-marker",
            html: svg,
            iconSize: [d, d],
            iconAnchor: [radius, radius],
            popupAnchor: [0, -radius],
            shapeDiameter: d
        });
    }

    // Padded symmetrically so iconAnchor stays at the shape centre; the pulse /
    // status rings key off `shapeDiameter` rather than this padded box.
    // ~radius*0.55 covers the "!" pip halo and the strike's small overhang.
    const pad = Math.ceil(radius * 0.55);
    const box = d + pad * 2;
    const c = pad + radius;

    let overlay = `<g transform="translate(${pad}, ${pad})">${inner}</g>`;
    if (closedMark) overlay += closedMarkSvg(closedMark, c, radius);
    if (alert) overlay += alertPipSvg(pad, d, radius);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">${overlay}</svg>`;

    return L.divIcon({
        className: "job-svg-marker",
        html: svg,
        iconSize: [box, box],
        iconAnchor: [c, c],
        popupAnchor: [0, -radius],
        shapeDiameter: d
    });
};

/**
 * SVG for the Active "marching ring" — a dashed circle in a spinning <g>.
 * Rotation (compositor-only) reads as marching ants at this size and is far
 * cheaper than animating stroke-dashoffset on every marker.
 */
export function buildStatusRingSvg(box, ringRadius, colour = ACTIVE_RING_COLOUR) {
    const c = box / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
              <g class="status-ring-spin" style="transform-box:fill-box;transform-origin:center">
                <circle cx="${c}" cy="${c}" r="${ringRadius}" fill="none" stroke="${colour}"
                        stroke-width="2.75" stroke-linecap="round" stroke-dasharray="4 3.5" />
              </g>
            </svg>`;
}

// Build icon style for a given job
export function styleForJob(job, { showStatus = false } = {}) {

    const style = jobsToUI(job)

    // // Emphasise Priority/Immediate with larger radius
    // const radius = (/^(Priority|Immediate)$/i.test(job.priorityName())) ? 8.5 : 7;
    const radius = 7

    const out = { shape: style.shape, fill: style.fillcolor, stroke: style.strokecolor, radius, strokeWidth: 2.25 };
    // tweak strokeWidth if you need stronger outlines

    // Only attach status keys when the option is on, so JSON.stringify(style)
    // (the change-detection key) is byte-identical to the old behaviour when off.
    // Note: the Active marching ring is a sibling layer, not part of this icon —
    // see upsertStatusRing() in jobMarker.js.
    if (showStatus) {
        const mark = statusClosedMark(job.statusName?.());
        if (mark) out.closedMark = mark;
        if ((job.actionRequiredTags?.() || []).length > 0) out.alert = true;
    }

    return out;
}

/**
 * Build an SVG outline that matches the marker shape, used as the pulse-ring
 * overlay.  `w`/`h` are the pixel dimensions of the ring's L.divIcon box.
 */
export function buildPulseRingSvg(shape, w, h) {
    const cx = w / 2, cy = h / 2;
    const sw = 2;
    const r = Math.min(w, h) / 2 - sw;

    let outline;
    switch (shape) {
        case "circle":
            outline = `<circle cx="${cx}" cy="${cy}" r="${r}" />`;
            break;
        case "square": {
            outline = `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="2" ry="2" />`;
            break;
        }
        case "diamond":
            outline = `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" />`;
            break;
        case "triangle": {
            const th = r * Math.sqrt(3);
            outline = `<polygon points="${cx},${cy - r} ${cx - th / 2},${cy + r / 2} ${cx + th / 2},${cy + r / 2}" />`;
            break;
        }
        case "hex": {
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
            }
            outline = `<polygon points="${pts.join(" ")}" />`;
            break;
        }
        case "star": {
            const spikes = 5, step = Math.PI / spikes, pts = [];
            for (let i = 0; i < 2 * spikes; i++) {
                const len = i % 2 === 0 ? r : r / 2.5;
                const a = i * step - Math.PI / 2;
                pts.push(`${cx + Math.cos(a) * len},${cy + Math.sin(a) * len}`);
            }
            outline = `<polygon points="${pts.join(" ")}" />`;
            break;
        }
        case "pentagon": {
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const a = (2 * Math.PI / 5) * i - Math.PI / 2;
                pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
            }
            outline = `<polygon points="${pts.join(" ")}" />`;
            break;
        }
        case "teardrop":
            outline = `<path d="M ${cx} ${cy - r} C ${cx + r} ${cy - r / 3}, ${cx + r / 2} ${cy + r}, ${cx} ${cy + r} C ${cx - r / 2} ${cy + r}, ${cx - r} ${cy - r / 3}, ${cx} ${cy - r} Z" />`;
            break;
        case "cross": {
            const s = r * 0.35;
            outline = `<path d="M${cx - s},${cy - r} h${2 * s} v${r - s} h${r - s} v${2 * s} h${-(r - s)} v${r - s} h${-(2 * s)} v${-(r - s)} h${-(r - s)} v${-(2 * s)} h${r - s}Z" />`;
            break;
        }
        default:
            outline = `<circle cx="${cx}" cy="${cy}" r="${r}" />`;
    }

    return `<svg class="pulse-ring-shape" xmlns="http://www.w3.org/2000/svg"
                width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
                <g fill="none" stroke="rgba(247,147,29,0.9)" stroke-width="${sw}">
                    ${outline}
                </g>
            </svg>`;
}




