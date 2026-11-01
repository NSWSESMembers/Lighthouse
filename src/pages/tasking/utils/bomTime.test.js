import { describe, it, expect } from 'vitest';
import { utcHourIso } from './bomTime.js';

describe('utcHourIso', () => {
    it('rounds down to the start of the UTC hour', () => {
        expect(utcHourIso(new Date('2026-11-01T06:59:59.999Z'))).toBe('2026-11-01T06:00:00Z');
    });

    it('keeps a time already on the hour', () => {
        expect(utcHourIso(new Date('2026-11-01T07:00:00Z'))).toBe('2026-11-01T07:00:00Z');
    });

    it('uses UTC, not Sydney time, across the date line', () => {
        // 10:30 on 2 Nov in Sydney (AEDT, +11) is 23:30 on 1 Nov UTC
        expect(utcHourIso(new Date('2026-11-02T10:30:00+11:00'))).toBe('2026-11-01T23:00:00Z');
    });

    it('does not change the date passed in', () => {
        const d = new Date('2026-11-01T06:45:00Z');
        utcHourIso(d);
        expect(d.toISOString()).toBe('2026-11-01T06:45:00.000Z');
    });
});
