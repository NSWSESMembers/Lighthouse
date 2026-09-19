import { describe, it, expect } from 'vitest';
import { buildSitrepPreviewText, roleAndName } from './formatSitrepText.js';

function baseArgs(overrides = {}) {
  return {
    header: { eventName: 'Flooding - New England', eventNumber: 'E-42', location: 'Tamworth', sitrepNumber: '3' },
    units: [{ id: 1, name: 'Parramatta Unit' }],
    windowStart: new Date('2026-01-01T00:00:00.000Z'),
    windowEnd: new Date('2026-01-02T00:00:00.000Z'),
    generatedAt: new Date('2026-01-02T01:00:00.000Z'),
    report: {
      incidentsReceived: 3,
      teamsActivated: 2,
      volunteersParticipating: 5,
      volunteersParticipatingNameOnly: 0,
      currentlyActivatedTeamIds: new Set(['t1']),
      dataCompleteness: { complete: true, issues: [] },
    },
    sectionCommentary: {},
    nextReport: { option: 'scheduled', time: new Date('2026-01-02T06:00:00.000Z') },
    authorisation: { preparedBy: 'J Smith', approvedBy: 'A Jones' },
    ...overrides,
  };
}

describe('buildSitrepPreviewText', () => {
  it('follows the template heading order: Situation, Impact, Resources, Execution, Emerging Issues, Prognosis, Safety', () => {
    const text = buildSitrepPreviewText(baseArgs());
    const order = ['SITUATION', 'IMPACT', 'RESOURCES', 'EXECUTION', 'EMERGING ISSUES', 'PROGNOSIS', 'SAFETY', 'AUTHORISATION', 'Produced by Lighthouse Sitrep Generator'];
    let lastIndex = -1;
    order.forEach((heading) => {
      const index = text.indexOf(heading);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    });
  });

  it('opens with the header block: report number, date, event, location, reporting period', () => {
    const text = buildSitrepPreviewText(baseArgs({ header: { ...baseArgs().header, sitrepTime: new Date('2026-01-02T01:00:00.000Z') } }));
    const lines = text.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'SITUATION REPORT #3',
      'Sitrep Date: 02/01/2026 12:00hrs',
      'Event: E-42 Flooding - New England',
      'Location: Tamworth',
      'Reporting Period: 01/01/2026 11:00 to 02/01/2026 11:00 AEDT',
    ]);
  });

  it('renders the Situation and Resources textareas as written (the generated figures live in them, not added on top)', () => {
    const text = buildSitrepPreviewText(
      baseArgs({ sectionCommentary: { situation: 'Incidents received during the period: 3', resources: 'Unique teams activated at any point during the period: 2' } }),
    );
    const situationBlock = text.slice(text.indexOf('SITUATION\n'), text.indexOf('IMPACT'));
    const resourcesBlock = text.slice(text.indexOf('RESOURCES'), text.indexOf('EXECUTION'));
    expect(situationBlock).toContain('Incidents received during the period: 3');
    expect(resourcesBlock).toContain('Unique teams activated at any point during the period: 2');
    expect(text.match(/Incidents received/g)).toHaveLength(1);
  });

  it('includes operator commentary for a section when present', () => {
    const text = buildSitrepPreviewText(baseArgs({ sectionCommentary: { impact: 'Roads closed in the valley.' } }));
    const impactBlock = text.slice(text.indexOf('IMPACT'), text.indexOf('RESOURCES'));
    expect(impactBlock).toContain('Roads closed in the valley.');
  });

  it('marks an empty non-auto-populated section rather than silently omitting it', () => {
    const text = buildSitrepPreviewText(baseArgs());
    const safetyBlock = text.slice(text.indexOf('SAFETY'), text.indexOf('DATA COMPLETENESS'));
    expect(safetyBlock).toContain('(no commentary entered)');
  });

  it('keeps data completeness out of the sitrep itself (it is shown beside it)', () => {
    const text = buildSitrepPreviewText(baseArgs());
    expect(text).not.toContain('DATA COMPLETENESS');
  });

  it('states the scheduled next-report time, or that none will be issued', () => {
    const scheduled = buildSitrepPreviewText(baseArgs());
    expect(scheduled).toMatch(/next situation report will be issued at/);

    const unset = buildSitrepPreviewText(baseArgs({ nextReport: { option: 'scheduled', time: null } }));
    expect(unset).toContain('Unless there is a significant change, the next situation report will be issued at TBC.');

    const none = buildSitrepPreviewText(baseArgs({ nextReport: { option: 'none' } }));
    expect(none).toContain('No further situation reports will be issued for this event.');
  });

  it('shows a header line even when its value is not set yet', () => {
    const lines = buildSitrepPreviewText(baseArgs({ header: {}, windowStart: null, windowEnd: null })).split('\n');
    expect(lines.slice(0, 5)).toEqual(['SITUATION REPORT', 'Sitrep Date: ', 'Event: ', 'Location: ', 'Reporting Period: ']);
  });

  it('puts the footer after the authorisation block, then Scope and Generated beneath it', () => {
    const lines = buildSitrepPreviewText(baseArgs()).split('\n');
    const footer = lines.indexOf('Produced by Lighthouse Sitrep Generator');
    expect(footer).toBeGreaterThan(lines.indexOf('AUTHORISATION'));
    expect(lines[footer + 2]).toBe('- Scope: Parramatta Unit');
    expect(lines[footer + 3]).toMatch(/^- Generated: /);
    // and not in the header any more
    expect(lines.slice(0, footer - 1).some((l) => /^(- )?(Scope|Generated):/.test(l))).toBe(false);
  });

  it('lists sector/event filters with the scope when set', () => {
    const text = buildSitrepPreviewText(baseArgs({ sectorLabel: 'North', eventLabel: '6/1718 - Flood' }));
    expect(text).toContain('- Sector filter: North');
    expect(text).toContain('- Event filter: 6/1718 - Flood');
  });

  it('includes the authorisation block', () => {
    const text = buildSitrepPreviewText(baseArgs());
    expect(text).toContain('Prepared By: J Smith');
    expect(text).toContain('Approved By: A Jones');
  });
});

describe('buildSitrepPreviewText before the first generate (no report)', () => {
  it('renders the operator-entered text live, without metric lines or a data-completeness block', () => {
    const text = buildSitrepPreviewText(
      baseArgs({ report: null, windowStart: null, windowEnd: null, generatedAt: null, sectionCommentary: { situation: 'Rain easing.' } }),
    );
    expect(text).toContain('Event: E-42 Flooding - New England');
    expect(text).toContain('Rain easing.');
    expect(text).not.toContain('Incidents received');
    expect(text).not.toContain('DATA COMPLETENESS');
    expect(text).toContain('Reporting Period: \n');
    expect(text).toContain('Prepared By: J Smith');
  });
});

describe('authorisation roles', () => {
  it('prints each role before the name: "Situation Officer, Jane Smith"', () => {
    const text = buildSitrepPreviewText(
      baseArgs({ authorisation: { preparedByRole: 'Situation Officer', preparedBy: 'Jane Smith', approvedByRole: 'Incident Controller', approvedBy: 'Homer Simpson' } }),
    );
    expect(text).toContain('Prepared By: Situation Officer, Jane Smith');
    expect(text).toContain('Approved By: Incident Controller, Homer Simpson');
  });
  it('handles a name or role on its own, or neither', () => {
    expect(roleAndName('', 'Jane Smith')).toBe('Jane Smith');
    expect(roleAndName(' Controller ', '')).toBe('Controller');
    expect(roleAndName(undefined, undefined)).toBe('');
  });
});
