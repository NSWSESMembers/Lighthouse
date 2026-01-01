var L = require('leaflet');

// Legend control (collapsible)
export const LegendControl = L.Control.extend({
  options: { position: "bottomleft", collapsed: false, persist: true },

  onAdd() {
    const div = L.DomUtil.create("div", "legend-container leaflet-bar");
    div.innerHTML = `
      <div class="legend-header d-flex justify-content-between align-items-center">
        <span class="fw-semibold">Legend</span><br>
        <button class="btn btn-sm btn-outline-secondary toggle-legend" type="button" aria-expanded="true">−</button>
      </div>
      <div class="legend-body mt-1">

    <div class="mb-2">
      <div class="fw-semibold small mb-1">Incident Type → Shape</div>
      <div class="d-flex flex-wrap gap-2 small align-items-center">
        <div><svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#000" stroke-width="2"/></svg> Storm</div>
        <div><svg width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="2" ry="2" fill="none" stroke="#000" stroke-width="2"/></svg>Support</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" fill="none" stroke="#000" stroke-width="2"/></svg> Flood Rescue</div>
        <div><svg width="16" height="16"><polygon points="8,2 2,14 14,14" fill="none" stroke="#000" stroke-width="2"/></svg> Flood Support</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,8 8,14 2,8" fill="none" stroke="#000" stroke-width="2"/></svg> Rescue</div>
        <div><svg width="16" height="16"><polygon points="8,0 10,6 16,6 11,10 13,16 8,12 3,16 5,10 0,6 6,6" fill="none" stroke="#000" stroke-width="2"/></svg> Tsunami</div>
      </div>
    </div>

    <div class="mb-2">
      <div class="fw-semibold small mb-1">Priority → Fill</div>
      <div class="d-flex flex-wrap gap-2 small">
        <div><span class="legend-box" style="background:#FFA500"></span> Priority</div>
        <div><span class="legend-box" style="background:#4F92FF"></span> Immediate</div>
        <div><span class="legend-box" style="background:#FF0000"></span> Rescue</div>
        <div><span class="legend-box" style="background:#0fcb35ff"></span> General</div>
      </div>
    </div>

    <div>
      <div class="fw-semibold small mb-1">FR: Category → Fill</div>
      <div class="d-flex flex-wrap gap-2 small">
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" stroke="#000" fill="#7F1D1D" stroke-width="2"/></svg> Cat 1</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" stroke="#000" fill="#DC2626" stroke-width="2"/></svg> Cat 2</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" stroke="#000" fill="#EA580C" stroke-width="2"/></svg> Cat 3</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" stroke="#000" fill="#EAB308" stroke-width="2"/></svg> Cat 4</div>
        <div><svg width="16" height="16"><polygon points="8,2 14,6 12,14 4,14 2,6" stroke="#000" fill="#16A34A" stroke-width="2"/></svg> Cat 5</div>
      </div>
    </div>


    <div>
      <div class="fw-semibold small mb-1">Overlays</div>
      <div class="d-flex flex-wrap gap-2 small legend-ring ">
        <div><div class="pulse-ring-icon"></div><svg  class="pulse-ring" width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="#000" stroke-width="2"/></svg> Unacknowledged incident</div>
      </div>
    </div>
    <div class="legend-section">
    <br>
  <div class="fw-semibold small mb-1">Assets</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:12px;row-gap:2px;">

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#FFD600;margin-right:6px;border:1px solid #333;"></span>
      <span>Bus</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#1565C0;margin-right:6px;border:1px solid #333;"></span>
      <span>Command</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#D32F2F;margin-right:6px;border:1px solid #333;"></span>
      <span>Community First Responder</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#8E24AA;margin-right:6px;border:1px solid:#333;"></span>
      <span>General Purpose</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#795548;margin-right:6px;border:1px solid:#333;"></span>
      <span>Logistics</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#FB8C00;margin-right:6px;border:1px solid:#333;"></span>
      <span>Light Storm</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#EF6C00;margin-right:6px;border:1px solid:#333;"></span>
      <span>Medium Storm</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#C62828;margin-right:6px;border:1px solid:#333;"></span>
      <span>Light Rescue</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#B71C1C;margin-right:6px;border:1px solid:#333;"></span>
      <span>Medium Rescue</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#880E4F;margin-right:6px;border:1px solid:#333;"></span>
      <span>Heavy Rescue</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#5D4037;margin-right:6px;border:1px solid:#333;"></span>
      <span>SHQ Pool</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#0288D1;margin-right:6px;border:1px solid:#333;"></span>
      <span>Vessel</span>
    </div>

    <div style="display:flex;align-items:center;margin:2px 0;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#43A047;margin-right:6px;border:1px solid:#333;"></span>
      <span>Portable</span>
    </div>

  </div>
</div>

    </div>
    `;

    this._container = div;
    this._body = div.querySelector(".legend-body");
    this._btn = div.querySelector(".toggle-legend");

    // initial state
    const collapsed =
      this.options.persist &&
      localStorage.getItem("legendCollapsed") === "1"
        ? true
        : !!this.options.collapsed;
    this._setCollapsed(collapsed);

    // prevent map drag/zoom on click
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(this._btn, "click", this._toggle, this);

    return div;
  },

  onRemove() {
    if (this._btn) L.DomEvent.off(this._btn, "click", this._toggle, this);
  },

  _toggle(e) {
    L.DomEvent.stop(e);
    const hidden = this._body.classList.toggle("d-none");
    this._btn.textContent = hidden ? "+" : "−";
    this._btn.setAttribute("aria-expanded", String(!hidden));
    if (this.options.persist)
      localStorage.setItem("legendCollapsed", hidden ? "1" : "0");
  },

  _setCollapsed(collapsed) {
    if (!this._body || !this._btn) return;
    this._body.classList.toggle("d-none", collapsed);
    this._btn.textContent = collapsed ? "+" : "−";
    this._btn.setAttribute("aria-expanded", String(!collapsed));
  },
});
