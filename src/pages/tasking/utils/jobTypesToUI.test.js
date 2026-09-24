import { describe, it, expect } from 'vitest';
import { jobsToUI, statusClosedMark, statusHasRing, ACTIVE_RING_COLOUR } from './jobTypesToUI.js';

function jobStub({ typeName = '', category = null, priorityName = null, parentCategory = 'Storm' } = {}) {
  return {
    typeName: () => typeName,
    categoriesName: () => category,
    jobPriorityType: () => (priorityName ? { Name: priorityName } : null),
    categoriesParent: () => parentCategory,
  };
}

describe('jobsToUI fillcolor', () => {
  it('uses the flood-rescue category colour for FR jobs', () => {
    const job = jobStub({ typeName: 'FR', category: 'Category3' });
    expect(jobsToUI(job).fillcolor).toBe('#EA580C');
  });

  it('falls back to the default blue for an unrecognised FR category', () => {
    const job = jobStub({ typeName: 'FR', category: 'CategoryUnknown' });
    expect(jobsToUI(job).fillcolor).toBe('#0EA5E9');
  });

  it('uses the priority colour for non-FR jobs', () => {
    const job = jobStub({ typeName: 'Storm', priorityName: 'Rescue' });
    expect(jobsToUI(job).fillcolor).toBe('#FF0000');
  });

  it('falls back to grey for an unrecognised priority', () => {
    const job = jobStub({ typeName: 'Storm', priorityName: null });
    expect(jobsToUI(job).fillcolor).toBe('#6b7280ff');
  });
});

describe('jobsToUI shape', () => {
  it('uses the concrete type shape override for FR (pentagon)', () => {
    const job = jobStub({ typeName: 'FR', parentCategory: 'Rescue' });
    expect(jobsToUI(job).shape).toBe('pentagon');
  });

  it('falls back to the parent-category shape for a type with no override', () => {
    const job = jobStub({ typeName: 'SomethingElse', parentCategory: 'Tsunami' });
    expect(jobsToUI(job).shape).toBe('star');
  });

  it('falls back to the default shape for an unrecognised parent category', () => {
    const job = jobStub({ typeName: 'SomethingElse', parentCategory: 'Nonexistent' });
    expect(jobsToUI(job).shape).toBe('circle');
  });

  it('always sets a black strokecolor', () => {
    const job = jobStub();
    expect(jobsToUI(job).strokecolor).toBe('#000000');
  });
});

describe('statusClosedMark', () => {
  it.each(['Complete', 'Referred', 'Finalised'])('marks %s as "strike"', (status) => {
    expect(statusClosedMark(status)).toBe('strike');
  });

  it.each(['Cancelled', 'Rejected'])('marks %s as "cross"', (status) => {
    expect(statusClosedMark(status)).toBe('cross');
  });

  it('returns null for an open status', () => {
    expect(statusClosedMark('Active')).toBeNull();
    expect(statusClosedMark('Tasked')).toBeNull();
  });
});

describe('statusHasRing', () => {
  it('is true only for Active', () => {
    expect(statusHasRing('Active')).toBe(true);
    expect(statusHasRing('New')).toBe(false);
    expect(statusHasRing('Tasked')).toBe(false);
  });
});

describe('ACTIVE_RING_COLOUR', () => {
  it('is a stable, exported hex colour', () => {
    expect(ACTIVE_RING_COLOUR).toBe('#e5399b');
  });
});
