export function makePopupNode(html, className) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;   // pristine template
  el._tpl = html;        // cache pristine template
  return el;
}
export function resetPopupNode(el) {
  if (el && el._tpl) el.innerHTML = el._tpl;
}
export function bindKoToPopup(ko, vm, el) {
  if (!el || el.__ko_bound__) return;
  resetPopupNode(el);              // clean DOM to pristine before binding
  ko.applyBindings(vm, el);
  el.__ko_bound__ = true;
}
export function unbindKoFromPopup(ko, el) {
  if (!el || !el.__ko_bound__) return;
  try {
    ko.cleanNode(el);
  } catch (e) {
    // A concurrent reactive update (e.g. tasking data landing right as the
    // popup closes) can interrupt cleanNode's virtual-element tree walk.
    // The innerHTML reset below discards the whole subtree regardless, so
    // this is safe to ignore rather than let it surface as an uncaught
    // error -- and skipping delete/reset below would leave __ko_bound__
    // stuck true, silently breaking the next open.
  }
  delete el.__ko_bound__;
  resetPopupNode(el);              // leave clean for next open
}
export function deferPopupUpdate(p) {
  if (!p) return;
  Promise.resolve().then(() => p.update && p.update());
  requestAnimationFrame(() => p.update && p.update());
}