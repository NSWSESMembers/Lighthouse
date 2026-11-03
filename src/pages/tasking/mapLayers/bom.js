import L from "leaflet";

/**
 * Register a single toggle that draws all five BOM Land Warning sub-layers
 * through Beacon's BOM WMS proxy.
 *
 * Previously this pulled vectors from a Queensland (QFES) ArcGIS republish of
 * the BOM feed, which gave clickable popups but was licensed for Queensland
 * agency use only and was flagged by its owner for deletion. We now render
 * BOM's own warning layers (server-styled rasters) straight through the proxy,
 * matching the other BOM warning overlays (tsunami, cyclone, severe storm).
 *
 * Warning -> BOM WMS layer:
 *   Flood Warning          IDZ20013 (+ _label)
 *   Flood Watch            IDZ20016 (+ _label)
 *   Severe Weather Warning IDZ20005
 *   Thunderstorm Warning   IDZ20006
 *   Fire Weather Warning   IDZ20012000 (today)
 */
export function registerBOMLandWarningsLayer(vm, sourceUrl) {
  const wmsUrl = `${sourceUrl}/MappingLayers/RequestBomLayer`;
  vm.mapVM.registerPollingLayer("bomLandWarnings", {
    label: "BOM Land Warnings",
    menuGroup: "BOM Warnings",
    stack: "tiles",
    refreshMs: 300000, // 5 min – warnings update frequently
    visibleByDefault: localStorage.getItem(`ov.bomLandWarnings`) || false,
    fetchFn: async () => ({ cacheBuster: Date.now() }),
    drawFn: (layerGroup, data) => {
      layerGroup.addLayer(
        L.tileLayer.wms(wmsUrl, {
          // Warning areas first (bottom), their labels last (on top).
          layers: [
            "IDZ20013",
            "IDZ20016",
            "IDZ20005",
            "IDZ20006",
            "IDZ20012000",
            "IDZ20013_label",
            "IDZ20016_label",
          ],
          styles: "default",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
          attribution: "Bureau of Meteorology",
          _cb: data?.cacheBuster,
        })
      );
    },
  });
}
