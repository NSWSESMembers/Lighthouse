var L = require('leaflet');
import { openURLInBeacon } from '../utils/chromeRunTime.js';


function makeSpinnerIcon() {
    return L.divIcon({
        className: '',
        html: `
      <div class="geo-spinner">
        <div class="spinner-border spinner-border-sm text-danger"></div>
      </div>
    `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

const source = getQueryParam("source");

const createJobUrl = (result) => {



    function encode(obj) {
        return encodeURIComponent(JSON.stringify(obj));
    }
    const obj = { additional: result.Title, geo: toLadReverseGeocodeShape(result) };
    return `${source}/Jobs/Create?lhquickCreate=${encode(obj)}`;
}



export function installMapContextMenu({
    map,
    geocodeEndpoint = 'https://lambda.lighthouse-extension.com/lad/geocode',
    geocodeMarkerIcon = null,            // pass your defaultSvgIcon if you want
    geocodeRedMarkerIcon = null,         // pass your defaultRedSvgIcon if you want
    geocodeMaxResults = 10,
}) {
    const ctxMenu = document.getElementById("mapContextMenu");
    const btnSearch = document.getElementById("ctxSearchHere");
    const btnGeocode = document.getElementById("ctxGeocodeHere");

    if (!map || !ctxMenu || !btnSearch || !btnGeocode) {
        console.warn("MapContextMenu: missing dependencies or DOM");
        return;
    }

    L.DomEvent.disableClickPropagation(ctxMenu);
    L.DomEvent.disableScrollPropagation(ctxMenu);

    let lastLatLng = null;

    // Layer for reverse-geocode markers (cleared/replaced each time)
    const geocodeResultsLayer = L.layerGroup().addTo(map);
    const geocodeClickedPointLayer = L.layerGroup().addTo(map);

    const hideMenu = () => {
        ctxMenu.style.display = "none";
    };

    const showMenuAt = (clientX, clientY) => {
        ctxMenu.style.left = `${clientX}px`;
        ctxMenu.style.top = `${clientY}px`;
        ctxMenu.style.display = "block";
    };

    map.on("click zoomstart movestart", hideMenu);
    document.addEventListener("keydown", (e) => e.key === "Escape" && hideMenu());
    document.addEventListener("click", (e) => {
        if (!ctxMenu.contains(e.target)) hideMenu();
    });

    map.on("contextmenu", (e) => {
        lastLatLng = e.latlng;

        const p = map.latLngToContainerPoint(e.latlng);
        const rect = map.getContainer().getBoundingClientRect();
        showMenuAt(rect.left + p.x, rect.top + p.y);
    });



    // ---- SEARCH ----
    btnSearch.addEventListener("click", () => {
        hideMenu();

        const ctl = document.querySelector(".leaflet-control-geosearch");
        const toggle = ctl?.querySelector("a");
        toggle?.click();

        queueMicrotask(() => {
            const input =
                document.getElementById("leaflet-control-geosearch-qry") ||
                ctl?.querySelector("input");
            input?.focus();
        });
    });

    // ---- REVERSE GEOCODE ----
    btnGeocode.addEventListener("click", async () => {
        hideMenu();
        if (!lastLatLng) return;

        // one-time setup
        map.on('click', () => {
            geocodeResultsLayer.clearLayers();
            geocodeClickedPointLayer.clearLayers();
        });


        // clear previous markers
        geocodeResultsLayer.clearLayers();
        geocodeClickedPointLayer.clearLayers();

        //show spinner at clicked point
        const spinnerMarker = L.marker(lastLatLng, {
            icon: makeSpinnerIcon(),
            pane: 'pane-top-plus',
            interactive: false,
        }).addTo(geocodeClickedPointLayer);

        let json;
        try {
            const url = new URL(geocodeEndpoint.replace(/\/$/, ''));
            url.searchParams.set('lat', String(lastLatLng.lat));
            url.searchParams.set('lon', String(lastLatLng.lng));

            const res = await fetch(url.toString(), { method: 'GET' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            json = await res.json();
        } catch (e) {
            geocodeClickedPointLayer.removeLayer(spinnerMarker);
            L.marker(lastLatLng, {
                icon: geocodeRedMarkerIcon,
                pane: 'pane-top-plus',
            })
                .bindPopup('Reverse geocode failed')
                .addTo(geocodeClickedPointLayer);
            return;
        }

        //swap spinner for normal clicked marker
        geocodeClickedPointLayer.removeLayer(spinnerMarker);
        L.marker(lastLatLng, {
            icon: geocodeRedMarkerIcon,
            pane: 'pane-top-plus',
        })
            .bindPopup(`Clicked location<br>${lastLatLng.lat.toFixed(6)}, ${lastLatLng.lng.toFixed(6)}`)
            .addTo(geocodeClickedPointLayer);


        const items = Array.isArray(json?.results) ? json.results : [];
        const top = items.slice(0, Math.max(0, geocodeMaxResults | 0));

        const bounds = [[lastLatLng.lat, lastLatLng.lng]];

        top.forEach((r, _idx) => {
            const pt = r?.Position; // [lon, lat]
            const lon = Array.isArray(pt) ? Number(pt[0]) : NaN;
            const lat = Array.isArray(pt) ? Number(pt[1]) : NaN;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

            const title = (r?.Title ?? '').trim();
            const addr = r?.Address ?? {};
            const addrLabel = (addr?.Label ?? '').trim();

            const placeType = r?.PlaceType ?? '';
            const distanceM = Number.isFinite(Number(r?.Distance)) ? Number(r.Distance) : null;

            const cats = Array.isArray(r?.Categories) ? r.Categories : [];
            const primaryCat = cats.find(c => c?.Primary) ?? cats[0] ?? null;
            const catText = cats
                .slice(0, 3)
                .map(c => (c?.LocalizedName || c?.Name || c?.Id || '').trim())
                .filter(Boolean)
                .join(', ');

            const city = (addr?.Locality || addr?.District || '').trim();
            const region = (addr?.Region?.Code || addr?.Region?.Name || '').trim();
            const postcode = (addr?.PostalCode || '').trim();

            const shortLine = [
                title || addrLabel || 'Result',
                primaryCat?.LocalizedName || primaryCat?.Name || primaryCat?.Id || '',
            ].filter(Boolean).join(' • ');

            const popupHtml = `
  <div style="min-width:260px">
    <div style="font-weight:700; margin-bottom:4px">${escapeHtml(title || addrLabel || 'Result')}</div>
    ${addrLabel ? `<div style="margin-bottom:6px">${escapeHtml(addrLabel)}</div>` : ''}

    <table class="table table-sm mb-2">
      <tbody>
        ${distanceM != null ? `<tr><th style="width:110px">Distance</th><td>${distanceM} m</td></tr>` : ''}
        ${placeType ? `<tr><th>Type</th><td>${escapeHtml(placeType)}</td></tr>` : ''}
        ${catText ? `<tr><th>Categories</th><td>${escapeHtml(catText)}</td></tr>` : ''}
        ${(city || region || postcode) ? `<tr><th>Area</th><td>${escapeHtml([city, region, postcode].filter(Boolean).join(' '))}</td></tr>` : ''}
        <tr><th>Coords</th><td>${lat.toFixed(6)}, ${lon.toFixed(6)}</td></tr>
      </tbody>
    </table>

    ${createJobUrl ? `
      <div class="d-grid">
      <a
          class="btn btn-sm btn-outline-primary"
          href="${createJobUrl(r)}"
          target="_blank"
          rel="noopener"
        >
          Create Incident
        </a>
      </div>
    ` : ''}
  </div>
`.trim();

            const markerOpts = {};
            if (geocodeMarkerIcon) markerOpts.icon = geocodeMarkerIcon;
            markerOpts.pane = 'pane-top-plus';

            const m = L.marker([lat, lon], markerOpts);

            // quick label on hover (optional)
            if (shortLine) m.bindTooltip(shortLine, { direction: 'top', sticky: true });

            // full details on click
            m.bindPopup(popupHtml);

            m.on('popupopen', () => {
                const popup = m.getPopup();
                if (!popup) return;
                const btn = popup.getElement()?.querySelector('.btn-outline-primary');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        openURLInBeacon(btn.href);
                    });
                }
            });

            m.addTo(geocodeResultsLayer);
            bounds.push([lat, lon]);
        });

        // helper (put once in the module, eg near top/bottom)
        function escapeHtml(s) {
            return String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // zoom to results if we have any
        if (bounds.length === 1) {
            map.setView(bounds[0], Math.max(map.getZoom(), 16));
        } else if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [30, 30] });
        }
    });
}

