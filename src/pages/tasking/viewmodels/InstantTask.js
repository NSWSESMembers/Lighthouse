var ko = require('knockout');


export class InstantTaskViewModel {
    constructor({ job, map, filteredTeams }) {
        this.job = job;   // expects KO observables on the job (latitude/longitude/name/etc.)
        this.map = map;
        this.filteredTeams = filteredTeams; // from main VM
    }


    popupActive = ko.observable(false);   // gate to stop it from processing every time something changes under it

    popupTeamFilter = ko.observable('');



    drawCrowsFliesToAssetPassedTeam = (team) => {
        this.map.drawCrowsFliesToAssetPassedTeam(team, this.job)
    }

    removeCrowsFlies = () => {
        this.map.clearCrowFliesLine();
    }

    taskTeamToJobWithConfirm = (team) => {
        this.map.taskTeamToJobWithConfirm(this.job, team);
    }

    popupFilteredTeams = ko.pureComputed(() => {

        if (!this.popupActive()) return []; // short-circuit

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
                const summaryLine = [
                    tm.filteredTaskings().length + ' tasking(s)',
                    distance != null ? fmtDist(distance) : null,
                    backBearing != null ? fmtBearing(backBearing) : null,
                    distance == null && backBearing == null ? "Location unknown" : null,
                ].filter(Boolean).join(' • ');
                return {
                    team: tm,
                    taskings: tm.filteredTaskings,
                    currentTaskingSummary: tm.currentTaskingSummary,
                    summaryLine,
                    distanceMeters: distance,
                    mouseInTeamInInstantTaskPopup: () => {
                        this.drawCrowsFliesToAssetPassedTeam(tm);
                    },
                    mouseOutTeamInInstantTaskPopup: () => {
                        this.removeCrowsFlies();
                    },
                    taskTeamToJobWithConfirm: (d, e) => {
                        console.log(e);
                        const dropdown = e.target.closest('.dropdown-menu');
                        if (dropdown) {
                            dropdown.classList.remove('show');
                        }
                        this.taskTeamToJobWithConfirm(tm);
                        // Close the dropdown

                    }
                };
            })
            .sort((a, b) => {
                const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
                const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
                return da - db;
            });
    });

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
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
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


