var ko = require('knockout');
var L = require('leaflet');
var moment = require('moment');

export class JobPopupViewModel {
    constructor({ job, map, api, filteredTeams }) {
        this.job = job;   // expects KO observables on the job (latitude/longitude/name/etc.)
        this.map = map;
        this.api = api;
        this.filteredTeams = filteredTeams; // from main VM
    }

    //incident popup team filterings
    popupTeamFilter = ko.observable('');

    taskTeamToJobWithConfirm = (team) => { //this team is our fake object with team and distance info
        this.api.taskTeamToJobWithConfirm(this.job, team.team); 
    }

    // --- popupFilteredTeams ---
    popupFilteredTeams = ko.pureComputed(() => {
        const term = (this.popupTeamFilter() || "").toLowerCase().trim();
        const list = this.filteredTeams() || [];
        const job = this.job;
        return list
            .filter(tm => 
            !term || (tm.callsign() || "").toLowerCase().includes(term)
            )
            .filter(tm => 
            !(job.incompleteTaskingsOnly() || []).some(
                t => t.team.id === tm.id
            )
            )
            .map(tm => {
            const { distance, backBearing } = bestDistanceAndBearing(tm, job);
            return {
                team: tm,
                taskings: tm.filteredTaskings,
                distanceMeters: distance,
                distanceLabel: fmtDist(distance),
                bearingLabel: fmtBearing(backBearing)
            };
            })
            .sort((a, b) => {
            const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
            const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
            return da - db;
            });
    });

    updatePopup = () => {
        if (this.job.marker && this.job.marker.isPopupOpen()) {
            const popup = this.job.marker.getPopup();
            if (popup) {
                popup.update();
            }
        }
    }

    removeCrowsFliesToAsset = () => {
        this.api.clearCrowFliesLine();
    }

    drawCrowsFliesToAsset = (tasking) => {
        // clear any existing one first
        this.api.clearCrowFliesLine();
        if (!tasking) return;

        // pick the team’s first asset coordinates
        let fromLat = null, fromLng = null;
        if (tasking.team.trackableAssets && tasking.team.trackableAssets().length > 0) {
            const a = tasking.team.trackableAssets()[0];
            fromLat = +ko.unwrap(a.latitude);
            fromLng = +ko.unwrap(a.longitude);
        }
        const toLat = +ko.unwrap(tasking.job.address.latitude);
        const toLng = +ko.unwrap(tasking.job.address.longitude);

        if (!(Number.isFinite(fromLat) && Number.isFinite(fromLng) &&
            Number.isFinite(toLat) && Number.isFinite(toLng))) return;

        this._polyline = L.polyline(
            [
                [fromLat, fromLng],
                [toLat, toLng],
            ],
            { weight: 4, color: 'green', dashArray: '6' }
        )
        this.api.registerCrowFliesLine(this._polyline);
    }

