import { describe, it, expect } from 'vitest';
import { SMSRecipient } from './SMSRecipient.js';

describe('SMSRecipient', () => {
  it('defaults for an empty payload', () => {
    const r = new SMSRecipient();
    expect(r.id).toBeNull();
    expect(r.name).toBe('');
    expect(r.isTeamLeader).toBe(false);
    expect(r.selected()).toBe(true);
    expect(r.loading()).toBe(false);
    expect(r.beaconContact).toEqual([]);
  });

  it('maps plain (non-observable) fields from the payload', () => {
    const r = new SMSRecipient({ id: 1, name: 'Jane', isTeamLeader: true });
    expect(r.id).toBe(1);
    expect(r.name).toBe('Jane');
    expect(r.isTeamLeader).toBe(true);
  });

  it('honours an explicit selected: false', () => {
    const r = new SMSRecipient({ selected: false });
    expect(r.selected()).toBe(false);
  });

  it('displayLabel is a ko.observable when a truthy displayLabel is given', () => {
    const r = new SMSRecipient({ displayLabel: 'Jane (0400 000 000)' });
    expect(r.displayLabel()).toBe('Jane (0400 000 000)');
  });

  it('displayLabel is left falsy (not an observable) when omitted', () => {
    // `data.displayLabel && ko.observable(...)` short-circuits on a falsy
    // displayLabel, so r.displayLabel is left as that falsy value itself
    // (undefined here) rather than a callable observable.
    const r = new SMSRecipient({});
    expect(r.displayLabel).toBeUndefined();
  });
});
