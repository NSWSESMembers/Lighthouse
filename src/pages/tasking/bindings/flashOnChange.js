import ko from "knockout";

// Shared "this value just changed" mechanics: toggles cssClass on element whenever the bound
// value changes, so a CSS animation can pick it up. Doesn't fire on the initial render.
function makeFlashBindingHandler(cssClass) {
  return {
    init: function (element, valueAccessor) {
      let isFirstRun = true;
      let timeoutId = null;

      ko.computed({
        read: function () {
          ko.unwrap(valueAccessor());
          if (isFirstRun) {
            isFirstRun = false;
            return;
          }
          element.classList.remove(cssClass);
          void element.offsetWidth; // restart the animation if it's still running
          element.classList.add(cssClass);
          clearTimeout(timeoutId);
          timeoutId = setTimeout(function () {
            element.classList.remove(cssClass);
          }, 900);
        },
        disposeWhenNodeIsRemoved: element
      });

      ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
        clearTimeout(timeoutId);
      });
    }
  };
}

export function installFlashOnChangeBinding() {
  // data-bind="flashOnChange: someObservable" -- flashes the bound element's background.
  // Intended for elements that are already sized to their own content (buttons, badges,
  // pills) -- a background wash looks like a highlighted chip there. Avoid on elements
  // that span a wider container (e.g. a fixed-width table cell) since the flash then fills
  // the whole column behind the text rather than hugging it.
  ko.bindingHandlers.flashOnChange = makeFlashBindingHandler("flash-on-change");

  // data-bind="flashTextOnChange: someObservable" -- pulses the text itself (color + glow)
  // instead of filling a background box. Use this for plain text/icons inside wide or
  // full-width containers (table cells, full-width buttons) where a background flash would
  // look like an oversized block behind short text.
  ko.bindingHandlers.flashTextOnChange = makeFlashBindingHandler("flash-text-on-change");
}
