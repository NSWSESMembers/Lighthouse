import BeaconClient from '../../../shared/BeaconClient.js';

function getTransportApiKeyOpsLog(apiHost, userId, token, cb) {

    var opsId = null;

    switch (apiHost) {
        case 'https://previewbeacon.ses.nsw.gov.au':
            opsId = '46273';
            break
        case 'https://apibeacon.ses.nsw.gov.au':
            opsId = '515514';
            break
        case 'https://apitrainbeacon.ses.nsw.gov.au':
            opsId = '36753';
            break
        default:
            opsId = '0';
    }

    BeaconClient.operationslog.get(opsId, apiHost, userId, token, function (response) {
        let key = response.Text;
        cb(key)
    })
}


export async function fetchTransportCamerasAsync(apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await new Promise((resolve) => {
            getTransportApiKeyOpsLog(apiHost, userId, token, function (key) {
                sessionStorage.setItem(sessionKey, key);
                resolve(key);
            });
        });
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'transport-cameras', params: { apiKey: transportApiKeyCache } }, function (response) {
            if (response.error) {
                console.error(`Update to transport-cameras failed: ${response.error} http-code:${response.httpCode}`);
                reject(response);
            } else {
                resolve({ok: true, response});
            }
        });
    });
}

export async function fetchTransportIncidentsAsync(apiHost, userId, token) {
    let sessionKey = 'lighthouseTransportApiKeyCache';
    let transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (!transportApiKeyCache) {
        transportApiKeyCache = await new Promise((resolve) => {
            getTransportApiKeyOpsLog('https://trainbeacon.ses.nsw.gov.au', apiHost, userId, token, function (key) {
                sessionStorage.setItem(sessionKey, key);
                resolve(key);
            });
        });
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'transport-incidents', params: { apiKey: transportApiKeyCache } }, function (response) {
            if (response.error) {
                console.error(`Update to transport-incidents failed: ${response.error} http-code:${response.httpCode}`);
                reject(response);
            } else {
                resolve({ok: true, response});
            }
        });
    });
}