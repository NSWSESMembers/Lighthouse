import ko from "knockout";
import $ from "jquery";

// Kill-switch: flip to false to fully disable list add/remove animations everywhere
// fadeForeach/slideForeach are used, without touching any of the data-bind attributes
// that reference them. Rows just appear/disappear instantly again, same as plain
// "foreach" -- nothing else about the binding changes.
const ENABLED = true;

const DURATION = 180;

function isElementNode(node) {
  return node.nodeType === 1; // ko's template engine can pass comment/text nodes here too
}

function removeImmediately(element) {
  if (element.parentNode) element.parentNode.removeChild(element);
}

// Drop-in replacements for the native "foreach" binding -- same
// "data-bind=\"fadeForeach: { data: someArray, as: 'x' }\"" usage -- that animate rows
// in/out on add/remove instead of popping them in place. Two variants because a
// height-based slide doesn't animate <tr> reliably across browsers, so table rows fade
// while free-standing list items (li/div) slide.
function makeAnimatedForeachBinding(animateIn, animateOut) {
  function wrapAccessor(valueAccessor) {
    return function () {
      const raw = ko.unwrap(valueAccessor());
      const options = (raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw)
        ? raw
        : { data: raw };

      return Object.assign({}, options, {
        afterAdd: function (el) {
          if (ENABLED && isElementNode(el)) animateIn(el);
          options.afterAdd?.apply(this, arguments);
        },
        beforeRemove: function (el) {
          if (ENABLED && isElementNode(el)) {
            animateOut(el);
          } else {
            removeImmediately(el);
          }
          options.beforeRemove?.apply(this, arguments);
        }
      });
    };
  }

  return {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
      return ko.bindingHandlers.foreach.init(element, wrapAccessor(valueAccessor), allBindings, viewModel, bindingContext);
    },
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
      return ko.bindingHandlers.foreach.update(element, wrapAccessor(valueAccessor), allBindings, viewModel, bindingContext);
    }
  };
}

export function installRowTransitionBindings() {
  ko.bindingHandlers.fadeForeach = makeAnimatedForeachBinding(
    (el) => $(el).hide().fadeIn(DURATION),
    (el) => $(el).stop(true, true).fadeOut(DURATION, function () { $(this).remove(); })
  );

  ko.bindingHandlers.slideForeach = makeAnimatedForeachBinding(
    (el) => $(el).hide().slideDown(DURATION),
    (el) => $(el).stop(true, true).slideUp(DURATION, function () { $(this).remove(); })
  );
}
