import L from "leaflet";
import * as esri from "esri-leaflet";

const DAMS_URL =
  "https://portal.data.nsw.gov.au/arcgis/rest/services/Hosted/Dam_Safety_NSW_Declared_Dams/FeatureServer/0";

function getNameFromProps(p) {
  if (!p) return "Dam";
  return (
    p.dam_name ||
    p.place_name ||
    p.DAM_NAME ||
    p.NAME ||
    p.DAM ||
    p.FACILITY_NAME ||
    p.STORAGE_NAME ||
    "Dam"
  );
}

export function registerNSWDeclaredDamsLayer(vm) {
  vm.mapVM.registerPollingLayer("nswDeclaredDams", {
    label: "NSW Declared Dams",
    menuGroup: "Public Service",
    refreshMs: 0, // reference data – no auto-refresh
    visibleByDefault: localStorage.getItem("ov.nswDeclaredDams") || false,
    fetchFn: async () => ({ ok: true }),
    drawFn: (layerGroup, data) => {
      if (!data) return;

      const featureLayer = esri.featureLayer({
        url: DAMS_URL,
        where: "1=1",
        fields: [
          "objectid",
          "pkdamid",
          "dam_name",
          "place_name",
          "company",
          "owner_type",
          "declared_status",
          "longitude",
          "latitude",
        ],
        pane: "pane-middle",
        pointToLayer: (_geojson, latlng) => {
          return L.circleMarker(latlng, {
            pane: "pane-middle",
            radius: 5,
            weight: 1,
            color: "#163a63",
            fillColor: "#2b7bbb",
            fillOpacity: 0.85,
          });
        },
        style: () => ({
          weight: 1.2,
          color: "#163a63",
          fillColor: "#2b7bbb",
          fillOpacity: 0.25,
        }),
      });

      featureLayer.bindPopup((layer) => {
        const p = layer?.feature?.properties || {};
        const name = getNameFromProps(p);
        const place = p.place_name || "";
        const company = p.company || "";
        const ownerType = p.owner_type || "";
        const declaredStatus = p.declared_status || "";
        const damId = p.pkdamid ?? "";

        return [
          `<strong>${name}</strong>`,
          place ? `<br><strong>Place:</strong> ${place}` : "",
          company ? `<br><strong>Company:</strong> ${company}` : "",
          ownerType ? `<br><strong>Owner Type:</strong> ${ownerType}` : "",
          declaredStatus
            ? `<br><strong>Declared Status:</strong> ${declaredStatus}`
            : "",
          damId !== "" ? `<br><strong>Dam ID:</strong> ${damId}` : "",
        ].join("");
      });

      layerGroup.addLayer(featureLayer);
    },
  });
}
