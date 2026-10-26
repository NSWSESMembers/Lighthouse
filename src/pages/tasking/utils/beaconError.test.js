import { describe, it, expect } from 'vitest';
import { describeBeaconError } from './beaconError.js';
import { BeaconApiError } from '../../../shared/BeaconClient/core/request.js';

describe('describeBeaconError', () => {
    it("quotes Beacon's own message", () => {
        const err = new BeaconApiError(400, 'Bad Request', 'u', JSON.stringify({ Message: 'Cannot call off: Team has been onsite, team must be completed' }));
        expect(describeBeaconError(err)).toBe('Beacon said "Cannot call off: Team has been onsite, team must be completed"');
    });

    it('reads a bare JSON string body (as Tasking/{id}/Calloff sends)', () => {
        const err = new BeaconApiError(400, 'Bad Request', 'u', JSON.stringify('Cannot call off: Team has been onsite, team must be completed'));
        expect(describeBeaconError(err)).toBe('Beacon said "Cannot call off: Team has been onsite, team must be completed"');
    });

    it('falls back to ModelState, then to the status code', () => {
        expect(describeBeaconError(new BeaconApiError(400, 'Bad Request', 'u', JSON.stringify({ ModelState: { x: ['Bad time'] } }))))
            .toBe('Beacon said "Bad time"');
        expect(describeBeaconError(new BeaconApiError(500, 'Server Error', 'u', 'not json')))
            .toBe('Beacon returned an error (500 Server Error)');
    });

    it('explains auth failures, network errors and errors with a userMessage', () => {
        expect(describeBeaconError(new BeaconApiError(401, '', 'u', ''))).toMatch(/session may have expired/);
        expect(describeBeaconError(new TypeError('Failed to fetch'))).toBe("couldn't reach Beacon");
        expect(describeBeaconError({ userMessage: 'custom' })).toBe('custom');
    });
});
