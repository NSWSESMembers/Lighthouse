import ko from "knockout";

export function installRowVisibilityBindings() {
  ko.bindingHandlers.trVisible = {
    update: function (element, valueAccessor) {
      const value = ko.unwrap(valueAccessor());
      element.style.display = value ? "table-row" : "none";
    }
  };
}
