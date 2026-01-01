import { showAlert } from '../components/windowAlert.js';

export function openURLInBeacon(url) {
chrome.runtime.sendMessage({ type: "tasking-openURL", url: url }, function (response) {
            if (response && response.success) {
                showAlert(response.message || `Request ${url} opened successfully in Beacon.`, "success", 2000);
                console.log("Job opened successfully");
            } else {
                console.error("Failed to open job");
                showAlert(response.message || `Failed to open request ${url} in Beacon.`, "warning", 4000);
            }
        });
}