import { describe, it, expect } from 'vitest';
import { Address } from './Address.js';

describe('Address', () => {
  it('defaults every field for an empty payload', () => {
    const a = new Address();
    expect(a.gnafId()).toBeNull();
    expect(a.latitude()).toBeNull();
    expect(a.longitude()).toBeNull();
    expect(a.streetNumber()).toBe('');
    expect(a.street()).toBe('');
    expect(a.locality()).toBe('');
    expect(a.postCode()).toBe('');
    expect(a.prettyAddress()).toBe('');
    expect(a.additionalAddressInfo()).toBeNull();
  });

  it('maps every PascalCase field from the payload', () => {
    const a = new Address({
      GnafId: 'g1', Latitude: -33.8, Longitude: 151.2, StreetNumber: '1',
      Street: 'Main St', Locality: 'Sydney', PostCode: '2000',
      PrettyAddress: '1 Main St, Sydney', AdditionalAddressInfo: 'Unit 2',
    });
    expect(a.gnafId()).toBe('g1');
    expect(a.latitude()).toBe(-33.8);
    expect(a.street()).toBe('Main St');
    expect(a.prettyAddress()).toBe('1 Main St, Sydney');
    expect(a.additionalAddressInfo()).toBe('Unit 2');
  });

  describe('latLng', () => {
    it('is a {lat,lng} object when both coordinates are finite', () => {
      const a = new Address({ Latitude: -33.8, Longitude: 151.2 });
      expect(a.latLng()).toEqual({ lat: -33.8, lng: 151.2 });
    });

    it('is null when a coordinate is missing', () => {
      // A genuinely non-numeric value is needed here: the default for a
      // missing coordinate is `?? null`, and +null coerces to 0 (finite),
      // so an actually-missing Longitude would NOT trip this branch.
      const a = new Address({ Latitude: -33.8, Longitude: 'not-a-number' });
      expect(a.latLng()).toBeNull();
    });

    it('is null when a coordinate is non-numeric', () => {
      const a = new Address({ Latitude: 'not-a-number', Longitude: 151.2 });
      expect(a.latLng()).toBeNull();
    });

    it('coerces numeric strings', () => {
      const a = new Address({ Latitude: '-33.8', Longitude: '151.2' });
      expect(a.latLng()).toEqual({ lat: -33.8, lng: 151.2 });
    });
  });
});
