import { describe, it, expect } from 'vitest';
import { buildRadioLogPayload, validateRadioLogDraft } from './radioLogPayload.js';

describe('buildRadioLogPayload', () => {
  it('maps callsign/message to Subject/Text and includes the HQ and tags', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6] });
    expect(payload).toMatchObject({ EntityId: 5, Subject: 'RESCUE1', Text: 'On scene', TagIds: [6] });
  });

  it('defaults job/event/timeLogged to null for the primary (non-retrospective) workflow', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6] });
    expect(payload.JobId).toBeNull();
    expect(payload.EventId).toBeNull();
    expect(payload.TimeLogged).toBeNull();
  });

  it('carries an explicit retrospective TimeLogged through unchanged', () => {
    const payload = buildRadioLogPayload({
      entityId: 5,
      callsign: 'RESCUE1',
      message: 'On scene',
      tagIds: [6],
      timeLogged: '2026-01-01T00:00:00.000Z',
    });
    expect(payload.TimeLogged).toBe('2026-01-01T00:00:00.000Z');
  });

  it('carries an optional incident/event association through', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6], jobId: 'job1', eventId: 'event1' });
    expect(payload.JobId).toBe('job1');
    expect(payload.EventId).toBe('event1');
  });

  it('uses the resolved TalkgroupId when a lookup match was found', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6], talkgroupId: 42 });
    expect(payload.TalkgroupId).toBe(42);
    expect(payload.Text).toBe('On scene'); // not duplicated into the text when a real id is set
  });

  it('treats a resolved TalkgroupId of 0 as resolved, not as "nothing resolved"', () => {
    const payload = buildRadioLogPayload({
      entityId: 5,
      callsign: 'RESCUE1',
      message: 'On scene',
      tagIds: [6],
      talkgroupId: 0,
      talkgroupFreeText: 'SES OPS 1',
    });
    expect(payload.TalkgroupId).toBe(0);
    expect(payload.Text).toBe('On scene'); // the free-text fallback must not also be prepended
  });

  it('falls back to prepending free text when no talkgroup could be resolved', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6], talkgroupFreeText: 'SES OPS 1' });
    expect(payload.Text).toBe('Talkgroup: SES OPS 1\nOn scene');
    expect(payload.TalkgroupId).toBeNull();
  });

  it('leaves the message untouched when no talkgroup is given at all', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6] });
    expect(payload.Text).toBe('On scene');
  });

  it('carries important/restricted/actionRequired/actionReminder through', () => {
    const payload = buildRadioLogPayload({
      entityId: 5,
      callsign: 'RESCUE1',
      message: 'On scene',
      tagIds: [6],
      important: true,
      restricted: true,
      actionRequired: true,
      actionReminder: '2026-01-01T12:30:00.000Z',
    });
    expect(payload).toMatchObject({
      Important: true,
      Restricted: true,
      ActionRequired: true,
      ActionReminder: '2026-01-01T12:30:00.000Z',
    });
  });

  it('defaults important/restricted/actionRequired/actionReminder to unset', () => {
    const payload = buildRadioLogPayload({ entityId: 5, callsign: 'RESCUE1', message: 'On scene', tagIds: [6] });
    expect(payload).toMatchObject({ Important: false, Restricted: false, ActionRequired: false, ActionReminder: null });
  });
});

describe('validateRadioLogDraft', () => {
  it('passes a complete draft', () => {
    expect(validateRadioLogDraft({ callsign: 'RESCUE1', message: 'On scene', tagIds: [6] })).toEqual([]);
  });

  it('requires a callsign', () => {
    expect(validateRadioLogDraft({ callsign: '', message: 'On scene', tagIds: [6] })).toContain('Callsign is required.');
    expect(validateRadioLogDraft({ callsign: '   ', message: 'On scene', tagIds: [6] })).toContain('Callsign is required.');
  });

  it('requires message text', () => {
    expect(validateRadioLogDraft({ callsign: 'RESCUE1', message: '', tagIds: [6] })).toContain('Message text is required.');
  });

  it('requires at least one tag', () => {
    expect(validateRadioLogDraft({ callsign: 'RESCUE1', message: 'On scene', tagIds: [] })).toContain('At least one tag must be selected.');
  });

  it('reports every violated rule at once', () => {
    expect(validateRadioLogDraft({ callsign: '', message: '', tagIds: [] })).toHaveLength(3);
  });
});
