import { describe, it, expect, vi } from 'vitest';
import { hostPatternFor, optionalPatternFor, needsHostPermission, requestHostPermission } from './optionalHostPermission.js';

const TEST_HUB = 'https://beacon-test-comms.azurewebsites.net/hubs/beacon?x=1';
const PROD_HUB = 'https://beacon-prod-comms.azurewebsites.net/hubs/beacon';
const manifest = {
    host_permissions: ['https://beacon-prod-comms.azurewebsites.net/*'],
    optional_host_permissions: ['https://beacon-test-comms.azurewebsites.net/*'],
};

function fakeChrome({ granted = false, grant = true } = {}) {
    return {
        runtime: { getManifest: () => manifest },
        permissions: {
            contains: vi.fn(async () => granted),
            request: vi.fn(async () => grant),
        },
    };
}

describe('hostPatternFor', () => {
    it('turns a URL into an origin match pattern', () => {
        expect(hostPatternFor(TEST_HUB)).toBe('https://beacon-test-comms.azurewebsites.net/*');
        expect(hostPatternFor('not a url')).toBeNull();
    });
});

describe('optionalPatternFor', () => {
    it('only returns hosts listed as optional', () => {
        expect(optionalPatternFor(TEST_HUB, manifest)).toBe('https://beacon-test-comms.azurewebsites.net/*');
        expect(optionalPatternFor(PROD_HUB, manifest)).toBeNull();
        expect(optionalPatternFor(TEST_HUB, {})).toBeNull();
        expect(optionalPatternFor(TEST_HUB, undefined)).toBeNull();
    });
});

describe('needsHostPermission', () => {
    it('is true for an optional host that is not granted', async () => {
        const chromeApi = fakeChrome({ granted: false });
        expect(await needsHostPermission(TEST_HUB, chromeApi)).toBe(true);
        expect(chromeApi.permissions.contains).toHaveBeenCalledWith({ origins: ['https://beacon-test-comms.azurewebsites.net/*'] });
    });

    it('is false once granted, and for hosts that are always granted', async () => {
        expect(await needsHostPermission(TEST_HUB, fakeChrome({ granted: true }))).toBe(false);
        const chromeApi = fakeChrome();
        expect(await needsHostPermission(PROD_HUB, chromeApi)).toBe(false);
        expect(chromeApi.permissions.contains).not.toHaveBeenCalled();
    });

    it('is false without the permissions API', async () => {
        expect(await needsHostPermission(TEST_HUB, undefined)).toBe(false);
    });
});

describe('requestHostPermission', () => {
    it('asks for the optional host and reports the answer', async () => {
        const chromeApi = fakeChrome({ grant: false });
        expect(await requestHostPermission(TEST_HUB, chromeApi)).toBe(false);
        expect(chromeApi.permissions.request).toHaveBeenCalledWith({ origins: ['https://beacon-test-comms.azurewebsites.net/*'] });
        expect(await requestHostPermission(TEST_HUB, fakeChrome({ grant: true }))).toBe(true);
    });

    it('does not ask for a host that needs no request', async () => {
        const chromeApi = fakeChrome();
        expect(await requestHostPermission(PROD_HUB, chromeApi)).toBe(true);
        expect(chromeApi.permissions.request).not.toHaveBeenCalled();
    });
});