    drawRouteToAsset = (tasking) => {
        const from = tasking.getTeamLatLng();
        const to = tasking.getJobLatLng();
        if (!from || !to) {
            console.warn('Cannot draw route: missing team or job coordinates.');
            return;
        }

        const routeControl = L.Routing.control({
            waypoints: [from, to],
            router: L.Routing.graphHopper('lighthouse', {
                serviceUrl: 'https://graphhopper.lighthouse-extension.com/route',
                urlParameters: { 'ch.disable': true, instructions: false },
            }),
            lineOptions: {
                styles: [{ opacity: 0.9, weight: 6 }, { opacity: 1.0, weight: 3, dashArray: '6,8' }]
            },
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            createMarker: function () { return null },
            show: false // keep the big itinerary panel hidden
        })

        this.api.registerRouteControl(routeControl);

        routeControl.on('routesfound', e => {
            const route = e.routes && e.routes[0];
            if (!route || !route.coordinates) return;

            var r = e.routes[0]
            let middle = r.coordinates[Math.floor(r.coordinates.length / 4)];

            let distance = r.summary.totalDistance;
            let time = r.summary.totalTime;
            let timeHr = parseInt(moment.utc(time * 1000).format('HH'));
            let timeMin = parseInt(moment.utc(time * 1000).format('mm'));
            let timeText = '';
            if (timeHr == 0) {
                timeText = `${timeMin} min`;
            } else {
                timeText = `${timeHr} hr ${timeMin} min`;
            }
            const distanceMarker = new L.circleMarker([middle.lat, middle.lng], { radius: 0.1 })
            distanceMarker.bindTooltip(
                `<div style="text-align: center;"><strong>${(distance / 1000).toFixed(
                    1,
                )} km - ${timeText}</strong></div>`,
                { permanent: true, offset: [0, 0] },
            );

            this.api.registerDistanceMarker(distanceMarker);

            const bounds = L.latLngBounds(route.coordinates);

            //Smooth zoom/pan to fit the whole route with padding
            this.api.flyToBounds(bounds, {
                padding: [150, 150],  // add more if you have a sidebar, e.g. [200, 80]
                maxZoom: 13,        // optional: prevent over-zoom
                duration: 1.2       // seconds; optional for smoother transition
            });

            // Auto-update route when the team's first asset or job location moves
            const team = self.team;
            if (team && team.trackableAssets && team.trackableAssets().length > 0) {
                const a = team.trackableAssets()[0];
                self._routeSubs.push(a.latitude.subscribe(() => {
                    const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
                    if (s && d && routeControl) routeControl.setWaypoints([s, d]);
                }));
                self._routeSubs.push(a.longitude.subscribe(() => {
                    const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
                    if (s && d && routeControl) routeControl.setWaypoints([s, d]);
                }));
            }

            const j = self.job;
            if (j) {
                self._routeSubs.push(j.address.latitude.subscribe(() => {
                    const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
                    if (s && d && routeControl) routeControl.setWaypoints([s, d]);
                }));
                self._routeSubs.push(j.address.longitude.subscribe(() => {
                    const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
                    if (s && d && routeControl) routeControl.setWaypoints([s, d]);
                }));
            }
        });


    }

    removeRouteToAsset = () => {
        this.api.clearRoutes();
    }


}

// --- helpers

const unwrapNum = v => {
    const n = +ko.unwrap(v);
    return Number.isFinite(n) ? n : null;
};

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dφ = toRad(lat2 - lat1);
    const dλ = toRad(lon2 - lon1);
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360; // forward bearing
}

function backBearingDegrees(bearing) {
  return (bearing + 180) % 360;
}

function bearingToCardinal(bearing) {
  if (bearing == null || !Number.isFinite(bearing)) return null;
  const dirs = [
    "North", "North-East", "East", "South-East",
    "South", "South-West", "West", "North-West"
  ];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

function bestDistanceAndBearing(team, job) {
  const jLat = unwrapNum(job?.address?.latitude);
  const jLon = unwrapNum(job?.address?.longitude);
  if (jLat == null || jLon == null) return { distance: null, bearing: null };

  const assets = ko.unwrap(team?.trackableAssets) || [];
  let best = null;
  let bestBearing = null;

  for (const a of assets) {
    let lat = unwrapNum(a?.latitude), lon = unwrapNum(a?.longitude);
    if ((lat == null || lon == null) && a?.geometry?.coordinates) {
      lat = unwrapNum(a.geometry.coordinates[1]);
      lon = unwrapNum(a.geometry.coordinates[0]);
    }
    if (lat == null || lon == null) continue;

    const d = haversineMeters(lat, lon, jLat, jLon);
    if (best == null || d < best) {
      best = d;
      bestBearing = bearingDegrees(lat, lon, jLat, jLon);
    }
  }
    const backBearing = bestBearing != null ? backBearingDegrees(bestBearing) : null;

  return { distance: best, bearing: bestBearing, backBearing };
}

const fmtBearing = b =>
  b == null ? "-" : `${bearingToCardinal(b)} (${Math.round(b)}°)`;

const fmtDist = m =>
    m == null ? "-" : (m < 950 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);


