import ko from "knockout";


export function installSortableArrayBindings() {

  ko.bindingHandlers.sortableRow = {
    init: function (el, valueAccessor, allBindings, viewModel, bindingContext) {
      const opts = ko.unwrap(valueAccessor()) || {};
      const arr = opts.array;          // observableArray
      const handleSel = opts.handle;   // optional CSS selector for handle inside el

      if (!arr || typeof arr.remove !== "function" || typeof arr.splice !== "function") {
        console.warn("sortableRow: opts.array must be an observableArray");
        return;
      }

      // allow dragging from handle only if provided
      const getHandle = () => (handleSel ? (el.querySelector(handleSel) || el) : el);

      // mark draggable
      el.setAttribute("draggable", "true");

      // KSB-safe: item is from bindingContext.$data
      const getIndex = () => {
        const a = arr();
        const item = bindingContext.$data;
        return a.indexOf(item);
      };

      el.addEventListener("dragstart", (e) => {
        const h = getHandle();
        // if handle selector is used, only allow drag when starting on/within handle
        if (handleSel && e.target && !h.contains(e.target)) {
          e.preventDefault();
          return;
        }

        const idx = getIndex();
        if (idx < 0) return;

        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
        el.classList.add("is-dragging");
      });

      el.addEventListener("dragend", () => {
        el.classList.remove("is-dragging");
      });

      el.addEventListener("dragover", (e) => {
        e.preventDefault(); // required to allow drop
        e.dataTransfer.dropEffect = "move";
        el.classList.add("is-dragover");
      });

      el.addEventListener("dragleave", () => {
        el.classList.remove("is-dragover");
      });

      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("is-dragover");

        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const to = getIndex();
        if (!Number.isFinite(from) || from < 0 || to < 0 || from === to) return;

        const a = arr();
        const item = a[from];
        if (!item) return;

        // move item within array
        arr.splice(from, 1);
        arr.splice(to, 0, item);
      });
    }
  };
}
