import ko from "knockout";

const dragStore = new Map();
const genId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function installDragDropRowBindings() {
  ko.bindingHandlers.draggableRow = {
    init(el, valueAccessor) {
      const opts = valueAccessor() || {};
      const payload = { data: opts.data, kind: opts.kind || "item" };

      el.setAttribute("draggable", "true");

      // Prevent drag from starting if clicking text or inside a selectable element
      el.addEventListener("mousedown", function (ev) {
        if (ev.target.nodeType === Node.TEXT_NODE) {
          el.setAttribute("draggable", "false");
          setTimeout(function () {
            el.setAttribute("draggable", "true");
          }, 0);
          return;
        }

        const tag = ev.target.tagName;
        if (tag === "SPAN" || tag === "P" || tag === "TD" || tag === "DIV") {
          if (ev.target.innerText && ev.target.innerText.trim().length > 0) {
            el.setAttribute("draggable", "false");
            setTimeout(function () {
              el.setAttribute("draggable", "true");
            }, 0);
            return;
          }
        }
      });

      el.addEventListener("dragstart", function (ev) {
        if (el.getAttribute("draggable") !== "true") {
          ev.preventDefault();
          return;
        }

        const id = genId();
        dragStore.set(id, payload);

        ev.dataTransfer.setData("text/x-ko-drag-id", id);
        ev.dataTransfer.effectAllowed = "copyMove";
        ev.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ kind: payload.kind })
        );

        const row = opts.dragSourceRow || el.closest("tr");
        if (row) {
          try {
            ev.dataTransfer.setDragImage(row, 0, 0);
          } catch (_) { /* empty */ }
        }
      });

      el.addEventListener("dragend", function () {
        dragStore.forEach(function (_v, k) {
          dragStore.delete(k);
        });
      });
    }
  };

  ko.bindingHandlers.droppableRow = {
    init(el, valueAccessor, allBindings, viewModel, ctx) {
      const opts = valueAccessor() || {};
      const team = opts.team ?? viewModel;

      const onDrop =
        (typeof opts.onDrop === "function" && opts.onDrop) ||
        (typeof ctx.$root?.assignJobToTeam === "function" &&
          ctx.$root.assignJobToTeam) ||
        (typeof viewModel?.assignJobToTeam === "function" &&
          viewModel.assignJobToTeam);

      if (typeof onDrop !== "function") {
        console.warn(
          "droppableRow: no onDrop handler found"
        );
      }

      el.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "copy";
        el.classList.add("drag-over");
      });

      el.addEventListener("dragleave", () => el.classList.remove("drag-over"));

      el.addEventListener("drop", (ev) => {
        ev.preventDefault();
        el.classList.remove("drag-over");
        const id = ev.dataTransfer.getData("text/x-ko-drag-id");
        const payload = id && dragStore.get(id);
        if (!payload || payload.kind !== "job") return;
        const jobVm = payload.data;
        const teamVm = team;
        onDrop(jobVm, teamVm);
      });
    }
  };
}
