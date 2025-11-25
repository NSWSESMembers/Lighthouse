import ko from "knockout";

function makeStatusFilterBinding(listName, onChanged) {
  return {
    init: function (element, valueAccessor, _allBindings, _vm, ctx) {
      const status = ko.unwrap(valueAccessor());
      const cfg = ctx.$root.config;
      const vm = ctx.$root;
      if (!cfg || typeof cfg[listName] !== "function") return;

      // initial checkbox state
      element.checked = cfg[listName]().includes(status);

      element.addEventListener("change", function () {
        const arr = cfg[listName];
        if (element.checked) {
          if (!arr().includes(status)) {
            arr.push(status);
          }
        } else {
          arr.remove(status);
        }

        // now data is updated → run callback
        if (typeof onChanged === "function") {
          onChanged(vm, cfg);
        }
      });
    },
    update: function (element, valueAccessor, _allBindings, _vm, ctx) {
      const status = ko.unwrap(valueAccessor());
      const cfg = ctx.$root.config;
      if (!cfg || typeof cfg[listName] !== "function") return;

      element.checked = cfg[listName]().includes(status);
    }
  };
}

export function installStatusFilterBindings() {
  // basic filters
  ko.bindingHandlers.teamStatusFilter = makeStatusFilterBinding("teamStatusFilter");
  ko.bindingHandlers.jobStatusFilter = makeStatusFilterBinding("jobStatusFilter");
  ko.bindingHandlers.incidentTypeFilter = makeStatusFilterBinding("incidentTypeFilter");

  // filters + fetch + save
  ko.bindingHandlers.teamStatusFilterAndFetch = makeStatusFilterBinding(
    "teamStatusFilter",
    (vm, cfg) => {
      cfg.save();
      vm.fetchAllTeamData();
    }
  );

  ko.bindingHandlers.jobStatusFilterAndFetch = makeStatusFilterBinding(
    "jobStatusFilter",
    (vm, cfg) => {
      cfg.save();
      vm.fetchAllJobsData();
    }
  );

  ko.bindingHandlers.incidentTypeFilterAndFetch = makeStatusFilterBinding(
    "incidentTypeFilter",
    (vm, cfg) => {
      cfg.save();
      vm.fetchAllJobsData();
    }
  );
}
