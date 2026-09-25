function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Bootstrap badge classes already computed by Job.icemsAgencies() for the
// full agency badges in the click-popup -- reused here just to decide which
// dot colour (if any) to show, not to render a Bootstrap badge.
const AGENCY_DOT_COLOR = {
    'bg-success': '#16a34a', // On Scene / Responded
    'bg-primary': '#2563eb', // En Route
};

/**
 * Pick the single most notable agency to surface in the tooltip -- On Scene
 * beats En Route beats everything else (Requested/Acknowledged/Closed/
 * Timeout/Will Not Attend). Showing every agency, or agencies that haven't
 * actually turned up yet, would fire on nearly every multi-agency job and
 * stop meaning anything.
 */
function bestAgencyBadge(job) {
    const agencies = job.icemsAgencies?.() || [];
    let best = null;
    for (const a of agencies) {
        const rank = a.badgeClass === 'bg-success' ? 2 : a.badgeClass === 'bg-primary' ? 1 : 0;
        if (rank > 0 && (!best || rank > best.rank)) best = { ...a, rank };
    }
    return best;
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

    // Badges are deliberately opt-in per job -- each only appears when
    // there's something worth flagging, so a quiet/new job's tooltip stays
    // as small as today's rather than always reserving the row.
    const badges = [];
    const agency = bestAgencyBadge(job);
    if (agency) {
        const dotColor = AGENCY_DOT_COLOR[agency.badgeClass] || '#6b7280';
        badges.push(
            `<span class="job-tooltip__badge"><span class="job-tooltip__badge-dot" style="background:${dotColor}"></span>${escapeHtml(agency.name)} ${escapeHtml(agency.statusLabel)}</span>`
        );
    }
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
