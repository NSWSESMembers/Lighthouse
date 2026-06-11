import L from "leaflet";



export function registerNswMeshNodesLayer(vm) {
  vm.mapVM.registerPollingLayer("nswMeshNodes", {
    label: "NSW Mesh Nodes",
    menuGroup: "Civilian",
    visibleByDefault: localStorage.getItem(`ov.nswMeshNodes`) || false,
    fetchFn: async () => {
      const response = await fetch("https://corescope.nswmesh.au/api/nodes?limit=10000&lastHeard=30d")
      if (!response.ok) { throw new Error(`Failed to get MeshCore nodes: ${response.status}`); }
      const result = await response.json();
      return result;
    },
    drawFn: (layerGroup, data) => {

      if (!data || !Array.isArray(data.nodes)) return;


      data.nodes.forEach((f) => {
        if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) return;

        const roleToIconMap = {
            repeater : "🛜",
            companion : "📟",
            observer : "🖥️"
        }

        const roleRmoji = roleToIconMap[f.role] ?? "📻"

        const marker = L.marker([f.lat, f.lon], {        
          icon: L.divIcon({
            html: roleRmoji,
            iconSize: [0, 0]
          })});
        layerGroup.addLayer(marker);
      });

      

      return;
      
    },
  });
}