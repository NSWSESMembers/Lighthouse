import { describe, it, expect } from 'vitest';
import moment from 'moment';
import { buildVersion } from './webpack.version.js';

const at = (time) => moment.parseZone(`2026-11-05T${time}:00+10:00`);
const timeParts = (version) => version.split('.').map(Number);

function isHigher(a, b) {
  const [x, y] = [timeParts(a), timeParts(b)];
  const i = x.findIndex((part, index) => part !== y[index]);
  return i !== -1 && x[i] > y[i];
}

describe('buildVersion', () => {
  it('keeps the minutes two digits wide', () => {
    expect(buildVersion(at('09:59'))).toBe('2026.11.5.959');
    expect(buildVersion(at('10:00'))).toBe('2026.11.5.1000');
    expect(buildVersion(at('12:04'))).toBe('2026.11.5.1204');
  });

  it('gives a same-day hotfix a higher version', () => {
    expect(buildVersion(at('12:10'))).toBe('2026.11.5.1210');
    expect(buildVersion(at('18:01'))).toBe('2026.11.5.1801');
    expect(isHigher(buildVersion(at('18:01')), buildVersion(at('12:10')))).toBe(true);
  });

  it('rises through every minute of the day and into the next', () => {
    const start = moment.parseZone('2026-11-05T00:00:00+10:00');
    let previous = buildVersion(start);
    for (let minute = 1; minute <= 24 * 60; minute += 1) {
      const version = buildVersion(start.clone().add(minute, 'minutes'));
      expect(isHigher(version, previous), `${version} after ${previous}`).toBe(true);
      previous = version;
    }
  });

  it('only produces parts Chrome accepts', () => {
    const start = moment.parseZone('2026-11-05T00:00:00+10:00');
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const parts = buildVersion(start.clone().add(minute, 'minutes')).split('.');
      expect(parts).toHaveLength(4);
      for (const part of parts) {
        expect(part).toMatch(/^(0|[1-9]\d*)$/);
        expect(Number(part)).toBeLessThanOrEqual(65535);
      }
    }
  });

  it('uses +10:00 whatever offset it is given, through the daylight saving change', () => {
    expect(buildVersion(moment.parseZone('2026-11-05T00:30:00Z'))).toBe('2026.11.5.1030');
    // Sydney clocks go back at 03:00 on 4 April 2027, a fixed offset doesn't.
    expect(isHigher(
      buildVersion(moment.parseZone('2027-04-03T16:30:00Z')),
      buildVersion(moment.parseZone('2027-04-03T15:45:00Z')),
    )).toBe(true);
  });

  it('leaves the moment it is given untouched', () => {
    const now = moment.parseZone('2026-11-05T00:30:00Z');
    buildVersion(now);
    expect(now.utcOffset()).toBe(0);
  });
});
