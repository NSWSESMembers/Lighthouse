// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Job } from '../models/Job.js';
import { buildJobTooltipHtml } from './job_tooltip.js';

function makeJob(overrides = {}) {
    return new Job({
        Identifier: '24-118432',
        JobPriorityType: { Id: 1, Name: 'Immediate' },
        JobStatusType: { Id: 4, Name: 'Tasked' },
        Address: { StreetLine1: '14 Grevillea St', Suburb: 'Springwood' },
        ...overrides,
    });
}

describe('buildJobTooltipHtml', () => {
    it('omits the situation and badge rows entirely when a job has neither', () => {
        const html = buildJobTooltipHtml(makeJob());
        expect(html).not.toContain('job-tooltip__sit');
        expect(html).not.toContain('job-tooltip__badges');
    });

    it('adds a situation-on-scene line, HTML-escaped', () => {
        const job = makeJob({ SituationOnScene: 'Smoke showing <roof>' });
        const html = buildJobTooltipHtml(job);
        expect(html).toContain('job-tooltip__sit');
        expect(html).toContain('Smoke showing &lt;roof&gt;');
    });

    it('surfaces an On Scene agency as a badge', () => {
        const job = makeJob();
        job._icemsAgenciesRaw.push({ Name: 'NSWRFS', ResourceStatusId: 4, AgencyStatusId: 3 }); // On Scene
        const html = buildJobTooltipHtml(job);
        expect(html).toContain('job-tooltip__badges');
        expect(html).toContain('NSWRFS');
        expect(html).toContain('On Scene');
    });

    it('still surfaces an agency that has only been Requested', () => {
        const job = makeJob();
        job._icemsAgenciesRaw.push({ Name: 'NSWPF', AgencyStatusId: 1 }); // Requested
        const html = buildJobTooltipHtml(job);
        expect(html).toContain('job-tooltip__badges');
        expect(html).toContain('NSWPF');
    });

    it('shows every agency, not just the most notable one', () => {
        const job = makeJob();
        job._icemsAgenciesRaw.push(
            { Name: 'ASNSW', ResourceStatusId: 1, AgencyStatusId: 3 }, // En Route
            { Name: 'NSWRFS', ResourceStatusId: 4, AgencyStatusId: 3 } // On Scene
        );
        const html = buildJobTooltipHtml(job);
        expect(html).toContain('NSWRFS');
        expect(html).toContain('ASNSW');
    });

    it('shows an action-required tag badge, with a +N overflow for extras', () => {
        const job = makeJob({
            ActionRequiredTags: [
                { Id: 1, Name: 'Callback Required', TagGroupId: 27 },
                { Id: 2, Name: 'Media Interest', TagGroupId: 27 },
            ],
        });
        const html = buildJobTooltipHtml(job);
        expect(html).toContain('Callback Required +1');
    });
});
