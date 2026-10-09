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
    'Pool Vehicle': '#5D4037',
    'vessel': '#0288D1',
    'portable': '#43A047',
    'High Clearance': '#00897B',
    'Support': '#546E7A',
    'Cell on Wheels': '#5E35B1',
    'General Land Rescue': '#C2185B',
    'Storm': '#F57C00',
    'Strategic Asset': '#37474F',
    'Corporate Command': '#0D47A1'
};

// Any other capability (or none): grey, so it isn't mistaken for Command.
const UNKNOWN_COLOR = '#757575';

// Short codes shown in a tab on top of the pin, so capabilities that share
// a colour family (the rescue tiers and CFR, the storm tiers) can be told
// apart without relying on colour. Toggled by config.showAssetCapabilityCodes.
const capabilityCodes = {
    'Bus': 'BUS',
    'Command': 'CMD',
    'Community First Responder': 'CFR',
    'General Purpose': 'GPV',
    'Logistics': 'LOG',
    'Light Storm': 'LSV',
    'Medium Storm': 'MSV',
    'Light Rescue': 'LRV',
    'Medium Rescue': 'MRV',
    'Heavy Rescue': 'HRV',
    'SHQ Pool': 'SHQ',
    'Pool Vehicle': 'SHQ',
    'vessel': 'VES',
    'portable': 'PRT',
    'High Clearance': 'HCV',
    'Support': 'SUP',
    'Cell on Wheels': 'COW',
    'General Land Rescue': 'GLR',
    'Storm': 'STM',
    'Strategic Asset': 'SAV',
    'Corporate Command': 'CCV'
};

/** The asset's pin colour (by capability); breadcrumb trails use it too. */
export function assetColor(asset) {
    return capabilityColors[capabilityKey(asset)] || UNKNOWN_COLOR;
}

/**
 * The asset's key into capabilityColors / capabilityCodes. Usually its
 * capability, but Beacon gives some vessels a capability of their class
 * ("Class 3") rather than "vessel", so vessels and portables also go by
 * their resourceType ("Vessel" / "Portable") when the capability isn't one
 * we know.
 */
function capabilityKey(asset) {
    const cap = String(asset.capability() ?? '');
    if (capabilityColors[cap]) return cap;
    const type = String(asset.resourceType?.() ?? '').toLowerCase();
    if (type === 'vessel' || type === 'portable') return type;
    return cap;
}

// Leaflet opens the popup at the icon anchor + popupAnchor (+ the layout's
// offset, see assetPinLayout.js writePlacement): 6.7px above the head's
// centre, where the popup's visible point just touches the top of the ring.
// While the code tab shows, 13px higher, so the point just touches the top
// of the tab instead. Leaflet reads
// popupAnchor afresh each time it places the popup, so changing it on a
// live icon takes effect on the next open or update.
const POPUP_ANCHOR = [0, -42];
const POPUP_ANCHOR_ABOVE_CODE = [0, -55];

let capabilityCodesShown = true;

/** The asset's popupAnchor, given whether its pin shows a code. */
function popupAnchorFor(hasCode) {
    return hasCode && capabilityCodesShown ? POPUP_ANCHOR_ABOVE_CODE : POPUP_ANCHOR;
}

/**
 * config.showAssetCapabilityCodes changed: icons built from now on, and the
 * given existing markers, open their popups above the code tab or not.
 */
export function setCapabilityCodesShown(on, markers = []) {
    capabilityCodesShown = !!on;
    markers.forEach((m) => {
        const opts = m.options?.icon?.options;
        if (!opts) return;
        opts.popupAnchor = popupAnchorFor(!!opts.capabilityCode);
        const popup = m.getPopup?.();
        if (popup?.isOpen()) popup.update();
    });
}

// Display names for capability keys that aren't already readable.
const capabilityNames = {
    'vessel': 'Vessel',
    'portable': 'Portable',
    'Pool Vehicle': 'SHQ Pool'
};

/**
 * The asset's capability as the map shows it: the readable name for its
 * pin colour and code (all vessels are "Vessel", Pool Vehicle is "SHQ
 * Pool"), or 'Other' for a capability without one.
 */
