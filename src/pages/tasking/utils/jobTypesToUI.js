
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

    result.shape = jobTypeParentCategoryShape[jobTypeParentCategoryKey(job)] || jobTypeParentCategoryShape.default; //shape is from the parent

    result.strokecolor = "#000000"; // default stroke color

    return result;
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
    console.log("jobTypeParentCategoryKey", cat);
    if (jobTypeParentCategoryShape[cat]) return cat; //check if exists
    return jobTypeParentCategoryShape.default;
}