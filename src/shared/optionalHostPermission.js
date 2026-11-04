// Hosts listed under optional_host_permissions in the manifest (the Test and
// Dev Beacon live update hosts) aren't granted at install. Chrome only grants
// them through chrome.permissions.request(), which has to run from a click,
// so a page checks first and offers an Allow button when one is missing.

// "https://host/path?q" -> "https://host/*", or null for a bad URL.
export function hostPatternFor(url) {
    try {
        return `${new URL(url).origin}/*`;
    } catch {
        return null;
    }
}

// The pattern to request for this URL, or null when the URL needs no request
// (it's under host_permissions, or it isn't a host the manifest lists).
export function optionalPatternFor(url, manifest = globalThis.chrome?.runtime?.getManifest?.()) {
    const pattern = hostPatternFor(url);
    const optional = manifest?.optional_host_permissions || [];
    return pattern && optional.includes(pattern) ? pattern : null;
}

// True when the URL is an optional host the user hasn't allowed yet.
export async function needsHostPermission(url, chromeApi = globalThis.chrome) {
    const pattern = optionalPatternFor(url, chromeApi?.runtime?.getManifest?.());
    if (!pattern || !chromeApi?.permissions?.contains) return false;
    try {
        return !(await chromeApi.permissions.contains({ origins: [pattern] }));
    } catch {
        return false;
    }
}

// Asks Chrome for the URL's optional host. Call it straight from a click
// handler, with no await before it, or Chrome refuses for lack of a user
// gesture. Resolves true when the host is allowed.
export async function requestHostPermission(url, chromeApi = globalThis.chrome) {
    const pattern = optionalPatternFor(url, chromeApi?.runtime?.getManifest?.());
    if (!pattern) return true;
    try {
        return await chromeApi.permissions.request({ origins: [pattern] });
    } catch (err) {
        console.warn('[permissions] request failed', pattern, err);
        return false;
    }
}
