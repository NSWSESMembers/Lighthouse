import {jobsToUI} from "../utils/jobTypesToUI.js";

// --- SVG factory (shape+style → L.divIcon) ---
import L from "leaflet";
export function makeShapeIcon({ shape, fill, stroke, radius = 7, strokeWidth = 2 }) {
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

// Build icon style for a given job
export function styleForJob(job) {

    const style = jobsToUI(job)

    // // Emphasise Priority/Immediate with larger radius
    // const radius = (/^(Priority|Immediate)$/i.test(job.priorityName())) ? 8.5 : 7;
    const radius = 7
    
    return { shape: style.shape, fill: style.fillcolor, stroke: style.strokecolor, radius, strokeWidth: 2.25 };
    // tweak strokeWidth if you need stronger outlines
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




