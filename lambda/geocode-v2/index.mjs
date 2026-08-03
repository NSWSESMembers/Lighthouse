import pkg from "@aws-sdk/client-geo-places";
import { verifyBeaconToken } from "./verifyBeaconToken.mjs";

const { GeoPlacesClient, GeocodeCommand, ReverseGeocodeCommand } = pkg;

const client = new GeoPlacesClient({
  region: process.env.AWS_REGION, // required for SigV4 endpoints; Lambda sets AWS_REGION
});

const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

const json = (statusCode, obj) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  // CORS preflight
  if (event?.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  let claims;
  try {
    claims = await verifyBeaconToken(event.headers?.authorization || event.headers?.Authorization);
  } catch (err) {
    return json(401, { error: "Unauthorized", message: err?.message || String(err) });
  }
  console.log(JSON.stringify({ msg: "beacon_auth", fn: "geocode-v2", userId: claims.sub || claims.client_id || "unknown" }));

  const qsp = event?.queryStringParameters || {};

  // Forward geocode: ?q=...
  const q = typeof qsp.q === "string" ? qsp.q.trim() : "";

  // Reverse geocode: ?lat=&lon=
  const lat = Number(qsp.lat);
  const lon = Number(qsp.lon);

  const maxResults = (() => {
    const mr = Number(qsp.maxResults);
    return Number.isFinite(mr) && mr > 0 ? Math.min(mr, 100) : 10;
  })();

  try {
    if (q) {
      // Places v2 Geocode request fields: QueryText, BiasPosition, Filter.IncludeCountries, MaxResults, etc. :contentReference[oaicite:1]{index=1}
      const cmd = new GeocodeCommand({
        QueryText: q,
        MaxResults: maxResults,
        BiasPosition: [151.2093, -33.8688], // [lng, lat]
        Filter: {
          IncludeCountries: ["AUS"],
        },
        IntendedUse: "SingleUse",
      });

      const resp = await client.send(cmd);

      return json(200, {
        input: { q },
        results: resp.ResultItems ?? [],
      });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json(400, { error: "Provide either q=... or lat/lon numbers" });
    }

    // Places v2 ReverseGeocode request fields: QueryPosition, MaxResults, etc. :contentReference[oaicite:2]{index=2}
    const cmd = new ReverseGeocodeCommand({
      QueryPosition: [lon, lat], // [lng, lat]
      MaxResults: maxResults,
      Filter : {
        IncludePlaceTypes: [
          "PointAddress",
          "Street",
          "InterpolatedAddress"
        ]
      },
      IntendedUse: "SingleUse",
    });

    const resp = await client.send(cmd);

    return json(200, {
      input: { lat, lon },
      results: resp.ResultItems ?? [],
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Unknown error";
    return json(500, { error: "Places v2 request failed", message });
  }
};
