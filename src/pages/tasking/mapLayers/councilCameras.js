import L from "leaflet";
import { escapeHtml, httpUrl } from "../../../shared/feedHtml.js";
import { fetchCouncilDataset, fetchCouncilPath } from "../../../shared/councilSystems.js";

// Councils' flood monitoring cameras, through the council systems Lambda
// (lambda/council-systems-v2). The camera list comes from the Lambda, which
// never asks the council for it, so turning the layer on costs the council
// nothing. A camera's latest image is only looked up when its popup opens
// (the Lambda reads that one camera's page, cached for a few minutes); the
// image itself loads straight from the council's camera site, or, for a
// camera only published in a live video, comes in the Lambda's reply as a
// JPEG cut from it.

const REFRESH_MS = 60 * 60 * 1000; // the list rarely changes
const STALE_MINUTES = 45; // images are 15 minutes apart: three missed means it's not updating

const takenTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function ageText(minutes) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} hr${h === 1 ? "" : "s"}${m ? ` ${m} min` : ""} ago`;
  }
  return `${Math.floor(minutes / 1440)} days ago`;
}

const FOV_DEFAULT = 60;
const REACH_M = 150; // how far a camera's view is drawn: a typical road camera's useful view
const CONE_MIN_PX = 16; // shorter than this, the cone would hide under the camera: none
const CONE_MAX_PX = 800;
const SMALL_BELOW_ZOOM = 12; // a smaller camera when looking at a region

/** The cone's length on screen at this zoom, or 0 for none. */
function conePx(lat, zoom) {
  const metresPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
  const px = REACH_M / metresPerPx;
  return px < CONE_MIN_PX ? 0 : Math.min(CONE_MAX_PX, px);
}

// A wedge from the camera's lens (at `lens`), pointing north before rotation.
function cone(fov, len, lens) {
  const a = (fov / 2) * (Math.PI / 180);
  const x = (Math.sin(a) * len).toFixed(1);
  const y = (-Math.cos(a) * len).toFixed(1);
  return `<path class="lh-council-cam-cone" d="M0,${lens} L-${x},${y} A${len.toFixed(1)},${len.toFixed(1)} 0 0 1 ${x},${y} Z"/>`;
}

/**
 * A camera seen from above, turned to face the way it looks, with its view
 * as a cone from the lens, drawn 150 m long to scale, so it grows and
 * shrinks with the map. Zoomed out, the cone goes and the camera
 * gets smaller. Without a bearing it's upright with no cone. A dashed outline
 * is a position the council doesn't publish.
 */
function cameraIcon(p, lat, zoom) {
  const bearing = Number(p.bearing);
  const hasView = p.bearing != null && Number.isFinite(bearing);
  const fov = Math.min(170, Math.max(10, Number(p.fov) || FOV_DEFAULT));
  const len = hasView ? conePx(lat, zoom) : 0;
  const scale = zoom < SMALL_BELOW_ZOOM ? 0.7 : 1;
  const half = Math.ceil(Math.max(len, 12 * scale) + 4);
  return L.divIcon({
    className: "lh-council-cam-marker",
    html: `<svg class="lh-council-cam${p.approximate ? " lh-council-cam-approx" : ""}" viewBox="${-half} ${-half} ${2 * half} ${2 * half}" width="${2 * half}" height="${2 * half}">
      <g transform="rotate(${hasView ? bearing : 0})">
        ${len ? cone(fov, len, -9 * scale) : ""}
        <g class="lh-council-cam-body" transform="scale(${scale})">
          <rect x="-8" y="-5" width="16" height="17" rx="3"/>
          <path d="M-6,-5 L-8,-11 L8,-11 L6,-5 Z"/>
        </g>
      </g>
    </svg>`,
    iconSize: [2 * half, 2 * half],
    iconAnchor: [half, half],
    popupAnchor: [0, -14 * scale],
    tooltipAnchor: [12 * scale, 0],
  });
}

function links(p) {
  const out = [];
  const timelapse = httpUrl(p.timelapseUrl);
  const gauge = httpUrl(p.gaugeUrl);
  const live = httpUrl(p.liveUrl);
  if (live) out.push(`<a href="${escapeHtml(live)}" target="_blank" rel="noopener">Live video (all cameras)</a>`);
  if (timelapse) out.push(`<a href="${escapeHtml(timelapse)}" target="_blank" rel="noopener">4 hr time lapse</a>`);
  if (gauge) out.push(`<a href="${escapeHtml(gauge)}" target="_blank" rel="noopener">River gauge</a>`);
  return out.join(" · ");
}

// A still cut from a live video, sent as the JPEG itself.
const jpegDataUrl = (v) => (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(String(v ?? "")) ? v : "");

function latestHtml(latest, name) {
  if (latest.offline) return '<div class="lh-council-cam-msg">This camera is off: it\'s blank in the council\'s video.</div>';
  const link = httpUrl(latest.imageUrl);
  const image = link || jpegDataUrl(latest.imageUrl);
  if (!image) return '<div class="lh-council-cam-msg">No image from this camera.</div>';
  const taken = Date.parse(latest.takenAt);
  let when = "The time it was taken is on the image.";
  if (Number.isFinite(taken)) {
    const minutes = Math.max(0, Math.floor((Date.now() - taken) / 60000));
    when = `Taken ${escapeHtml(takenTime.format(taken))} (${ageText(minutes)})`;
    if (minutes >= STALE_MINUTES) {
      when = `<span class="lh-council-cam-stale"><i class="fas fa-exclamation-triangle"></i> ${when}: this camera may not be updating</span>`;
    }
  }
  const img = `<img src="${escapeHtml(image)}" alt="Latest image from ${escapeHtml(name)}">`;
  // Chrome won't open a data URL in a tab, and a still cut from a video is
  // already full size.
  const frame = link
    ? `<a class="lh-council-cam-frame" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="Open the full-size image">${img}</a>`
    : `<div class="lh-council-cam-frame">${img}</div>`;
  return `${frame}
    <div class="lh-council-cam-when">${when}</div>`;
}

/**
 * The popup: the camera's name and links straight away, then its latest
 * image once the Lambda says what it is. Built each time it opens, so the
 * image is always the latest.
 */
function cameraPopup(marker, p, getToken, attribution) {
  const el = document.createElement("div");
  el.className = "lh-council-cam-popup";
  el.innerHTML = `<strong>${escapeHtml(p.name)}</strong>
    <div class="lh-council-cam-latest"><div class="lh-council-cam-frame lh-council-cam-loading"><i class="fas fa-spinner fa-spin"></i></div></div>
    <div class="lh-council-cam-links">${links(p)}</div>
    ${p.approximate ? '<small class="lh-council-cam-note">Position approximate: the council doesn\'t publish where this camera is.</small>' : ""}
    <small class="lh-council-cam-note">${escapeHtml(attribution)}. Automated images, not checked by the council.</small>`;
  const slot = el.querySelector(".lh-council-cam-latest");
  const relayout = () => marker.getPopup()?.update();

  getToken()
    .then((token) => fetchCouncilPath(p.latestPath, token))
    .then((data) => {
      slot.innerHTML = latestHtml(data.features?.[0]?.properties || {}, p.name);
      slot.querySelector("img")?.addEventListener("load", relayout, { once: true });
      if (data.meta?.ok === false) {
        slot.insertAdjacentHTML("beforeend", '<div class="lh-council-cam-msg">The camera site isn\'t responding: this is the last image Lighthouse saw.</div>');
      }
    })
    .catch(() => {
      slot.innerHTML = '<div class="lh-council-cam-msg">Couldn\'t load this camera\'s latest image. Try again shortly, or use the time lapse link.</div>';
    })
    .finally(relayout);
  return el;
}

/**
 * One council's flood cameras, e.g. Tweed's. Each camera feature has
 * `latestPath`, where the Lambda serves its latest image.
 */
export function registerCouncilCamerasLayer(vm, getToken, { key, label, council, dataset, attribution, menu }) {
  vm.mapVM.registerPollingLayer(key, {
    label,
    ...menu,
    refreshMs: REFRESH_MS,
    visibleByDefault: localStorage.getItem(`ov.${key}`) || false,
    fetchFn: async () => fetchCouncilDataset(council, dataset, await getToken()),
    drawFn: (layerGroup, data) => {
      if (!data) return;
      const map = vm.mapVM.map;
      const cameras = [];
      for (const f of data.features) {
        const p = f.properties || {};
        const [lng, lat] = f.geometry?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !p.latestPath) continue;
        const marker = L.marker([lat, lng], { pane: "pane-middle", attribution, icon: cameraIcon(p, lat, map.getZoom()), title: p.name })
          .bindTooltip(escapeHtml(p.approximate ? `${p.name} (approximate position)` : p.name));
        // Content set on open, not a content function: Leaflet calls that
        // again on every update(), which would fetch again.
        marker.bindPopup("", { pane: "pane-popup-top", minWidth: 320, maxWidth: 320 });
        marker.on("popupopen", (e) => e.popup.setContent(cameraPopup(marker, p, getToken, attribution)));
        layerGroup.addLayer(marker);
        cameras.push({ marker, p, lat });
      }
      // The cones are drawn to scale: redraw them at each zoom. drawFn runs
      // again on each refresh, so drop the previous draw's handler.
      if (layerGroup._camZoomHandler) map.off("zoomend", layerGroup._camZoomHandler);
      layerGroup._camZoomHandler = () => {
        const zoom = map.getZoom();
        for (const c of cameras) c.marker.setIcon(cameraIcon(c.p, c.lat, zoom));
      };
      map.on("zoomend", layerGroup._camZoomHandler);
    },
  });
}

// All councils' cameras under one heading: each layer's label names its council.
const CAMERAS_MENU = { menuGroup: "Council Systems", menuSubgroup: "Council Flood Cameras" };

export function registerCouncilCamerasLayers(vm, getToken) {
  registerCouncilCamerasLayer(vm, getToken, {
    key: "tweedFloodCameras",
    label: "Tweed Flood Cameras",
    council: "tweed",
    dataset: "flood-cameras",
    attribution: "Tweed Shire Council flood monitoring cameras",
    menu: CAMERAS_MENU,
  });

  registerCouncilCamerasLayer(vm, getToken, {
    key: "clarenceFloodCameras",
    label: "Clarence Valley Flood Cameras",
    council: "clarence",
    dataset: "flood-cameras",
    attribution: "Clarence Valley Council flood monitoring cameras",
    menu: CAMERAS_MENU,
  });

  registerCouncilCamerasLayer(vm, getToken, {
    key: "bellingenFloodCameras",
    label: "Bellingen Flood Cameras",
    council: "bellingen",
    dataset: "flood-cameras",
    attribution: "Bellingen Shire Council bridge flood cameras",
    menu: CAMERAS_MENU,
  });

  registerCouncilCamerasLayer(vm, getToken, {
    key: "coffsHarbourBridgeCameras",
    label: "Coffs Harbour Flood Cameras",
    council: "coffsharbour",
    dataset: "flood-cameras",
    attribution: "City of Coffs Harbour bridge cameras",
    menu: CAMERAS_MENU,
  });
}
