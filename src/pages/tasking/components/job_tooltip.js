function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Bootstrap badge classes already computed by Job.icemsAgencies() for the
// full agency badges in the click-popup -- reused here just to pick a dot
// colour per agency, not to render a Bootstrap badge.
const AGENCY_DOT_COLOR = {
    'bg-success': '#16a34a',            // On Scene / Responded
    'bg-primary': '#2563eb',            // En Route
    'bg-info text-dark': '#0891b2',     // Acknowledged / Will Attend
    'bg-warning text-dark': '#b45309',  // Requested / Sent
    'bg-secondary': '#6b7280',          // Left Scene / Closed
    'bg-danger': '#dc2626',             // Will Not Attend / Timeout
    'bg-light text-dark': '#9ca3af',    // No status available
};

/** Every ICEMS agency involved, decorated with a dot colour for the tooltip. */
function agencyBadges(job) {
    return (job.icemsAgencies?.() || []).map(a => ({
        name: a.name,
        statusLabel: a.statusLabel,
        dotColor: AGENCY_DOT_COLOR[a.badgeClass] || '#6b7280',
    }));
}

/**
 * Compact hover-tooltip content for a job/incident marker -- a quick
 * "what is this" glance, not a substitute for the full popup. Kept to a
 * handful of the most identifying fields on purpose: a tooltip that grows
 * as tall as the popup defeats the point of having a lighter-weight hover.
 */
export function buildJobTooltipHtml(job) {
    const id = job.identifierTrimmed?.() || job.identifier?.() || '';
    const priority = job.priorityName?.() || '';
    // Matches the "type + category" combo used elsewhere (e.g. the SMS
    // prefill in main.js) -- categoriesNameNumberDash already carries its
    // own leading dash (e.g. "-1", "-Orange"), so no separator is added.
    const type = (job.typeShort?.() || '') + (job.categoriesNameNumberDash?.() || '');
    const status = job.statusName?.() || '';
    const addr = job.addressDisplayOrGPS?.() || '';
    // Matches the popup's own footer (job_popup.js), which shows
    // entityAssignedTo.name for the same field.
    const unit = job.entityAssignedTo?.name?.() || job.entityAssignedTo?.code?.() || '';
    const situation = (job.situationOnScene?.() || '').trim();

    const titleBits = [id ? `#${id}` : null, priority || null, type || null].filter(Boolean).map(escapeHtml);
    const metaBits = [status || null, unit || null].filter(Boolean).map(escapeHtml);

    // Badges are deliberately opt-in per job -- the row only appears when
    // there's something to show, so a quiet/new job's tooltip stays as
    // small as today's rather than always reserving the row.
    const badges = agencyBadges(job).map(a =>
        `<span class="job-tooltip__badge" title="${escapeHtml(a.statusLabel)}"><span class="job-tooltip__badge-dot" style="background:${a.dotColor}"></span>${escapeHtml(a.name)}</span>`
    );
    const actionTags = job.actionRequiredTags?.() || [];
    if (actionTags.length) {
        const first = actionTags[0].name?.() || '';
        const label = actionTags.length > 1 ? `${first} +${actionTags.length - 1}` : first;
        if (label) badges.push(`<span class="job-tooltip__badge job-tooltip__badge--warn">${escapeHtml(label)}</span>`);
    }

    return `
        <div class="job-tooltip__title">${titleBits.join(' &middot; ')}</div>
        ${addr ? `<div class="job-tooltip__addr">${escapeHtml(addr)}</div>` : ''}
        ${situation ? `<div class="job-tooltip__sit">${escapeHtml(situation)}</div>` : ''}
        ${metaBits.length ? `<div class="job-tooltip__meta">${metaBits.join(' &middot; ')}</div>` : ''}
        ${badges.length ? `<div class="job-tooltip__badges">${badges.join('')}</div>` : ''}
    `;
}
