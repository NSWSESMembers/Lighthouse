export const safeStr = v => (v == null ? "" : String(v));

export function fmtRelative(dateObj) {
    const now = Date.now();
    const t = dateObj.getTime();
    if (isNaN(t)) return "";
    const s = Math.max(0, Math.floor((now - t) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "yesterday";
    if (d < 7) return `${d}d ago`;
    const w = Math.floor(d / 7);
    return `${w}w ago`;
}

export const canon = s => (s || "")
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""); // drop hyphens, spaces, etc.