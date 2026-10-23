// Beacon's own reason from a BeaconApiError's body, or "" if it gave none.
export function beaconErrorMessage(err) {
  try {
    const body = JSON.parse(err.body);
    // Some endpoints (e.g. Tasking/{id}/Calloff) send the reason as a bare
    // JSON string: "Cannot call off: Team has been onsite, ..."
    if (typeof body === "string") return body;
    const modelState = body && body.ModelState ? Object.values(body.ModelState).flat()[0] : "";
    return (body && (body.Message || body.message || body.ExceptionMessage)) || modelState || "";
  } catch (_) {
    return ""; // not JSON
  }
}

// Turns a failed Beacon request (BeaconApiError, network error, or an error
// carrying a userMessage) into something readable for an alert or banner,
// e.g. `Beacon said "Cannot call off: Team has been onsite, team must be completed"`.
export function describeBeaconError(err) {
  if (err && err.userMessage) return err.userMessage;
  if (err && err.name === "BeaconApiError") {
    if (err.status === 401 || err.status === 403) {
      return "Beacon refused the request (your session may have expired)";
    }
    const msg = beaconErrorMessage(err);
    return msg
      ? `Beacon said "${msg}"`
      : `Beacon returned an error (${err.status}${err.statusText ? " " + err.statusText : ""})`;
  }
  return "couldn't reach Beacon";
}
