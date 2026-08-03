// AwsLambdaGeocoderProvider.js
export class AwsLambdaGeocoderProvider {
  constructor({ endpoint, fetchOptions, getToken } = {}) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetchOptions = fetchOptions; // optional: headers, credentials, etc.
    this.getToken = getToken; // optional: () => Promise<string> -- Beacon access token
  }

  // leaflet-geosearch calls: provider.search({ query: string })
  async search({ query }) {
    if (!query || !query.trim()) return [];

    const url = new URL(this.endpoint);
    url.searchParams.set('q', query.trim());

    // Computed fresh per call (not baked into fetchOptions at construction)
    // since this provider instance is long-lived and the token can expire.
    const token = this.getToken ? await this.getToken() : null;

    const res = await fetch(url.toString(), {
      method: 'GET',
      ...this.fetchOptions,
      headers: {
        ...this.fetchOptions?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Geocode failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const items = Array.isArray(json?.results) ? json.results : [];

    return items
      .map((r) => {
        const place = r;
        const pt = place?.Position; // [lon, lat]
        const lon = Array.isArray(pt) ? Number(pt[0]) : NaN;
        const lat = Array.isArray(pt) ? Number(pt[1]) : NaN;
        const label = place?.Address?.Label || '';

        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !label) return null;

        return {
          x: lon,
          y: lat,
          label,
          // bounds optional; omit unless you compute one
          raw: r,
        };
      })
      .filter(Boolean);
  }
}
