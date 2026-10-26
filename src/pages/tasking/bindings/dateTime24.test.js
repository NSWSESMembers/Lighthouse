// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ko from 'knockout';
import { parseTime24 } from './dateTime24.js';

describe('parseTime24', () => {
    it('accepts 24-hour times with or without a separator', () => {
        expect(parseTime24('1045')).toBe('10:45');
        expect(parseTime24('10:45')).toBe('10:45');
        expect(parseTime24('9.05')).toBe('09:05');
        expect(parseTime24(' 23:59 ')).toBe('23:59');
        expect(parseTime24('0000')).toBe('00:00');
    });

    it('rejects anything that is not a valid 24-hour time', () => {
        for (const bad of ['', '24:00', '12:60', '10:4', 'ab:cd', '10:45pm', '123456']) {
            expect(parseTime24(bad)).toBeNull();
        }
    });
});

describe('dateTime24 binding', () => {
    let obs, date, time;
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0));
        document.body.innerHTML = '<div id="dt"></div>';
        obs = ko.observable('2026-10-15T09:18');
        ko.applyBindingsToNode(document.getElementById('dt'), { dateTime24: obs });
        [date, time] = document.querySelectorAll('#dt input');
    });
    afterEach(() => vi.useRealTimers());

    const type = (el, value, event = 'input') => { el.value = value; el.dispatchEvent(new Event(event)); };

    it('shows the value as a date and a 24-hour time', () => {
        expect(date.value).toBe('2026-10-15');
        expect(time.value).toBe('09:18');
        obs('2026-10-15T21:05');
        expect(time.value).toBe('21:05');
    });

    it('writes a valid typed time, keeping the date', () => {
        type(time, '2130');
        expect(obs()).toBe('2026-10-15T21:30');
        type(date, '2026-10-16', 'change');
        expect(obs()).toBe('2026-10-16T21:30');
    });

    it('marks an invalid time and leaves the value alone', () => {
        type(time, '25:00');
        expect(time.classList.contains('is-invalid')).toBe(true);
        expect(obs()).toBe('2026-10-15T09:18');
    });

    it('defaults the date to today when only a time is given, and clears when both are empty', () => {
        obs(null);
        expect(date.value).toBe('');
        type(time, '1130');
        expect(obs()).toBe('2026-10-15T11:30');
        type(time, '');
        type(date, '', 'change');
        expect(obs()).toBeNull();
    });
});
