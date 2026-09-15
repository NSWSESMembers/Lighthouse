import { describe, it, expect } from 'vitest';
import { decodeJwtSub } from './jwt.js';

function makeJwt(payload) {
  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.signature`;
}

describe('decodeJwtSub', () => {
  it('extracts the sub claim from a valid JWT', () => {
    expect(decodeJwtSub(makeJwt({ sub: 'user123' }))).toBe('user123');
  });

  it('decodes base64url (-/_) rather than requiring standard base64', () => {
    // A payload whose base64 encoding happens to contain -/_ chars once
    // converted from +//, exercised indirectly via a long sub value.
    const jwt = makeJwt({ sub: 'a'.repeat(50) });
    expect(decodeJwtSub(jwt)).toBe('a'.repeat(50));
  });

  it('returns null when there is no sub claim', () => {
    expect(decodeJwtSub(makeJwt({ other: 'x' }))).toBeNull();
  });

  it('returns null for a malformed token rather than throwing', () => {
    expect(decodeJwtSub('not-a-jwt')).toBeNull();
    expect(decodeJwtSub('')).toBeNull();
    expect(decodeJwtSub('a.b.c')).toBeNull(); // "b" isn't valid base64 JSON
  });

  it('returns null for null/undefined input rather than throwing', () => {
    expect(decodeJwtSub(null)).toBeNull();
    expect(decodeJwtSub(undefined)).toBeNull();
  });
});
