var L = require('leaflet');
var ko = require('knockout');
var moment = require('moment');

export class AssetPopupViewModel {
  constructor({ asset, map, api }) {
    this.asset = asset;   // expects KO observables on the asset (latitude/longitude/name/etc.)
    this.map = map;
    this.api = api;
  }


  openBeaconEditTeam = (team) => {
    team.openBeaconEditTeam();
  }

  updatePopup = () => {
    console.log('AssetPopupViewModel.updatePopup called');
    if (this.asset.marker && this.asset.marker.isPopupOpen()) {
      const popup = this.asset.marker.getPopup();
      if (popup) {
        popup.update();
      }
    }
  }

  drawCrowsFliesToJob = (tasking) => {
    if (tasking.job.isFilteredIn() === false) {
      return;
    }
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

  removeCrowsFliesToJob = () => {
    this.api.clearCrowFliesLine();
  }

  drawRouteToJob = (tasking) => {
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

    removeRouteToJob = () => {
      this.api.clearRoutes();
    }

  // Example hook – wire this to your app-level handler if needed.
  assignTeam() {
    const id = this.asset.id?.() ?? this.asset.Identifier ?? this.asset.ID;
    window.dispatchEvent(new CustomEvent('assignTeamToAsset', { detail: { assetId: id } }));
  }

  dispose = () => {
    // clean up any subscriptions or resources here
    this.removeRouteToJob();
    this.removeCrowsFliesToJob();
  }

}