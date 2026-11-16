import { describe, it, expect } from 'vitest';
import { knownBeaconEnvironment, beaconSiteEnvironment, isKnownSignalRHub, isExtensionPage, pageParamsAllowed } from './beaconEnvironments.js';

const EXTENSION = { protocol: 'chrome-extension:' };
const HARNESS = { protocol: 'http:' };

describe('knownBeaconEnvironment', () => {
  it('knows each Beacon site with its own API host', () => {
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://beacon.ses.nsw.gov.au')).toBe('production');
    expect(knownBeaconEnvironment('https://apitrainbeacon.ses.nsw.gov.au', 'https://trainbeacon.ses.nsw.gov.au')).toBe('train');
    expect(knownBeaconEnvironment('https://apitestbeacon.ses.nsw.gov.au', 'https://testbeacon.ses.nsw.gov.au')).toBe('test');
    expect(knownBeaconEnvironment('https://apidevbeacon.ses.nsw.gov.au', 'https://devbeacon.ses.nsw.gov.au/')).toBe('dev');
  });

  it("refuses a site that isn't Beacon's, or an API host from another environment", () => {
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://evil.example')).toBeNull();
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://trainbeacon.ses.nsw.gov.au')).toBeNull();
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://beacon.ses.nsw.gov.au.evil.example')).toBeNull();
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://beacon.ses.nsw.gov.au@evil.example')).toBeNull();
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'http://beacon.ses.nsw.gov.au')).toBeNull();
    expect(knownBeaconEnvironment('https://apibeacon.ses.nsw.gov.au', 'https://previewbeacon.ses.nsw.gov.au')).toBeNull();
    expect(knownBeaconEnvironment('https://evil.example', 'https://beacon.ses.nsw.gov.au')).toBeNull();
    expect(knownBeaconEnvironment('', '')).toBeNull();
    expect(knownBeaconEnvironment(undefined, undefined)).toBeNull();
  });
});

describe('beaconSiteEnvironment', () => {
  it('knows each Beacon site', () => {
    expect(beaconSiteEnvironment('https://beacon.ses.nsw.gov.au')).toBe('production');
    expect(beaconSiteEnvironment('https://trainbeacon.ses.nsw.gov.au/')).toBe('train');
    expect(beaconSiteEnvironment('https://testbeacon.ses.nsw.gov.au')).toBe('test');
    expect(beaconSiteEnvironment('https://devbeacon.ses.nsw.gov.au')).toBe('dev');
  });

  it('is null for anything else', () => {
    expect(beaconSiteEnvironment('https://beacon.demo.test')).toBeNull();
    expect(beaconSiteEnvironment(undefined)).toBeNull();
  });
});

describe('isKnownSignalRHub', () => {
  it("accepts Beacon's hubs, with any path", () => {
    expect(isKnownSignalRHub('https://beacon-prod-comms.azurewebsites.net/hubs/beacon')).toBe(true);
    expect(isKnownSignalRHub('https://beacon-train-comms.azurewebsites.net/hubs/beacon?x=1')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isKnownSignalRHub('https://evil.example/hubs/beacon')).toBe(false);
    expect(isKnownSignalRHub('http://beacon-prod-comms.azurewebsites.net/hubs/beacon')).toBe(false);
    expect(isKnownSignalRHub('https://beacon-prod-comms.azurewebsites.net.evil.example/')).toBe(false);
    expect(isKnownSignalRHub('https://user@beacon-prod-comms.azurewebsites.net/')).toBe(false);
    expect(isKnownSignalRHub('not a url')).toBe(false);
  });
});

describe('pageParamsAllowed', () => {
  const prod = { host: 'https://apibeacon.ses.nsw.gov.au', source: 'https://beacon.ses.nsw.gov.au' };

  it('allows a known environment, with or without a Beacon hub', () => {
    expect(pageParamsAllowed(prod, EXTENSION)).toBe(true);
    expect(pageParamsAllowed({ ...prod, signalr: 'https://beacon-prod-comms.azurewebsites.net/hubs/beacon' }, EXTENSION)).toBe(true);
  });

  it('refuses an unknown site or hub on an extension page', () => {
    expect(pageParamsAllowed({ ...prod, source: 'https://evil.example' }, EXTENSION)).toBe(false);
    expect(pageParamsAllowed({ ...prod, signalr: 'https://evil.example/hubs/beacon' }, EXTENSION)).toBe(false);
    expect(pageParamsAllowed({}, EXTENSION)).toBe(false);
  });

  it("doesn't check the docs harnesses (not an extension page)", () => {
    expect(isExtensionPage(HARNESS)).toBe(false);
    expect(pageParamsAllowed({ host: 'https://beacon.demo.test', source: 'https://beacon.demo.test' }, HARNESS)).toBe(true);
  });
});
