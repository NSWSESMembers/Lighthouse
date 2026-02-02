// AmazonLocationRouter.js
// Leaflet Routing Machine router using Amazon Location Service via api gateway
//
// Lambda returns: resp?.Routes (array of alternative routes)

var L = require("leaflet");

export default class AmazonLocationRouter {
  constructor(options = {}) {
    if (!options.serviceUrl) {
      throw new Error("AmazonLocationRouter: options.serviceUrl is required");
    }

    this.options = {
      serviceUrl: options.serviceUrl,
      travelMode: options.travelMode || "Car",
      headers: options.headers || {},
      timeoutMs: options.timeoutMs || 15000,
      fetch: options.fetch || window.fetch.bind(window),
    };
  }

  // Leaflet Routing Machine API
  route(waypoints, callback, context /*, options */) {
    try {
      const inputLatLngs = waypoints.map((wp) => this._normalizeWaypoint(wp));

      const payload = {
        coordinates: inputLatLngs.map((ll) => [ll.lng, ll.lat]),
        travelMode: this.options.travelMode,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

      this.options
        .fetch(this.options.serviceUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...this.options.headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        .then(async (res) => {
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`ALS router HTTP ${res.status}: ${txt}`);
          }
          return res.json();
        })
        .then((apiResp) => {
          clearTimeout(timeout);

          // IMPORTANT: return ALL alternative routes
          const routesOut = this._buildLRMRoutesFromRoutes(apiResp, inputLatLngs);

          // LRM expects callback(err, routesArray)
          callback.call(context || this, null, routesOut);
        })
        .catch((err) => {
          clearTimeout(timeout);
          callback.call(context || this, err);
        });
    } catch (err) {
      callback.call(context || this, err);
    }
  }

  // ---- helpers ----

  _computeRouteMidpoint(routeLatLngs, totalDistanceMeters) {
    if (!Array.isArray(routeLatLngs) || routeLatLngs.length < 2) return null;

    // If totalDistanceMeters isn't provided, compute it from geometry
    let total = typeof totalDistanceMeters === "number" && totalDistanceMeters > 0 ? totalDistanceMeters : 0;
    if (!total) {
      for (let i = 1; i < routeLatLngs.length; i++) {
        total += routeLatLngs[i - 1].distanceTo(routeLatLngs[i]);
      }
    }
    if (!total) return null;

    const half = total / 2;

    let acc = 0;
    for (let i = 1; i < routeLatLngs.length; i++) {
      const a = routeLatLngs[i - 1];
      const b = routeLatLngs[i];
      const seg = a.distanceTo(b);

      if (acc + seg >= half) {
        const t = seg > 0 ? (half - acc) / seg : 0;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lng = a.lng + (b.lng - a.lng) * t;

        return {
          lat,
          lng,
          atDistanceMeters: Math.round(half),
          totalDistanceMeters: Math.round(total),
          segmentIndex: i - 1,
          t,
        };
      }
      acc += seg;
    }

    // Fallback: last point (shouldn't happen unless geometry is weird)
    const last = routeLatLngs[routeLatLngs.length - 1];
    return {
      lat: last.lat,
      lng: last.lng,
      atDistanceMeters: Math.round(total),
      totalDistanceMeters: Math.round(total),
      segmentIndex: routeLatLngs.length - 2,
      t: 1,
    };
  }

  _normalizeWaypoint(wp) {
    if (wp && wp.latLng) return wp.latLng;
    if (wp && typeof wp.lat === "number" && typeof wp.lng === "number") return wp;
    throw new Error("AmazonLocationRouter: invalid waypoint");
  }

  _asRoutesArray(apiResp) {
    if (Array.isArray(apiResp)) return apiResp;
    if (apiResp && Array.isArray(apiResp.Routes)) return apiResp.Routes;
    if (apiResp && Array.isArray(apiResp.routes)) return apiResp.routes;
    return null;
  }

  _buildLRMRoutesFromRoutes(apiResp, inputLatLngs) {
    const routes = this._asRoutesArray(apiResp);
    if (!routes || !routes.length) {
      throw new Error("AmazonLocationRouter: API response missing Routes[]");
    }

    return routes
      .map((r, idx) => {
        try {
          return this._buildSingleLRMRoute(r, inputLatLngs, idx);
        } catch (e) {
          // skip broken alternatives rather than failing the whole request
          console.warn("AmazonLocationRouter: skipping route", idx, e);
          return null;
        }
      })
      .filter(Boolean);
  }

  _buildSingleLRMRoute(r, inputLatLngs, routeIndex) {
    const legs = r.Legs || r.legs || [];

    // Flatten Legs[].Geometry.LineString => [[lng,lat],...]
    const line = [];
    for (const leg of legs) {
      const geom = leg.Geometry || leg.geometry;
      const ls = geom?.LineString || geom?.lineString;
      if (Array.isArray(ls) && ls.length) {
        for (let i = 0; i < ls.length; i++) {
          if (line.length && i === 0) continue;
          line.push(ls[i]);
        }
      }
    }

    if (line.length < 2) {
      throw new Error("no leg geometry (LineString) returned");
    }

    const routeLatLngs = line.map((c) => L.latLng(c[1], c[0]));
    const wpObjs = inputLatLngs.map((ll) => ({ latLng: ll }));


    // Summary distance/time
    const summarySrc =
      r.Summary?.Overview ||
      r.summary?.overview ||
      r.Summary ||
      r.summary ||
      null;

    let distanceMeters = null;
    let durationSeconds = null;
    if (typeof summarySrc?.Distance === "number") distanceMeters = Math.round(summarySrc.Distance);
    if (typeof summarySrc?.Duration === "number") durationSeconds = Math.round(summarySrc.Duration);

    // "via" label: prefer Route MajorRoadLabels if present at route-level
    const mainRoads = r.MajorRoadLabels;
    const mainRoadValue =
      mainRoads?.[0]?.RoadName?.Value ||
      mainRoads?.[0]?.RouteNumber?.Value ||
      null;


    // If ALS summary missing, fall back to geometry distance (for midpoint + totals)
    let geomDistanceMeters = 0;
    for (let i = 1; i < routeLatLngs.length; i++) {
      geomDistanceMeters += routeLatLngs[i - 1].distanceTo(routeLatLngs[i]);
    }

    const totalForMidpoint =
      typeof distanceMeters === "number" && distanceMeters > 0
        ? distanceMeters
        : Math.round(geomDistanceMeters);

    const midpoint = this._computeRouteMidpoint(routeLatLngs, totalForMidpoint);


    return {
      // LRM shows name in itinerary/alternatives; make them distinct
      name: mainRoadValue ? `${mainRoadValue}` : `#${routeIndex + 1}`,

      coordinates: routeLatLngs,
      waypoints: wpObjs,
      inputWaypoints: wpObjs,

      summary: {
        totalDistance: typeof distanceMeters === "number" ? distanceMeters : 0,
        totalTime: typeof durationSeconds === "number" ? durationSeconds : 0,
        routeName: mainRoadValue,
        routeLabel: mainRoadValue ? `via ${mainRoadValue}` : null,
        routeIndex,
        midpoint,
      },

      instructions: [],
    };
  }
}
