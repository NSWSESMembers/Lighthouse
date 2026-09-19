/*
  `autoGrow: someObservable` -- sizes a <textarea> to fit its content (no
  scrollbar, no manual dragging) and re-sizes whenever the bound observable
  changes (text added by Get Data or a snippet, typing, a re-generate) or the
  window width changes the wrapping.
*/

export function fitTextareaToContent(el) {
  if (!el || el.offsetParent === null) return; // hidden -- nothing to measure yet
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + (el.offsetHeight - el.clientHeight) + 'px';
}

/** @param {typeof import('knockout')} ko */
export function registerAutoGrow(ko) {
  ko.bindingHandlers.autoGrow = {
    init(el) {
      const refit = () => fitTextareaToContent(el);
      el.addEventListener('input', refit);
      window.addEventListener('resize', refit);
      ko.utils.domNodeDisposal.addDisposeCallback(el, () => window.removeEventListener('resize', refit));
      setTimeout(refit, 0); // after first layout
    },
    update(el, valueAccessor) {
      ko.unwrap(valueAccessor()); // subscribe to the bound value
      setTimeout(() => fitTextareaToContent(el), 0); // after knockout has written the new value into the DOM
    },
  };
}
