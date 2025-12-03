import BeaconClient from "../../../shared/BeaconClient";
import L from "leaflet";

const NSW_LGA_QUERY_URL =
  "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Administrative_Boundaries/MapServer/1/query";


async function fetchFRAOSAsync(startDate, endDate, apiHost, userId, token) {
    console.log("Fetching FRAOS from Beacon");
      return new Promise((res, rej) => {
        BeaconClient.frao.search(startDate, endDate, apiHost, userId, token, function (response) {
          if (response.error) {
            console.error(`Fetch of fraos failed: ${response.error} http-code:${response.httpCode}`);
            rej(response);
          } else {
            res({ ok: true, data: response });
          }
        }, function (count, total) {
          //progress callback - we dont need this here
        }, function (pageResult) {
          // on page callback - we dont need this here
        });
      });
}

async function FRAOToUnionAsync(lgas) {
  // lgas: array of strings
  const names = lgas.map(lga => String(lga).toUpperCase());

  // Build ArcGIS "IN" clause: lganame IN ('PARRAMATTA','CUMBERLAND',...)
  const escaped = names.map(n => `'${n.replace(/'/g, "''")}'`);
  const where = `lganame IN (${escaped.join(",")})`;

  const params = new URLSearchParams({
    f: "geojson",
    where,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
  });

  const url = `${NSW_LGA_QUERY_URL}?${params.toString()}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      console.error("NSW LGA query failed", resp.status, text);
      return { message: "NSW LGA query failed", status: resp.status };
    }

    const geojson = await resp.json();

    if (!geojson.features || geojson.features.length === 0) {
      return { message: "No LGAs found for supplied values", where };
    }

      // If there's only one LGA, return it as a FeatureCollection
      return {
        type: "FeatureCollection",
        features: geojson.features,
      };

 
    // Normalise to FeatureCollection with a single feature, like the Lambda did
    
  } catch (err) {
    console.error("Error talking to NSW LGA service", err);
    return { message: "Error talking to NSW LGA service", error: String(err) };
  }
}

export function renderFRAOSLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("fraos", {
    label: "Active FRAOs",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // 0 refresh. they dont change. only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.fraos`) || false,
    fetchFn: async () => {
        var start = new Date();
        var end = new Date();
        start.setDate(end.getDate() - vm.config.fetchPeriod());
        const t = await getToken(); // blocks until token is ready
        const res = await fetchFRAOSAsync(
          start,
          end,
          apiHost,
          params.userId,
          t
        );
        if (!res.ok) throw new Error("frao fetch failed: " + res.status);
            console.log(res.data.Results)
            const activeFRAOs = res.data.Results.filter(frao => frao.EndTime === null);
            const fraoWithPolygons = await Promise.all(
                activeFRAOs.map(async (frao) => {
                    console.log(frao);
                    const lgaMappings = frao.LgaMappings.map(mapping => mapping.LgaName);
                    const unionData = await FRAOToUnionAsync(lgaMappings);
                    return {
                        ...frao,
                        polygon: unionData
                    };
                })
            );
            return fraoWithPolygons;
        
    },
    drawFn: (layerGroup, data) => {
  if (!data) return;

  // Always clear before redraw
  layerGroup.clearLayers();

  // Pastel colour generator that supports any number of FRAOs
  const getPastelColor = (index) => {
    // Golden-angle step so colours stay spaced out as N grows
    const hue = (index * 137.508) % 360;
    // light, fairly soft colours
    return `hsl(${hue}, 60%, 80%)`;
  };

  data.forEach((f, idx) => {
    if (!f || !f.polygon || f.polygon.message) return;

    const color = getPastelColor(idx);

    const polygon = L.geoJSON(f.polygon, {
      style: {
        color,          // outline
        weight: 2,
        fillColor: color,
        fillOpacity: 0.35,
      },
    });

    layerGroup.addLayer(polygon);

    // Label in the center of the polygon
    const bounds = polygon.getBounds();
    if (bounds.isValid && bounds.isValid()) {
      const center = bounds.getCenter();
      const labelText = `${f.Zone.Code} FRAO ${f.FRAONumber}`;

      const labelMarker = L.marker(center, {
        interactive: false,
        icon: L.divIcon({
          className: "frao-label",
          html: labelText,
        }),
      });

      layerGroup.addLayer(labelMarker);
    }
  });
}
    });

  // if the HQ filter changes we need to redraw the boundaries
  vm.config.incidentFilters.subscribe(() => {
    const online = vm.mapVM.onlineLayers.get("unit-boundary");
    const isVisible = online && map.hasLayer(online.layerGroup);
    if (!isVisible) return;
    vm.mapVM.refreshPollingLayer("unit-boundary");
  });
}