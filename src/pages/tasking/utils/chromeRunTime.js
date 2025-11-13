export function openURLInBeacon(url) {
chrome.runtime.sendMessage({ type: "tasking-openURL", url: url }, function (response) {
            if (response && response.success) {
                console.log("Job opened successfully");
            } else {
                console.error("Failed to open job");
                alert(response.message || "Failed to open job in Beacon.");
            }
        });
}