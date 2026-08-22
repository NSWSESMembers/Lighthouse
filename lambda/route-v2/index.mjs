import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes";

const client = new GeoRoutesClient({});

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "OPTIONS,POST",
  "access-control-allow-headers": "content-type,authorization",
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(obj),
  };
}

function mapTravelMode(v) {
  // v2 valid values: Car | Pedestrian | Scooter | Truck :contentReference[oaicite:3]{index=3}
  if (!v) return "Car";
  const x = String(v).toLowerCase();
  if (x === "walking" || x === "walk" || x === "pedestrian") return "Pedestrian";
  if (x === "car") return "Car";
  if (x === "truck") return "Truck";
  if (x === "scooter") return "Scooter";
  return "Car";
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // Auth is enforced by the LH-BeaconAuthorizerV2 API Gateway authorizer
  // before this handler is ever invoked; `sub` is the verified Beacon
  // member id it passes through.
  const userId = event.requestContext?.authorizer?.lambda?.sub || "unknown";
  console.log(JSON.stringify({ msg: "beacon_auth", fn: "route-v2", userId }));

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const coordinates = body.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return json(400, { error: "coordinates must be an array of at least 2 [lng,lat] points" });
  }
  for (const c of coordinates) {
    if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== "number" || typeof c[1] !== "number") {
      return json(400, { error: "each coordinate must be [lng:number, lat:number]" });
    }
  }

  const origin = coordinates[0];
  const destination = coordinates[coordinates.length - 1];
  const waypoints = coordinates.slice(1, -1).map((pos) => ({ Position: pos }));

  const travelMode = mapTravelMode(body.travelMode);

  // Request:
  // - leg geometry so you can draw the line (Simple => LineString is returned) :contentReference[oaicite:4]{index=4}
  // - travel step instructions (gives Instruction strings) :contentReference[oaicite:5]{index=5}
  // - span features Distance/Names/RouteNumbers for "via M1" computation :contentReference[oaicite:6]{index=6}
  const cmd = new CalculateRoutesCommand({
    Origin: origin,
    Destination: destination,
    ...(waypoints.length ? { Waypoints: waypoints } : {}),
    TravelMode: travelMode,

    DepartNow: body.departNow === true ? true : undefined,
    DepartureTime: body.departureTime || undefined,

    LegGeometryFormat: "Simple",
    //TravelStepType: "Default",
    MaxAlternatives: body.maxAlternatives || 0,
    LegAdditionalFeatures: [],
    //SpanAdditionalFeatures: ["Distance", "Names", "RouteNumbers"],
  });

  try {
    const resp = await client.send(cmd);
    return json(200, resp?.Routes)
  } catch (err) {
    console.error(err);
    return json(500, {
      error: "Route calculation failed",
      detail: err?.name || err?.message || "unknown",
    });
  }
};
