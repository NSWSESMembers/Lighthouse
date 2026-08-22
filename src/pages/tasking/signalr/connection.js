import * as signalR from '@microsoft/signalr';
import { getSubject } from './subjects.js';
import { KNOWN_EVENTS } from './knownEvents.js';
import { Subject } from './subject.js';

const RETRY_DELAYS_MS = [0, 2000, 5000, 10000, 15000, 30000];

// @microsoft/signalr's default retry policy gives up (permanently closes
// the connection) after a handful of attempts. This connection is how the
// whole page gets live data, so it should never stop trying -- backs off
// to 30s between attempts but keeps retrying forever (never returns null,
// which is the client's signal to stop).
class InfiniteBackoffRetryPolicy {
    nextRetryDelayInMilliseconds(retryContext) {
        const i = Math.min(retryContext.previousRetryCount, RETRY_DELAYS_MS.length - 1);
        return RETRY_DELAYS_MS[i];
    }
}

let connection = null;

// 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export const connectionStatus = new Subject();
let currentStatus = 'disconnected';
function setStatus(status) {
    currentStatus = status;
    connectionStatus.next(status);
}
export function getConnectionStatus() {
    return currentStatus;
}

let manualRestartTimer = null;

function scheduleManualRestart(negotiateUrl, getAccessToken) {
    // Safety net for the case onclose fires anyway (e.g. .stop() was called,
    // or the very first negotiate/handshake failed before the retry policy
    // above ever got a chance to run) -- keep trying rather than silently
    // leaving the page without live updates.
    if (manualRestartTimer) return;
    manualRestartTimer = setTimeout(() => {
        manualRestartTimer = null;
        console.log('[SignalR] attempting manual restart after close/failed start');
        connection = null; // allow a fresh HubConnection to be built
        startBeaconSignalRConnection(negotiateUrl, getAccessToken);
    }, 5000);
}

/**
 * Creates (on first call) and starts the persistent Beacon Comms SignalR
 * connection, routing any recognised push into the subject registry.
 * negotiateUrl comes from the page's own query params (see main.js).
 * getAccessToken is called on every (re)negotiate, so pass a closure over
 * the live token rather than a captured string.
 */
export function startBeaconSignalRConnection(negotiateUrl, getAccessToken) {
    if (connection) return connection;

    connection = new signalR.HubConnectionBuilder()
        .withUrl(negotiateUrl, { accessTokenFactory: getAccessToken })
        .withAutomaticReconnect(new InfiniteBackoffRetryPolicy())
        // Error (not Information) -- suppresses the library's own per-message
        // chatter and "No client method with the name 'X' found" warnings for
        // unregistered subjects, while still surfacing real connection errors.
        .configureLogging(signalR.LogLevel.Error)
        .build();

    KNOWN_EVENTS.forEach((eventName) => {
        connection.on(eventName, (payload) => {
            getSubject(eventName).next(payload);
        });
    });

    connection.onreconnecting((error) => {
        console.log('[SignalR] reconnecting', error);
        setStatus('reconnecting');
    });
    connection.onreconnected((connectionId) => {
        console.log('[SignalR] reconnected, connectionId=', connectionId);
        setStatus('connected');
    });
    connection.onclose((error) => {
        console.log('[SignalR] closed', error);
        setStatus('disconnected');
        scheduleManualRestart(negotiateUrl, getAccessToken);
    });

    setStatus('connecting');
    connection.start()
        .then(() => {
            console.log('[SignalR] connected, connectionId=', connection.connectionId);
            setStatus('connected');
        })
        .catch((err) => {
            console.error('[SignalR] failed to connect:', err);
            setStatus('disconnected');
            scheduleManualRestart(negotiateUrl, getAccessToken);
        });

    return connection;
}

export { getSubject };
