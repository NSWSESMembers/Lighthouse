import { fmtRelative } from '../utils/common.js';

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
    const type = job.typeName?.() || '';
    const status = job.statusName?.() || '';
    const addr = job.addressDisplayOrGPS?.() || '';
    const received = job.jobReceived?.() ? fmtRelative(new Date(job.jobReceived())) : '';

    const titleBits = [id ? `#${id}` : null, priority || null, type || null].filter(Boolean).map(escapeHtml);
    const metaBits = [status || null, received || null].filter(Boolean).map(escapeHtml);

    return `
        <div class="job-tooltip__title">${titleBits.join(' &middot; ')}</div>
        ${addr ? `<div class="job-tooltip__addr">${escapeHtml(addr)}</div>` : ''}
        ${metaBits.length ? `<div class="job-tooltip__meta">${metaBits.join(' &middot; ')}</div>` : ''}
    `;
}
