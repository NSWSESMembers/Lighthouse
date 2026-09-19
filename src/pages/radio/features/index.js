/*
  Optional radio-console features. Every other file in this directory is one
  feature and is picked up automatically -- adding a feature is adding a file,
  and removing one (or rolling it back) is removing that file; nothing else
  needs editing. A feature file exports:

    export const feature = {
      key: 'callsign-checks',              // stable id (used for the Settings switch)
      label: 'Callsign checks',            // its section in Settings > Experimental features
      description: 'One line on what it does.',
      icon: 'fa-stopwatch',                // optional Font Awesome icon for that section (default fa-flask)
      defaultEnabled: true,                // optional, default true
      install(vm, { ko, enabled, mount }) { ... },
    };

  `enabled` is the feature's on/off observable (bound to its Settings switch);
  a feature that is off must do nothing. `mount(slot, html)` inserts markup
  into one of the page's named slots (data-radio-slot="..." in radiocon.html)
  and returns the new element; it runs before Knockout binds the page, so the
  markup can use data-bind against the view model (`vm`) directly. The
  feature's own stylesheet is imported from its own file.

  Slots: page-top, entry-message-after, left-column-after-entry, body-end, and
  settings-body-end -- which is the feature's own section (accordion) in
  Settings > Experimental features, where the on/off switch, the description and
  whatever the feature mounts there are grouped together.
*/

const context = require.context('./', false, /^\.\/(?!index\.js$)[^/]+\.js$/);

/**
 * @param {object} vm  the radio console view model
 * @param {{ko: any, registry: ReturnType<typeof import('../lib/features.js').createFeatureRegistry>, document?: Document}} deps
 */
export function installFeatures(vm, { ko, registry, document: doc = document }) {
  vm.featureSwitches = vm.featureSwitches || {}; // camelCased key -> on/off observable, for the Settings markup
  const camel = (key) => key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // The feature's section in Settings: icon + name + On/Off in the header, and
  // (opened) its switch, description and own settings
  function addAccordionItem(feature) {
    const group = doc.querySelector('[data-radio-slot="feature-accordion"]');
    if (!group) return null;
    const sw = `featureSwitches.${camel(feature.key)}`;
    const item = doc.createElement('details');
    item.className = 'radio-accordion';
    item.setAttribute('data-radio-feature-item', feature.key);
    item.innerHTML = `
      <summary>
        <span class="radio-accordion-ico"><i class="fas ${escapeHtml(feature.icon || 'fa-flask')}"></i></span>
        <span class="radio-accordion-title">${escapeHtml(feature.label)}</span>
        <span class="radio-accordion-state" data-bind="visible: ${sw}">On</span>
        <span class="radio-accordion-state radio-accordion-state-off" data-bind="visible: !${sw}()">Off</span>
      </summary>
      <div class="radio-accordion-body">
        <label class="radio-checkbox-label radio-accordion-switch"><input type="checkbox" data-bind="checked: ${sw}"> Enabled</label>
        <p class="radio-settings-note">${escapeHtml(feature.description || '')}</p>
        <div data-radio-feature-settings></div>
      </div>`;
    group.appendChild(item);
    return item;
  }

  const mountFor = (key, item) => (slotName, html) => {
    const slot = slotName === 'settings-body-end' && item ? item.querySelector('[data-radio-feature-settings]') : doc.querySelector(`[data-radio-slot="${slotName}"]`);
    if (!slot) {
      console.error(`Radio console: feature "${key}" wants slot "${slotName}", which the page doesn't have`);
      return null;
    }
    const el = doc.createElement('div');
    el.setAttribute('data-radio-feature', key);
    el.innerHTML = html;
    slot.appendChild(el);
    return el;
  };

  context.keys().forEach((path) => {
    const feature = context(path).feature;
    if (!feature || !feature.key) return;
    try {
      const enabled = registry.register(feature);
      vm.featureSwitches[camel(feature.key)] = enabled;
      const item = addAccordionItem(feature);
      feature.install(vm, { ko, enabled, mount: mountFor(feature.key, item) });
    } catch (err) {
      // one broken feature must never take the console down with it
      console.error(`Radio console: feature "${feature.key}" failed to install`, err);
    }
  });
}
