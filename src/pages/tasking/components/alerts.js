import L from 'leaflet';
import ko from 'knockout';

/**
 * Simple SVG hazard icon used in the header
 */
function hazardSvg() {
  return `
  <svg class="alerts__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M1,21h22L12,2L1,21z M13,18h-2v-2h2V18z M13,14h-2v-4h2V14z"/>
  </svg>`;
}

/**
 * Create the Leaflet control container.
 * Returns { control: L.Control, container: HTMLElement }
 */
function createLeafletControl(L) {
  const ctl = L.control({ position: 'topright' });
  ctl.onAdd = function () {
    const container = L.DomUtil.create('div', 'alerts-root');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    ctl._container = container; // store for later
    return container;
  };
  return ctl;
}

/**
 * Render a list of active rules into the container. - RAW html no KO here yet
 * Each rule: { id, level, title, items:[{id,label}], count, onClick? }
 */
function renderRules(container, rules) {
  container.style.display = rules.length ? '' : 'none';
  container.innerHTML = '';

  for (const rule of rules) {
    const div = document.createElement('div');
    div.className = `leaflet-control alerts alerts--${rule.level}`;
    div.innerHTML = `
      <div class="alerts">
        <button type="button" class="alerts__btn" aria-expanded="false">
          ${hazardSvg()} <span class="alerts__title">${rule.title}</span>
          <span class="alerts__count">${rule.count}</span>
        </button>
        <div class="alerts__panel">
          <ul class="alerts__list small">
            ${rule.items.map(it => `<li data-id="${it.id}">${it.label}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
    const btn = div.querySelector('.alerts__btn');
    btn.addEventListener('click', () => div.classList.toggle('alerts--open'));

    // optional item click handler (e.g. fly to job)
    if (typeof rule.onClick === 'function') {
      div.querySelectorAll('li[data-id]').forEach(li => {
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => rule.onClick(li.getAttribute('data-id')));
      });
    }

    container.appendChild(div);
  }
}


const ruleBuilders = [];

/** Public: register a new rule builder */
/** can add new rules via code with this */
export function registerAlertRule(fn) {
  if (typeof fn === 'function') ruleBuilders.push(fn);
}


function buildDefaultRules(vm) {
  const jobs = vm.filteredJobsIgnoreSearch(); // already respects status/HQ filters

  const newJobs = jobs.filter(j => (j.statusName && j.statusName() === 'New'));
  const untasked = jobs.filter(j => (Array.isArray(j.taskings()) && j.taskings().length === 0));

  const asItem = j => ({
    id: j.identifier?.() ?? j.id?.(),
    label: (j.identifier?.() || j.id?.()) + ' — ' + j.type() + ' — '+ (j.address?.prettyAddress?.() || '')
  });

  return [
    {
      id: 'new-jobs',
      level: 'warning',
      title: 'Unacknowledged incidents',
      active: newJobs.length > 0,
      items: newJobs.slice(0, 10).map(asItem),
      count: newJobs.length,
      onClick: (id) => {
        // optional: focus the job if present
        const found = jobs.find(j => (j.identifier?.() ?? j.id?.()) === id);
        found?.focusMap();
      }
    },
    {
      id: 'untasked-jobs',
      level: 'caution',
      title: 'Untasked incidents',
      active: untasked.length > 0,
      items: untasked.slice(0, 10).map(asItem),
      count: untasked.length,
      onClick: (id) => {
        // optional: focus the job if present
        const found = jobs.find(j => (j.identifier?.() ?? j.id?.()) === id);
        found?.focusMap();
      }
    }
  ];
}

/**
 * installAlerts(map, vm)
 * - Adds a Leaflet control
 * - Subscribes via ko.computed to VM changes
 * - Renders rules (defaults + registered)
 */
export function installAlerts(map, vm) {
  const control = createLeafletControl(L);
  control.addTo(map);

  const el = control.getContainer();

  requestAnimationFrame(() => {
    el.classList.add('alerts-root--intro');
    el.addEventListener('animationend', () => {
      el.classList.remove('alerts-root--intro');
    }, { once: true });
  });

  // Ensure we always have the default rules + any external registered rules
  const computeActiveRules = () => {
    const defaults = buildDefaultRules(vm);
    const extra = ruleBuilders.flatMap(b => {
      try { return b(vm) || []; } catch { return []; }
    });
    return [...defaults, ...extra].filter(r => r && r.active);
  };

  ko.computed(() => {
    const rules = computeActiveRules();
    renderRules(el, rules);
  });

  return { control, registerAlertRule }; // allow caller to register later if desired
}