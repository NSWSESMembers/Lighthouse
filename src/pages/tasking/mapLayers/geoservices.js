import BeaconClient from "../../../shared/BeaconClient";

export async function fetchUnitBoundariesAsync(units, apiHost, userId, token) {
    return new Promise((resolve, reject) => {
        var unitIds = units.map((unit) => {
            return new Promise((res, rej) => {
                BeaconClient.geoservices.unitBoundary(unit.id, apiHost, userId, token, function (response) {
                    if (response.error) {
                        console.error(`Fetch of unit boundaries failed: ${response.error} http-code:${response.httpCode}`);
                        rej(response);
                    } else {
                        res({data: response[0], unit});
                    }
                });
            });
        });

        Promise.all(unitIds)
            .then(results => {
                resolve({ ok: true, response: results });
            })
            .catch(error => {
                reject(error);
            });
    });
}