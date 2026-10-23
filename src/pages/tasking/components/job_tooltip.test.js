// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Job } from '../models/Job.js';
import { buildJobTooltipHtml } from './job_tooltip.js';
import { Tasking } from '../models/Tasking.js';

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

describe('buildJobTooltipHtml ETA/ETC badges', () => {
    const fmt = (d) => {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    // 30 s short of the minute, so the rounded-up countdown reads exactly m.
    const inMinutes = (m) => fmt(new Date(Date.now() + m * 60000 - 30000));

    it('adds a badge per team with an ETA or ETC, and none for a Tasked team', () => {
        const job = makeJob();
        const enroute = new Tasking({ Id: 1, CurrentStatus: 'Enroute', EnrouteEstimatedCompletion: inMinutes(9) });
        enroute.team = { callsign: () => 'TEAM<1>' };
        const tasked = new Tasking({ Id: 2, CurrentStatus: 'Tasked' });
        tasked.team = { callsign: () => 'TEAM2' };
        job.taskings.push(enroute, tasked);

        const html = buildJobTooltipHtml(job);
        expect(html).toContain('eta-chip eta-chip--ok');
        expect(html).toContain('TEAM&lt;1&gt; &middot; ETA 9m');
        expect(html).not.toContain('TEAM2');
    });
});