export function assetCapabilityName(asset) {
    const key = capabilityKey(asset);
    if (!capabilityColors[key]) return 'Other';
    return capabilityNames[key] || key;
}

/** The asset's capability code (e.g. 'HRV'), or '' if it has none. */
export function assetCapabilityCode(asset) {
    return capabilityCodes[capabilityKey(asset)] || '';
}

// The code tab, in coordinates centred on the head (the ring's outer edge is
// a 20px circle). A rounded tab 28px wide, its top 13px above the ring;
// each side curves out into the ring, meeting it at a tangent (the
// quadratic's control point is where the tab's side meets the ring's
// tangent). Its bottom closes along an 18.5px arc, inside the ring's
// colour, so it never covers the black core and leaves no seam at the
// ring's edge.
const CODE_TAB_PATH =
    'M-10,-33 H10 Q14,-33 14,-29 V-22 Q14,-16.98 18,-8.72 L16.65,-8.07 ' +
    'A18.5,18.5 0 0 0 -16.65,-8.07 L-18,-8.72 Q-14,-16.98 -14,-22 V-29 Q-14,-33 -10,-33 Z';

// Vessels show their class (e.g. 3) as a number in a small white box on the
// code tab's top right corner.

/**
 * A vessel's class, from its satellite tracker's class (e.g. "Class 3 550
 * Yamba V-Hull Gen 1" -> 3) or failing that its capability ("Class 3"), or
 * 0 if it isn't a vessel or has no class.
 */
export function vesselClass(asset) {
    if (capabilityKey(asset) !== 'vessel') return 0;
    const sources = [asset.satelliteClass?.(), asset.satelliteClassType?.(), asset.capability()];
    for (const src of sources) {
        const m = /class\s*(\d+)/i.exec(String(src ?? ''));
        if (m) return Number(m[1]) >= 1 ? Number(m[1]) : 0;
    }
    return 0;
}

/** Dark or white text, whichever reads better on the pin colour. */
function codeTextColor(hex) {
    const lin = (c) => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const n = parseInt(hex.slice(1), 16);
    const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return l > 0.32 ? '#141414' : '#fff';
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

    // The code sits in a tab on the far side of the head from the point, and
    // the ring flares out to meet it like it does into the point
    // (CODE_TAB_PATH). It's part of the head, so it swings with it and stays
    // opposite the point; assetPinLayout.js turns the code over once it's
    // past sideways, so it's never upside down. It's always rendered; the
    // config option just hides it (.asset-codes-off on the map container),
    // so toggling doesn't rebuild every icon.
    // A vessel's class rides on the tab's top right
    // corner, so it swings and turns over with the code.
    const code = assetCapabilityCode(asset);
    const cls = vesselClass(asset);
    const classBox = cls
        ? `<g class="asset-pin__classbox">
               <rect x="11" y="-36" width="12" height="12" rx="2.5" fill="#fff" stroke="rgba(0,0,0,0.55)" stroke-width="1"/>
               <text class="asset-pin__class" x="17" y="-30" fill="#1c1c1e">${cls}</text>
             </g>`
        : '';
    const codeTab = code
        ? `<svg class="asset-pin__code" viewBox="-20 -34 40 26" style="${dull}">
             <path d="${CODE_TAB_PATH}" fill="${bg}"/>
             <text x="0" y="-26.5" fill="${codeTextColor(bg)}">${code}</text>
             ${classBox}
           </svg>`
        : '';

    // Laid out by markers/assetPinLayout.js: .asset-pin__rot rotates the
    // head (body, code tab and label) and stem around the tip, and the label is
    // counter-rotated so it stays upright. The tip sits exactly on the icon
    // anchor.
    const html =
        `<div class="asset-pin" style="--pin-color:${bg}">
       <div class="asset-pin__rot">
         <div class="asset-pin__stem" style="${dull}"></div>
         <div class="asset-pin__head">
           <div class="asset-pin__body" style="${dull}"></div>
           ${codeTab}
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
        popupAnchor: popupAnchorFor(!!code),
        capabilityCode: code
    });
}