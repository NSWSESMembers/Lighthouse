import ko from "knockout";

// Binding to stop click events from disabled buttons bubbling up
// eg the message button in the team list/tasking list
export function noBubbleFromDisabledButtonsBindings() {
ko.bindingHandlers.noBubbleFromDisabledButtons = {
    init: function (element) {
        element.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
};
}