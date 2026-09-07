
//pass a job object, get UI style info
export function jobsToUI(job) {
    const result = {};
    const type = job.typeName?.();
    if (type === "FR") {
        const category = job.categoriesName?.();
        result.fillcolor = floodCatStroke[category] || "#0EA5E9"; // default blue
    } else {
        const p = job.jobPriorityType?.();
        result.fillcolor = priorityStroke[p?.Name] || "#6b7280ff"; // default gray
    }

    result.shape = jobTypeShape[type]
        || jobTypeParentCategoryShape[jobTypeParentCategoryKey(job)]
        || jobTypeParentCategoryShape.default;

    result.strokecolor = "#000000"; // default stroke color

    return result;
}

// ── Status on markers (config.showJobStatusOnMarkers) ─────────────────────
// New       → orange pulse ring (existing, unchanged)
// Active    → magenta marching ring (drawn as a spinning dashed <g>)
// Tasked    → nothing (a job someone is on shouldn't compete for attention)
// Complete / Referred / Finalised → struck through  "/"
// Cancelled / Rejected            → crossed out      "✕"
// Any status with an action-required tag → red "!" pip, NE corner
export const ACTIVE_RING_COLOUR = "#e5399b"; // magenta — clear of orange + priority fills

const CLOSED_RESOLVED = new Set(["Complete", "Referred", "Finalised"]);
const CLOSED_DEAD = new Set(["Cancelled", "Rejected"]);

// "strike" (resolved) | "cross" (dead) | null
export function statusClosedMark(statusName) {
    if (CLOSED_RESOLVED.has(statusName)) return "strike";
    if (CLOSED_DEAD.has(statusName)) return "cross";
    return null;
}

// Does this status get the marching ring?
export function statusHasRing(statusName) {
    return statusName === "Active";
}

// Priority → stroke color
const priorityStroke = {
    "Priority": "#FFA500",  // goldy yellow
    "Immediate": "#4F92FF",  // blue
    "Rescue": "#FF0000",  // red
    "General": "#0fcb35ff"   // green
};

// Flood Rescue categories → stroke color (overrides priority if job is Flood Rescue)
const floodCatStroke = {
    "Category1": "#7F1D1D", // Critical assistance
    "Category2": "#DC2626", // Imminent threat
    "Category3": "#EA580C", // Trapped - rising
    "Category4": "#EAB308", // Trapped - stable
    "Category5": "#16A34A", // Animal rescue
};

// Concrete job type overrides take precedence over parent-category shapes.
const jobTypeShape = {
    "FR": "pentagon",
};

const jobTypeParentCategoryShape = {
    "Storm": "circle",
    "Support": "square",
    "FloodSupport": "triangle",
    "Rescue": "diamond",
    "Tsunami": "star",
    default: "circle"
};



function jobTypeParentCategoryKey(job) {
    // pick first matching known category if present
    const cat = job.categoriesParent();
    if (jobTypeParentCategoryShape[cat]) return cat; //check if exists
    return jobTypeParentCategoryShape.default;
}