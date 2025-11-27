import BeaconClient from "../../../shared/BeaconClient";
import L from "leaflet";


async function fetchUnitBoundariesAsync(units, apiHost, userId, token) {
    return new Promise((resolve, reject) => {
        var unitIds = units.map((unit) => {
            return new Promise((res, rej) => {
                BeaconClient.geoservices.unitBoundary(unit.id, apiHost, userId, token, function (response) {
                    if (response.error) {
                        console.error(`Fetch of unit boundaries failed: ${response.error} http-code:${response.httpCode}`);
                        rej(response);
                    } else {
                        res({data: response[0], unit});
                    }
                });
            });
        });

        Promise.all(unitIds)
            .then(results => {
                resolve({ ok: true, response: results });
            })
            .catch(error => {
                reject(error);
            });
    });
}

export function registerUnitBoundaryLayer(vm, map, getToken, apiHost, params) {
  vm.mapVM.registerPollingLayer("unit-boundary", {
    label: "Unit Boundaries",
    menuGroup: "NSW SES Geoservices",
    refreshMs: 0, // 0 refresh. they dont change. only redraw on filter change
    visibleByDefault: localStorage.getItem(`ov.unit-boundary`) || false,
    fetchFn: async () => {
      if (vm.config.incidentFilters().length) {
        const t = await getToken(); // blocks until token is ready
        const res = await fetchUnitBoundariesAsync(
          vm.config.incidentFilters(),
          apiHost,
          params.userId,
          t
        );
        if (!res.ok) throw new Error("unit-boundary fetch failed: " + res.status);
        return res.response;
      }
      return undefined;
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      data.forEach((f) => {
        if (!f || !f.data || f.data.points.length === 0) return;

        const points = f.data.points.map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
        }));
        if (points.length === 0) return;

        const polygon = L.polygon(points, {
          color: "rgb(255, 56, 238)",
          fill: false,
        });

        polygon.on("mouseover", function () {
          this.setStyle({
            fill: true,
            fillColor: "rgba(255, 56, 238, 0.3)",
            fillOpacity: 0.5,
          });

          const popup = L.popup()
            .setContent(`${f.unit?.name || "Unknown Unit"} Unit`)
            .openOn(map);

          this._popup = popup;
        });

        polygon.on("mouseout", function () {
          this.setStyle({ fill: false });
          if (this._popup) {
            map.closePopup(this._popup);
            this._popup = null;
          }
        });

        layerGroup.addLayer(polygon);
      });
    },
  });

  // if the HQ filter changes we need to redraw the boundaries
  vm.config.incidentFilters.subscribe(() => {
    const online = vm.mapVM.onlineLayers.get("unit-boundary");
    const isVisible = online && map.hasLayer(online.layerGroup);
    if (!isVisible) return;
    vm.mapVM.refreshPollingLayer("unit-boundary");
  });
}
