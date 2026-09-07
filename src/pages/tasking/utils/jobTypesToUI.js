
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

// Job status → pip colour. A lifecycle ramp kept clear of the priority hues
// below, shown on markers only when config.showJobStatusOnMarkers is enabled.
const statusPipMap = {
    "New":       "#e4661d", // orange (matches the "new" pulse ring)
    "Active":    "#159aab", // teal
    "Tasked":    "#6b52d6", // violet
    "Referred":  "#566f86", // slate
    "Complete":  "#2f8f5b", // green
    "Cancelled": "#8b949b", // grey
    "Finalised": "#5b636a", // dark grey
    "Rejected":  "#cc4460", // rose
};

// Job status → optional 1-glyph hint drawn inside the pip. New has no glyph
// (an empty pip reads as "untouched"); closed states share a glyph with their
// resolved-ok / resolved-not sibling and are told apart by colour.
const statusPipGlyphMap = {
    "Active":    "dot",       // live / being worked
    "Tasked":    "arrow",     // dispatched to a team
    "Referred":  "chevrons",  // forwarded elsewhere
    "Complete":  "check",
    "Cancelled": "cross",
    "Finalised": "check",
    "Rejected":  "cross",
};

// Resolve a job's status name to its pip colour (null for unknown/blank).
export function statusPipColor(statusName) {
    return statusPipMap[statusName] || null;
}

// Resolve a job's status name to its pip glyph key (null for none).
export function statusPipGlyph(statusName) {
    return statusPipGlyphMap[statusName] || null;
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