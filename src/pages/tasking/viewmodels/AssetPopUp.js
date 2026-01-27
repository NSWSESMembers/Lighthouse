var L = require('leaflet');
var moment = require('moment');
var ko = require('knockout');

import AmazonLocationRouter from "../../../shared/als.js";


export class AssetPopupViewModel {
  constructor({ asset, map, api }) {
    this.asset = asset;   // expects KO observables on the asset (latitude/longitude/name/etc.)
    this.map = map;
    this.api = api;
    this._routeSubs = []
  }

  routeLoading = ko.observable(false);


  openBeaconEditTeam = (team) => {
    team.openBeaconEditTeam();
  }

  updatePopup = () => {
    if (this.asset.marker && this.asset.marker.isPopupOpen()) {
      const popup = this.asset.marker.getPopup();
      if (popup) {
        popup.update();
      }
    }
  }

  drawCrowsFliesToJob = (tasking) => {
    this.api.drawCrowsFliesToAssetFromTasking(tasking, this.asset);
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
    this.routeLoading(true);

    const router = new AmazonLocationRouter({
      serviceUrl: "https://lambda.lighthouse-extension.com/lad/route",
      travelMode: "Car",
    });

    const routeControl = L.Routing.control({
      waypoints: [from, to],
      router,
      lineOptions: {
        styles: [{ opacity: 0.9, weight: 6 }, { opacity: 1.0, weight: 3, dashArray: '6,8' }]
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      showAlternatives: false,
      createMarker: function () { return null },
      show: false // keep the big itinerary panel hidden
    })

    this.api.registerRouteControl(routeControl);

    routeControl.on('routesfound', e => {
      const route = e.routes && e.routes[0];
      if (!route || !route.coordinates) return;

      var r = e.routes[0]
      let middle = r.summary.midpoint;

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
        )} km - ${timeText} ${r.summary.routeLabel}</strong></div>`,
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
      const team = tasking.team;
      if (team && team.trackableAssets && team.trackableAssets().length > 0) {
        const a = team.trackableAssets()[0];

      this._routeSubs.push(a.latLng.subscribe(() => {
          if (!this.api.isRouteActive(routeControl)) return;
          const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
          if (s && d && routeControl) routeControl.setWaypoints([s, d]);
        }));
      }

      const j = tasking.job;
      if (j) {
        this._routeSubs.push(j.address.latitude.subscribe(() => {
          if (!this.api.isRouteActive(routeControl)) return;
          const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
          if (s && d && routeControl) routeControl.setWaypoints([s, d]);
        }));
        this._routeSubs.push(j.address.longitude.subscribe(() => {
          if (!this.api.isRouteActive(routeControl)) return;
          const s = tasking.getTeamLatLng(); const d = tasking.getJobLatLng();
          if (s && d && routeControl) routeControl.setWaypoints([s, d]);
        }));
      }
      this.routeLoading(false);
    });


  }

  removeRouteToJob = () => {
    this._routeSubs.forEach(sub => sub.dispose());
    this._routeSubs = [];
    this.api.clearRoutes();
  }

  dispose = () => {
    // clean up any subscriptions or resources here
    this.removeRouteToJob();
    this.removeCrowsFliesToJob();
  }

}