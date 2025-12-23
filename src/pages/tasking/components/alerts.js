import L from 'leaflet';
import ko from 'knockout';

const ruleState = new Map(); // key: rule.id -> { collapsed: boolean, lastCount: number }

/**
 * SVG hazard icon used in the header
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
/**
 * Render a list of active rules into the container. - RAW html no KO here yet
 * Each rule: { id, level, title, items:[{id,label}], count, onClick? }
 */
function renderRules(container, rules) {
  container.style.display = rules.length ? '' : 'none';
  container.innerHTML = '';

  for (const rule of rules) {
    // --- restore / update state for this rule ---
    let state = ruleState.get(rule.id);
    if (!state) {
      state = { collapsed: false, lastCount: rule.count };
    } else {
      // if the count changed while collapsed, auto-expand
      if (state.collapsed && rule.count !== state.lastCount) {
        state.collapsed = false;
      }
      state.lastCount = rule.count;
    }
    ruleState.set(rule.id, state);

    const div = document.createElement('div');
    var width = '280px'
    div.className = `leaflet-control alerts alerts--${rule.level}`;
    if (state.collapsed) {
      div.classList.add('alerts--collapsed');
      width = "24px"
  }

    div.innerHTML = `
      <div class="alerts" style="width: ${width};">
        <div class="alerts__header">
          <button type="button" class="alerts__btn" aria-expanded="${!state.collapsed}">
            ${hazardSvg()}
            <span class="alerts__title">${rule.title}</span>
            <span class="alerts__count">${rule.count}</span>
          </button>
          <button type="button" class="alerts__hide-btn" aria-label="Hide alerts">&times;</button>
        </div>
        <div class="alerts__panel">
          <ul class="alerts__list small">
            ${rule.items.map(it => `<li data-id="${it.id}">${it.label}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    const btn = div.querySelector('.alerts__btn');
    const hideBtn = div.querySelector('.alerts__hide-btn');

    // main button: toggle open; if collapsed, un-collapse first
    btn.addEventListener('click', () => {
      const st = ruleState.get(rule.id) || { collapsed: false, lastCount: rule.count };

      if (st.collapsed) {
        st.collapsed = false;
        ruleState.set(rule.id, st);
        div.classList.remove('alerts--collapsed');
              div.querySelector('.alerts').style.width = '280px';

      }

      const openNow = !div.classList.contains('alerts--open');
      div.classList.toggle('alerts--open', openNow);
      btn.setAttribute('aria-expanded', String(openNow));
    });

    // hide button: collapse down to icon
    hideBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const st = ruleState.get(rule.id) || { collapsed: false, lastCount: rule.count };
      st.collapsed = true;
      st.lastCount = rule.count;
      ruleState.set(rule.id, st);

      div.classList.remove('alerts--open');
      btn.setAttribute('aria-expanded', 'false');
      
      div.querySelector('.alerts').animate(
        [{ width: '280px' }, { width: '24px' }],
        { duration: 300, easing: 'ease-in-out' }
      ).onfinish = () => {
        div.querySelector('.alerts').style.width = '24px';
      };
      div.classList.add('alerts--collapsed');
    });

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
  const allJobs = vm.filteredJobsAgainstConfig(); // respects status/HQ filters but ignores pinned

  const pinnedOnlyIncidents = vm.showPinnedIncidentsOnly();
  const pinnedIncidentIds = (vm.config && vm.config.pinnedIncidentIds) ? vm.config.pinnedIncidentIds() : [];
  const pinnedSet = new Set((pinnedIncidentIds || []).map(String));

  const jobKey = (j) => String(j.id?.());
  const isPinnedIncident = (j) => pinnedSet.has(jobKey(j));

  // If pinned-only: alerts should be generated ONLY from pinned incidents.
  const jobs = pinnedOnlyIncidents ? allJobs.filter(isPinnedIncident) : allJobs;

  // --- helpers / predicates used by both pinned + hidden summarisation ---
  const isNew = (j) => (j.statusName && j.statusName() === 'New');
  const isUntaskedActive = (j) =>
    (Array.isArray(j.taskings()) && j.taskings().length === 0) && j.statusName && j.statusName() === 'Active';
  const hasUnackedNotifications = (j) =>
    (Array.isArray(j.unacceptedNotifications()) && j.unacceptedNotifications().length > 0);
  const isUnGeoCoded = (j) => {
    const lat = j.address?.latitude?.();
    const lng = j.address?.longitude?.();
    return lat == null || lng == null;
  };
  const isCompletable = (j) => {
    if (j.statusName && j.statusName() !== 'Active') return false;
    if (j.taskings().length === 0) return false;
    const incompleteTaskings = j.taskings().every(t => t.isComplete?.() === false);
    const someoneDidSomething = j.taskings().some(t => t.isComplete?.() === true);
    if (!incompleteTaskings && someoneDidSomething) return true;
    if (!incompleteTaskings) return false;
    if (!someoneDidSomething) return false;
    return true;
  };

  // --- rules (based on `jobs`, which respects pinnedOnlyIncidents) ---
  const newJobs = jobs.filter(isNew);
  const untasked = jobs.filter(isUntaskedActive);
  const unackedNotifications = jobs.filter(hasUnackedNotifications);
  const unGeoCoded = jobs.filter(isUnGeoCoded);
  const completableJobs = jobs.filter(isCompletable);

  const asItem = j => ({
    id: jobKey(j),
    label: jobKey(j) + ' — ' + j.type() + ' — ' + (j.address?.prettyAddress?.() || '')
  });

  // --- single summary rule for “alerts hidden because incident isn’t pinned” ---
  let hiddenCount = 0;
  if (pinnedOnlyIncidents) {
    const hiddenJobs = allJobs.filter(j => !isPinnedIncident(j));
    const hiddenThatWouldAlert = hiddenJobs.filter(j =>
      isNew(j) || isUntaskedActive(j) || hasUnackedNotifications(j) || isCompletable(j) || isUnGeoCoded(j)
    );

    // count unique incidents (defensive)
    const uniq = new Set(hiddenThatWouldAlert.map(jobKey));
    hiddenCount = uniq.size;
  }

  return [
    ...(pinnedOnlyIncidents && hiddenCount > 0 ? [{
      id: 'hidden-unpinned-summary',
      level: 'info',
      title: 'Alerts hidden (from unpinned incidents)',
      active: true,
      items: [{ id: '__show_all__', label: `Show all incidents (${hiddenCount} hidden)` }],
      count: hiddenCount,
      onClick: (id) => {
        if (id === '__show_all__' && typeof vm.showPinnedIncidentsOnly === 'function') {
          vm.showPinnedIncidentsOnly(false);
        }
      }
    }] : []),

    {
      id: 'new-jobs',
      level: 'warning',
      title: 'Unacknowledged incidents',
      active: newJobs.length > 0,
      items: newJobs.slice(0, 10).map(asItem),
      count: newJobs.length,
      onClick: (id) => {
        const found = jobs.find(j => jobKey(j) === id);
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
        const found = jobs.find(j => jobKey(j) === id);
        found?.focusMap();
      }
    },
    {
      id: 'unacked-notifications',
      level: 'danger',
      title: 'Unacknowledged notifications',
      active: unackedNotifications.length > 0,
      items: unackedNotifications.slice(0, 10).map(asItem),
      count: unackedNotifications.length,
      onClick: (id) => {
        const found = jobs.find(j => jobKey(j) === id);
        found?.focusMap();
      }
    },
    {
      id: 'completable-jobs',
      level: 'info',
      title: 'Incidents pending completion',
      active: completableJobs.length > 0,
      items: completableJobs.slice(0, 10).map(asItem),
      count: completableJobs.length,
      onClick: (id) => {
        const found = jobs.find(j => jobKey(j) === id);
        found?.focusMap();
      }
    },
    {
      id: 'ungeocoded-jobs',
      level: 'caution',
      title: 'Incidents missing geolocation',
      active: unGeoCoded.length > 0,
      items: unGeoCoded.slice(0, 10).map(asItem),
      count: unGeoCoded.length,
      onClick: (id) => {
        const found = jobs.find(j => jobKey(j) === id);
        found?.focusAndExpandInList();
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