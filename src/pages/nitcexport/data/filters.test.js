import { describe, it, expect } from 'vitest';
import { nitcFilters, filtersText } from './filters.js';

describe('nitcFilters', () => {
  it('passes the NITC screen\'s filters on, with the HQs as EntityIds', () => {
    expect(nitcFilters('?hq=9001,9002&NonIncidentTypeIds=3,4&TagIds=7&IncludeCompleted=true', ['9001', '9002'])).toEqual({
      EntityIds: '9001,9002', NonIncidentTypeIds: '3,4', TagIds: '7', IncludeCompleted: 'true',
    });
  });

  it('leaves out filters that weren\'t set or are empty', () => {
    expect(nitcFilters('?NonIncidentTypeIds=&TagIds=,&IncludeCompleted=undefined', [])).toEqual({});
  });
});

describe('filtersText', () => {
  it('describes the filters', () => {
    expect(filtersText({ NonIncidentTypeIds: '3,4', TagIds: '7', IncludeCompleted: 'true' }))
      .toBe('Filtered to 2 task types and 1 tag, completed tasks included');
    expect(filtersText({ TagIds: '7,8' })).toBe('Filtered to 2 tags');
    expect(filtersText({ IncludeCompleted: 'false' })).toBe('Completed tasks left out');
    expect(filtersText({ EntityIds: '9001' })).toBe('');
  });
});
