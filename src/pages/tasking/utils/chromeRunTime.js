import { showAlert, closeAlert } from '../components/windowAlert.js';

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

export function openURLInBeacon(url) {
    chrome.runtime.sendMessage({ type: "tasking-openURL", url: url }, function (response) {
        if (response && response.success) {
            showAlert(response.message || `Request ${url} opened successfully in Beacon.`, "success", 2000);
            console.log("Job opened successfully");
            return;
        }

        console.error("Failed to open job in Beacon Remote tab:", response);

        // Lighthouse drives a single "Beacon Remote" tab so it can reuse your
        // Beacon login. If that tab is missing we can't reuse it, so explain
        // why and offer a link to open the page in a new window instead.
        const code = (response && (response.error || response.message)) || "";
        let reason;
        if (/same tab/i.test(code)) {
            reason = "This is the Beacon Remote tab, so it can't open the page in itself.";
        } else if (/no remote tab|not? *registered/i.test(code)) {
            reason = "Lighthouse has no Beacon Remote tab to open this in. Register Beacon in another tab, then try again.";
        } else if (/failed|no tab with id/i.test(code)) {
            reason = "Your Beacon Remote tab has closed. Register Beacon in another tab, then try again.";
        } else {
            reason = "Couldn't reach your Beacon Remote tab. Register Beacon in another tab, then try again.";
        }

        const link = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open this page in a new window</a>`;
        // Persist (no timeout) so the user has time to read it and click the link.
        const id = showAlert(`<div style="text-align:center;">${escapeHtml(reason)}<br>${link}</div>`, "warning", 0);

        // Dismiss the alert once the user has followed the link.
        document.getElementById(id)?.querySelector("a")?.addEventListener("click", () => closeAlert(id));
    });
}
