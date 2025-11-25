import $ from "jquery";
import ko from "knockout";

export function installSlideVisibleBinding() {
  ko.bindingHandlers.slideVisible = {
    init: function (element, valueAccessor) {
      const visible = ko.unwrap(valueAccessor());
      $(element).toggle(!!visible);
    },
    update: function (element, valueAccessor) {
      const visible = ko.unwrap(valueAccessor());
      if (visible) {
        $(element).stop(true, true).slideDown(120);
      } else {
        $(element).stop(true, true).slideUp(120);
      }
    }
  };
}
