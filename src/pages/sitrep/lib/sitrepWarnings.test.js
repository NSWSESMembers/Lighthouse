import { describe, it, expect } from 'vitest';
import { sitrepWarnings } from './sitrepWarnings.js';

const full = [{ heading: 'Situation', text: 'x' }, { heading: 'Impact', text: 'y' }];

describe('sitrepWarnings', () => {
  it('is empty when every section has text and a next time is set', () => {
    expect(sitrepWarnings({ sections: full, nextReportOption: 'scheduled', nextReportTime: new Date() })).toEqual([]);
  });
  it('lists blank sections (whitespace counts as blank)', () => {
    const w = sitrepWarnings({ sections: [{ heading: 'Situation', text: 'x' }, { heading: 'Impact', text: ' ' }, { heading: 'Safety', text: '' }], nextReportOption: 'none', nextReportTime: null });
    expect(w).toEqual(['Blank body sections: Impact, Safety']);
  });
  it('warns when a next sitrep is scheduled but no time is selected, not when none will be issued', () => {
    expect(sitrepWarnings({ sections: full, nextReportOption: 'scheduled', nextReportTime: null })).toEqual(['The next sitrep time has not been selected']);
    expect(sitrepWarnings({ sections: full, nextReportOption: 'none', nextReportTime: null })).toEqual([]);
  });
});