function extractUnitLevel(secondaryAddressComponents) {
    // SecondaryAddressComponents: [{ Designator, Number }] :contentReference[oaicite:2]{index=2}
    const comps = Array.isArray(secondaryAddressComponents)
        ? secondaryAddressComponents
        : [];

    let Flat = null;
    let Level = null;

    for (const c of comps) {
        const d = upperOrNull(c?.Designator);
        const n = strOrNull(c?.Number);
        if (!d || !n) continue;

        // Heuristics (tweak as needed for your data)
        if (!Flat && /(UNIT|APT|APARTMENT|SUITE|FLAT)/.test(d)) Flat = n;
        if (!Level && /(LEVEL|LVL|FLOOR)/.test(d)) Level = n;
    }

    return { Flat, Level };
}

function buildPrettyAddress(addr) {

    const streetNum = strOrNull(addr?.AddressNumber);
    const street = upperOrNull(addr?.Street);
    const district = upperOrNull(addr?.District);
    const regionCode = upperOrNull(addr?.Region?.Code) ?? upperOrNull(addr?.Region?.Name);
    const postCode = strOrNull(addr?.PostalCode);

    const line1 = [streetNum, street].filter(Boolean).join(" ").trim();
    const line2 = [district].filter(Boolean).join(" ").trim();
    const line3 = [regionCode].filter(Boolean).join(" ").trim();
    const line4 = [postCode].filter(Boolean).join(" ").trim();

    return [line1 || null, line2 || null, line3 || null, line4 || null].filter(Boolean).join(", ");
}

const s = (v) => (typeof v === "string" ? v.trim() : "");
const upperOrNull = (v) => (s(v) ? s(v).toUpperCase() : null);
const strOrNull = (v) => (s(v) ? s(v) : null);

function toLadReverseGeocodeShape(item) {
    if (!item) return null;

    const addr = item.Address ?? null; // :contentReference[oaicite:5]{index=5}
    const pos = Array.isArray(item.Position) ? item.Position : null; // [lon, lat] :contentReference[oaicite:6]{index=6}

    const longitude = pos && Number.isFinite(pos[0]) ? pos[0] : null;
    const latitude = pos && Number.isFinite(pos[1]) ? pos[1] : null;

    const { flat, level } = extractUnitLevel(addr?.SecondaryAddressComponents);

    return {
        address_pid: null, // not returned by AWS ReverseGeocode :contentReference[oaicite:7]{index=7}
        latitude,
        longitude,
        flat,
        level,
        number: strOrNull(addr?.AddressNumber),
        street: upperOrNull(addr?.Street),
        locality: upperOrNull(addr?.District),
        postcode: strOrNull(addr?.PostalCode),
        pretty_address: buildPrettyAddress(addr),
    };
}