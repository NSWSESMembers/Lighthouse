import BeaconClient from "../../../shared/BeaconClient";
import L from "leaflet";

const NSW_LGA_QUERY_URL =
    "https://six.lighthouse-extension.com/arcgis/rest/services/public/NSW_Administrative_Boundaries/MapServer/1/query";


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
        }, function (_count, _total) {
            //progress callback - we dont need this here
        }, function (_pageResult) {
            // on page callback - we dont need this here
        });
    });
}

async function FRAOToUnionAsync(lgas) {
    // lgas: array of strings
    const names = lgas.map(lga => String(lga).toUpperCase());

    // Build ArcGIS "IN" clause: lganame IN ('PARRAMATTA','CUMBERLAND',...)
    const where = names
        .map(n => {
            const esc = String(n).replace(/'/g, "''");
            return `lganame LIKE '%${esc}%'`;
        })
        .join(' OR ');
    const params = new URLSearchParams({
        f: "geojson",
        where,
        outFields: "*",
        returnGeometry: "true",
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
            const start = new Date();
            const end = new Date();
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

            const activeFRAOs = res.data.Results.filter(frao => frao.EndTime === null);

            // Only return FRAO + list of LGAs, no polygons yet
            const fraosForDrawing = activeFRAOs.map(frao => ({
                ...frao,
                lgas: frao.LgaMappings.map(m => m.LgaName),
            }));

            return fraosForDrawing;
        },

        drawFn: (layerGroup, data) => {
            if (!data) return;

            // Clear existing layers
            layerGroup.clearLayers();

            // Token to invalidate older draw runs (if layer refreshes while we’re still waiting on SIX)
            const drawRunId = Symbol("frao-draw-run");
            renderFRAOSLayer._lastDrawRunId = drawRunId;

            const getPastelColor = (index) => {
                const hue = (index * 137.508) % 360;
                // Avoid light green, blue, and cyan hues by shifting the hue range
                const adjustedHue = (hue >= 60 && hue <= 240) ? (hue + 120) % 360 : hue;
                return `hsl(${adjustedHue}, 60%, 80%)`;
            };

            data.forEach((f, idx) => {
                if (!f || !Array.isArray(f.lgas) || f.lgas.length === 0) return;

                const color = getPastelColor(idx);

                // For each FRAO, call SIX and draw as soon as it returns
                FRAOToUnionAsync(f.lgas)
                    .then((polygonGeoJson) => {
                        // If a newer draw run started, ignore this result
                        if (renderFRAOSLayer._lastDrawRunId !== drawRunId) return;
                        if (!polygonGeoJson || polygonGeoJson.message) return;

                        const polygon = L.geoJSON(polygonGeoJson, {
                            pane: 'pane-lowest',
                            style: {
                                color,
                                weight: 2,
                                fillColor: color,
                                fillOpacity: 0.35,
                            },
                        });

                        layerGroup.addLayer(polygon);

                        const bounds = polygon.getBounds();
                        if (bounds && bounds.isValid && bounds.isValid()) {
                            const center = bounds.getCenter();
                            const labelText = `${f.Zone.Code} FRAO ${f.FRAONumber}`;

                            const labelMarker = L.marker(center, {
                                interactive: false,
                                pane: 'pane-lowest-plus',
                                icon: L.divIcon({
                                    className: "frao-label",
                                    html: labelText,
                                }),
                            });

                            layerGroup.addLayer(labelMarker);
                        }
                    })
                    .catch((err) => {
                        console.error("Error fetching/drawing FRAO polygon from SIX", err);
                    });
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