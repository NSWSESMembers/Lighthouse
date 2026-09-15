/**
 * jwt.js
 *
 * No verification happens client-side -- an untrusted decode would be
 * pointless as a security control, which is exactly why enforcement lives
 * server-side. This exists purely to read the `sub` claim for display/UX.
 */

/**
 * @param {string} jwt
 * @returns {string|null}  the token's `sub` claim, or null if it can't be decoded
 */
export function decodeJwtSub(jwt) {
    try {
        const payloadB64 = jwt.split('.')[1];
        const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(json)?.sub || null;
    } catch {
        return null;
    }
}
