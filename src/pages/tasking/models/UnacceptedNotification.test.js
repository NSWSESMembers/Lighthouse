import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnacceptedNotification } from './UnacceptedNotification.js';

describe('isIumMessage', () => {
  it.each([13, 14])('is true for type %i when there is an externalRefId', (typeId) => {
    const n = new UnacceptedNotification({ NotificationTypeId: typeId, ExternalRefId: 'ref1' });
    expect(n.isIumMessage()).toBe(true);
  });

  it('is false for a non-IUM type even with a refId', () => {
    const n = new UnacceptedNotification({ NotificationTypeId: 1, ExternalRefId: 'ref1' });
    expect(n.isIumMessage()).toBe(false);
  });

  it('is falsy for an IUM type with no externalRefId', () => {
    // `hasRefId && (...)` short-circuits to hasRefId itself (null here, from
    // the ?? null default) rather than being coerced to boolean false.
    const n = new UnacceptedNotification({ NotificationTypeId: 13 });
    expect(n.isIumMessage()).toBeFalsy();
  });
});

describe('acknowledge', () => {
  it('acknowledges a plain (non-IUM) notification', async () => {
    const acknowledgeNotification = vi.fn().mockResolvedValue();
    const acknowledgeIumMessage = vi.fn();
    const onAcknowledged = vi.fn();
    const n = new UnacceptedNotification({ Id: 'n1', NotificationTypeId: 1 }, { acknowledgeNotification, acknowledgeIumMessage, onAcknowledged });

    await n.acknowledge();

    expect(acknowledgeNotification).toHaveBeenCalledWith('n1');
    expect(acknowledgeIumMessage).not.toHaveBeenCalled();
    expect(n.acknowledged()).toBeInstanceOf(Date);
    expect(onAcknowledged).toHaveBeenCalledWith(n);
    expect(n.isAcknowledging()).toBe(false);
  });

  it('also acknowledges via the IUM endpoint for an IUM message', async () => {
    const acknowledgeNotification = vi.fn().mockResolvedValue();
    const fetchMessageById = vi.fn().mockResolvedValue({ Id: 'msg1' });
    const acknowledgeIumMessage = vi.fn().mockResolvedValue();
    const n = new UnacceptedNotification(
      { Id: 'n1', NotificationTypeId: 13, ExternalRefId: 'ref1' },
      { acknowledgeNotification, fetchMessageById, acknowledgeIumMessage },
    );

    await n.acknowledge();

    expect(fetchMessageById).toHaveBeenCalledWith('ref1');
    expect(acknowledgeIumMessage).toHaveBeenCalledWith('n1', { Id: 'msg1' });
  });

  it('is a no-op while already acknowledging (re-entrancy guard)', async () => {
    let resolveFirst;
    const acknowledgeNotification = vi.fn(() => new Promise((r) => { resolveFirst = r; }));
    const n = new UnacceptedNotification({ Id: 'n1' }, { acknowledgeNotification });

    const first = n.acknowledge();
    const second = n.acknowledge(); // should return immediately without calling acknowledgeNotification again
    resolveFirst();
    await Promise.all([first, second]);

    expect(acknowledgeNotification).toHaveBeenCalledTimes(1);
  });

  it('reports failure via onAcknowledgeError and clears isAcknowledging without setting acknowledged', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('network down');
    const acknowledgeNotification = vi.fn().mockRejectedValue(err);
    const onAcknowledgeError = vi.fn();
    const n = new UnacceptedNotification({ Id: 'n1' }, { acknowledgeNotification, onAcknowledgeError });

    await n.acknowledge();

    expect(onAcknowledgeError).toHaveBeenCalledWith(err, n);
    expect(n.acknowledged()).toBeNull();
    expect(n.isAcknowledging()).toBe(false);
    errorSpy.mockRestore();
  });
});

describe('createdOnAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('depends on relativeUpdateTick when provided', () => {
    const tick = vi.fn(() => 0);
    const n = new UnacceptedNotification({ CreatedOn: '2026-01-01T11:00:00.000Z' }, { relativeUpdateTick: tick });
    n.createdOnAgo();
    expect(tick).toHaveBeenCalled();
  });

  it('is blank with no createdOn', () => {
    const n = new UnacceptedNotification({});
    expect(n.createdOnAgo()).toBe('');
  });
});
