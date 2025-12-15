import L from 'leaflet';
import moment from 'moment';

export function buildIcon(asset, matchStatus) {
    const capabilityColors = {
        'Bus': '#FFD600',
        'Command': '#1565C0',
        'Community First Responder': '#D32F2F',
        'General Purpose': '#8E24AA',
        'Logistics': '#795548',
        'Light Storm': '#FB8C00',
        'Medium Storm': '#EF6C00',
        'Light Rescue': '#C62828',
        'Medium Rescue': '#B71C1C',
        'Heavy Rescue': '#880E4F',
        'SHQ Pool': '#5D4037',
        'vessel': '#0288D1',
        'portable': '#43A047'
    };

    const bg = capabilityColors[asset.capability()] || '#1565C0';
    const dull = (() => {
        try {
            const days = moment().diff(asset.lastSeen(), 'days');
            return days > 1 ? 'filter:contrast(0.3);' : '';
        } catch { return ''; }
    })();

    const matchTextColor = matchStatus === 'unmatched' ? 'grey' : 'white';

    const html =
        `<div style="background-color:${bg};${dull}" class="marker-pin"></div>
     <div class="assetMarker" style="position:absolute;margin:24px 13px;line-height:10px;text-align:center;color:${matchTextColor};font-size:11px;width:60%">
       <p>${asset.markerLabel()}</p>
     </div>`;

    return L.divIcon({
        className: 'custom-div-icon',
        html,
        iconSize: [40, 56],
        iconAnchor: [24, 56],
        popupAnchor: [0, -35]
    });
}