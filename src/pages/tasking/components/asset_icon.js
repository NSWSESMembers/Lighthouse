import L from 'leaflet';
import moment from 'moment';

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

/** The asset's pin colour (by capability); breadcrumb trails use it too. */
export function assetColor(asset) {
    return capabilityColors[asset.capability()] || '#1565C0';
}

export function buildIcon(asset, matchStatus) {
    const bg = assetColor(asset);
    const dull = (() => {
        try {
            const days = moment().diff(asset.lastSeen(), 'days');
            return days > 1 ? 'filter:contrast(0.3);' : '';
        } catch { return ''; }
    })();

    const matchTextColor = matchStatus === 'unmatched' ? 'grey' : 'white';

    // Laid out by markers/assetPinLayout.js: .asset-pin__rot rotates the
    // head (body + label) and stem around the tip, and the label is
    // counter-rotated so it stays upright. The tip sits exactly on the icon
    // anchor.
    const html =
        `<div class="asset-pin" style="--pin-color:${bg}">
       <div class="asset-pin__rot">
         <div class="asset-pin__stem" style="${dull}"></div>
         <div class="asset-pin__head">
           <div class="asset-pin__body" style="${dull}"></div>
           <div class="asset-pin__label assetMarker" style="color:${matchTextColor}">
             <p>${asset.markerLabel()}</p>
           </div>
         </div>
       </div>
       <div class="asset-pin__dot" style="${dull}"></div>
     </div>`;

    return L.divIcon({
        className: 'custom-div-icon asset-pin-icon',
        html,
        iconSize: [40, 56],
        iconAnchor: [20, 56],
        popupAnchor: [0, -42]
    });
}