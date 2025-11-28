import $ from "jquery";
import { Alert } from "bootstrap5";

export function showAlert(message, type = "primary", timeout = 4000) {
    const id = "alert-" + Date.now();

    const html = `
      <div id="${id}" class="alert alert-${type} alert-dismissible fade show shadow"
           role="alert" style="margin-bottom:8px;">
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    $("#alerts-container").append(html);

    if (timeout > 0) {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                // Bootstrap 5 native JS API
                Alert.getOrCreateInstance(el).close();
            }
        }, timeout);
    }
}
