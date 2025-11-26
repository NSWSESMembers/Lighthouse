/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";

export function UpdateTeamStatusDropdownVM(parentVM) {
    const self = this;

    self.currentTasking = ko.observable(null);
    self.isVisible = ko.observable(false);
    self.top = ko.pureComputed(() => self.posY() + "px");
    self.left = ko.pureComputed(() => self.posX() + "px");
    self.currentPage = ko.observable("selectStatus"); 
    self.currentStatus = ko.observable(null);
    self.selectedStatus = ko.observable(null);
    let scrollHandler = null;

    // Page inputs
    self.time = ko.observable(""); 
    self.eta = ko.observable(""); 
    self.etc = ko.observable("");
    self.callOffReason = ko.observable("");

    // Quick buttons
    self.addETA1 = () => self.addToETA(1);
    self.addETA5 = () => self.addToETA(5);
    self.addETA10 = () => self.addToETA(10);
    self.addETA30 = () => self.addToETA(30);
    self.addETC1 = () => self.addToETC(1);
    self.addETC5 = () => self.addToETC(5);
    self.addETC10 = () => self.addToETC(10);
    self.addETC30 = () => self.addToETC(30);

    // Selections
    self.selectEnRoute = () => self.select("En-Route");
    self.selectOnSite   = () => self.select("On-Site");
    self.selectOffSite  = () => self.select("Off-Site");
    self.selectCallOff  = () => self.select("Call Off");
    self.selectUntask   = () => self.select("Untask");
    self.selectComplete = () => self.select("Complete");

    // Popup coordinates
    self.posX = ko.observable(0);
    self.posY = ko.observable(0);

    // Popup Visibility & Location Control
    self.show = function () {
        self.isVisible(true);

        const el = document.getElementById("TeamStatusDropdown");
        if (el) {
            el.style.display = "block";
            el.style.position = "fixed";
            el.style.top = self.top();
            el.style.left = self.left();
        }
    };

    self.hide = function () {
        self.isVisible(false);

        const el = document.getElementById("TeamStatusDropdown");
        if (el) {
            el.style.display = "none";
        }
    };

    // Dropdown Available Statuses 
    self.canUntask = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked') {
            return true;
        }
    })

    self.canEnroute = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked' || self.currentStatus() === 'Enroute' || self.currentStatus() === 'Onsite' || self.currentStatus() === 'Offsite') {
            return true;
        }
    })

    self.canCalloff = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked' || self.currentStatus() === 'Enroute') {
            return true;
        }
    })

    self.canOnsite = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked' || self.currentStatus() === 'Enroute' || self.currentStatus() === 'Onsite' || self.currentStatus() === 'Offsite') {
            return true;
        }
    })

    self.canOffsite = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked' || self.currentStatus() === 'Enroute' || self.currentStatus() === 'Onsite' || self.currentStatus() === 'Offsite') {
            return true;
        }
    })

    self.canComplete = ko.pureComputed(() => {
        if (self.currentStatus() === 'Tasked' || self.currentStatus() === 'Enroute' || self.currentStatus() === 'Onsite' || self.currentStatus() === 'Offsite') {
            return true;
        }
    })

    self.cannotUpdateStatus = ko.pureComputed(() => {
        if (self.currentStatus() === 'Untasked' || self.currentStatus() === 'CalledOff' || self.currentStatus() === 'Complete') {
            return true;
        }
    })

    // Open popup next to clicked button
    self.openTeamStatusDropdown = function (tasking, anchorE1) {
        self.currentTasking(tasking);
        self.currentStatus(self.currentTasking().currentStatus());

        const rect = anchorE1.getBoundingClientRect();

        // Yes, this is very hacky code - need to come back and fix this - TODO
        const visibleCount =
            (self.canUntask() ? 1 : 0) +
            (self.canEnroute() ? 1 : 0) +
            (self.canOnsite() ? 1 : 0) +
            (self.canOffsite() ? 1 : 0) +
            (self.canUntask() ? 1 : 0) +
            (self.canCalloff() ? 1 : 0);
        const popupHeight = visibleCount * 45;
        const spaceBelow = window.innerHeight - rect.bottom;

        let top;
        if (spaceBelow >= popupHeight) {
            top = rect.bottom;            // Popup below the button - this is the preference if there is space to do it.
        } else {
            top = rect.top - popupHeight - rect.height; // Popup above the button
        }

        self.posX(rect.left);
        self.posY(top);

        self.show();

        // Scrolling closes the popup.        
        attachScrollClose();

        // Click outside the popup.
        setTimeout(() => attachOutsideClick(), 0);
    };

    // Called when a Status option is selected on the status page.
    self.select = function (status) {
        self.selectedStatus(status);
        self.time(currentTime());

        if (self.selectedStatus() === "Untask" || self.selectedStatus() === "Off-Site") {
            self.submitFinal(); // No second page needed.
            return;
        }
        if (status === "Complete") {
            self.close(); //TBC
            return;
        }

        // Second page required
        self.currentPage("details");
        setTimeout(() => self.recalculatePopup(), 0);
    };

    self.recalculatePopup = function () {
        const el = document.getElementById("TeamStatusDropdown");
        if (!el || !self.anchorEl) return;

        // Force the browser to reflow so offsetHeight is accurate
        el.style.height = "auto";
        el.style.width = "auto";

        const rect = self.anchorEl.getBoundingClientRect();

        // Measure the popup AFTER content switch
        const popupHeight = el.offsetHeight;
        const popupWidth = el.offsetWidth;

        const spaceBelow = window.innerHeight - rect.bottom;

        // Position above or below based on available space
        let top;
        if (spaceBelow >= popupHeight) {
            top = rect.bottom;            // show below
        } else {
            top = rect.top - popupHeight; // show above
        }

        // Position left aligned to the anchor button
        let left = rect.left;

        // Update observables
        self.posX(left);
        self.posY(top);

        // Update DOM now (KO doesn't manage these because of secure bindings)
        el.style.left = self.left();
        el.style.top = self.top();
        el.style.width = popupWidth + "px"; // lock width so it doesn't jump again
    };

    self.submitFinal = function () {
        console.log("Submitting:");
        const formattedTime = moment(self.time()).format("YYYY-MM-DDTHH:mm:ssZ");
        let action = null; // our friendly UI name is different to the Beacon API backend name, so this value is for that backend value that will be used to form the URL later on.
        let payload = { timeLogged: formattedTime, overrideFutureStatuses: 0, description: "", LighthouseFunction: "updatingTeamStatus" };

        // Configure status-specific fields:
        // Construct Payload for En-Route
        if (self.selectedStatus() === "En-Route") {
            action = "Enroute";
            payload.estimatedCompletion = moment(self.eta()).format("YYYY-MM-DDTHH:mm:ssZ");
        }

        // Construct Payload for On-Site
        if (self.selectedStatus() === "On-Site") {
            action = "Onsite";
            payload.estimatedCompletion = moment(self.etc()).format("YYYY-MM-DDTHH:mm:ssZ");
        }

        // Construct Payload for Off-Site
        if (self.selectedStatus() === "Off-Site") {
            action = "Offsite";
            payload.estimatedCompletion = null;
            payload.taskingId = self.currentTasking().id();
        }

        // Construct Payload for Call Off
        if (self.selectedStatus() === "Call Off") {
            action = "CallOff";
            payload.TaskingId = self.currentTasking().id();
            payload.InjuriesSustained = false;
            payload.AARCompleted = false;
            payload.CISPRequired = false;
            payload.VesselUsed = false;
            payload.RiskAssessmentCompleted = false;
            payload.ReasonForCallOff = self.callOffReason();
            payload.InjuredPeopleIds = [];
            payload.CompleteJob = false;
            payload.LighthouseFunction = "callOffTeamFromJob";
        }

        // Construct Payload for Untask
        if (self.selectedStatus() === "Untask") {
            action = "Untask";
            delete payload.timeLogged;
            delete payload.description;
            delete payload.overrideFutureStatuses;
            payload.Id = self.currentTasking().id();
            payload.TeamId = self.currentTasking().team.id();
            payload.JobId = self.currentTasking().job.id();
            payload.LighthouseFunction = "untaskTeamFromJob";
        } 

        // Decide whether we are overriding tasking - and apply tasking override value if we are.
        if (self.selectedStatus() === "En-Route" && self.currentStatus() !== "Tasked") {
            payload.overrideFutureStatuses = self.currentTasking().id();
        }

        if (self.selectedStatus() === "On-Site" && self.currentStatus() !== "Enroute") {
            payload.overrideFutureStatuses = self.currentTasking().id();
        }

        if (self.selectedStatus() === "Off-Site" && self.currentStatus() !== "Onsite") {
            payload.overrideFutureStatuses = self.currentTasking().id();
        }

        // Send to ParentVM to make API Call
        // If it's a POST Request send it to the UpdateTeamStatus API - sends TaskingID, Action (what status we are changing to), Payload and Callback.
        const UpdateTeamStatusAPI = ['Enroute','Onsite','Offsite']
        if (UpdateTeamStatusAPI.includes(action)) {
            parentVM.updateTeamStatus(self.currentTasking().id(), action, payload, function (result) {

                if (!result) {
                    console.error("Team Status Update failed");
                    return;
                }
            });
        }

        // If it's a PUT request to Call off we need to send it to the callOffTeam API - Sends TaskingID, Payload and Callback.
        if (action === "CallOff") {
            parentVM.callOffTeam(self.currentTasking().id(), payload, function (result) {

                if (!result) {
                    console.error("Failed to CallOff Team");
                    return;
                }
            });
        }

        // If it's a DELETE request for Untask we need to send it to the untaskTeam API - sends TaskingID, Payload and Callback.
        if (action === "Untask") {
            parentVM.untaskTeam(self.currentTasking().id(), payload, function (result) {

                if (!result) {
                    console.error("Failed to Untask Team");
                    return;
                }
            });  
        }

        // Close popup now that we are done.
        self.close()
    };

    self.addToETA = function (minutes) {
        self.eta(addMinutesToInputTime(self.eta(), minutes));
    };

    self.addToETC = function (minutes) {
        self.etc(addMinutesToInputTime(self.etc(), minutes));
    };

    // Close
    self.close = function () {
        // ⭐ REPLACE isVisible(false) WITH hide()
        self.hide();
        detachOutsideClick();
        self.currentPage("selectStatus");
        self.selectedStatus(null);
        self.time("");
        self.eta("");
        self.etc("");
        self.callOffReason("");
        detachScrollClose();
    };

    // VM Functions
    // Clicking outside closes dropdown
    let outsideHandler = null;

    function attachOutsideClick() {
        outsideHandler = (evt) => {
            const dropdown = document.getElementById("TeamStatusDropdown");
            if (!dropdown.contains(evt.target)) {
                self.close();
            }
        };
        document.addEventListener("mousedown", outsideHandler);
    }

    function detachOutsideClick() {
        if (outsideHandler) {
            document.removeEventListener("mousedown", outsideHandler);
            outsideHandler = null;
        }
    }

    function currentTime() {
        const d = new Date();
        const pad = (n) => n.toString().padStart(2, "0");

        return (
            d.getFullYear() + "-" +
            pad(d.getMonth() + 1) + "-" +
            pad(d.getDate()) + "T" +
            pad(d.getHours()) + ":" +
            pad(d.getMinutes())
        );
    }

    function addMinutesToInputTime(existingValue, minutes) {
        // Case 1: No existing time → start with current time
        let base = existingValue ? new Date(existingValue) : new Date();

        base.setMinutes(base.getMinutes() + minutes);

        // Convert back to datetime-local format
        const pad = (n) => n.toString().padStart(2, "0");
        return (
            base.getFullYear() + "-" +
            pad(base.getMonth() + 1) + "-" +
            pad(base.getDate()) + "T" +
            pad(base.getHours()) + ":" +
            pad(base.getMinutes())
        );
    }

    // Scrolling closes the popup
    function attachScrollClose() {
        if (scrollHandler) return;

        scrollHandler = () => {
            self.close();
        };

        // Listen for ANY scroll on the page, including scrollable divs
        document.addEventListener("scroll", scrollHandler, true);
    }

    function detachScrollClose() {
        if (!scrollHandler) return;

        document.removeEventListener("scroll", scrollHandler, true);
        scrollHandler = null;
    }
};