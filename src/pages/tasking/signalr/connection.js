import * as signalR from '@microsoft/signalr';
import { isExtensionPage, isKnownSignalRHub } from '../../../shared/beaconEnvironments.js';
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

// Fires (with the event name) every time ANY known push lands, regardless of
// type -- a single hook point for a UI "heartbeat" that just wants to know
// the feed is alive, without subscribing to every individual subject.
export const messageReceived = new Subject();

// Fires when the connection comes back after being lost, or after a failed
// first start. Subject has no replay and the hub doesn't resend, so anything
// pushed during the gap is gone: subscribers need to re-fetch it.
export const connectionRecovered = new Subject();
let pushesMayBeMissed = false;

let currentStatus = 'disconnected';
function setStatus(status) {
    currentStatus = status;
    connectionStatus.next(status);
}
export function getConnectionStatus() {
    return currentStatus;
}
function markConnected() {
    setStatus('connected');
    if (!pushesMayBeMissed) return;
    pushesMayBeMissed = false;
    connectionRecovered.next();
}

let manualRestartTimer = null;

// Set by stopBeaconSignalRConnection() so the onclose handler doesn't
// immediately reconnect a connection we deliberately tore down (config
// toggled Live Updates off). Cleared again by the next explicit start.
let stoppedIntentionally = false;

function scheduleManualRestart(negotiateUrl, getAccessToken) {
    // Safety net for the case onclose fires anyway (e.g. the very first
    // negotiate/handshake failed before the retry policy above ever got a
    // chance to run) -- keep trying rather than silently leaving the page
    // without live updates. Skipped when we stopped on purpose.
    if (stoppedIntentionally) return;
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
    // The hub gets the Beacon token: only ever one of Beacon's own.
    if (isExtensionPage() && !isKnownSignalRHub(negotiateUrl)) {
        console.error('[SignalR] not a Beacon SignalR hub, not connecting', negotiateUrl);
        return null;
    }
    // An explicit start overrides a previous intentional stop.
    stoppedIntentionally = false;
    if (manualRestartTimer) {
        clearTimeout(manualRestartTimer);
        manualRestartTimer = null;
    }
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
            messageReceived.next(eventName);
        });
    });

    connection.onreconnecting((error) => {
        console.log('[SignalR] reconnecting', error);
        pushesMayBeMissed = true;
        setStatus('reconnecting');
    });
    connection.onreconnected((connectionId) => {
        console.log('[SignalR] reconnected, connectionId=', connectionId);
        markConnected();
    });
    const thisConnection = connection;
    connection.onclose((error) => {
        // Ignore a late close from a connection we've already replaced
        // (stopped, then started again before its stop handshake landed).
        if (connection !== thisConnection) return;
        console.log('[SignalR] closed', error);
        pushesMayBeMissed = true;
        setStatus('disconnected');
        scheduleManualRestart(negotiateUrl, getAccessToken);
    });

    setStatus('connecting');
    connection.start()
        .then(() => {
            if (connection !== thisConnection) return; // replaced mid-connect
            console.log('[SignalR] connected, connectionId=', thisConnection.connectionId);
            markConnected();
        })
        .catch((err) => {
            if (connection !== thisConnection) return; // stopped mid-connect
            console.error('[SignalR] failed to connect:', err);
            pushesMayBeMissed = true;
            setStatus('disconnected');
            scheduleManualRestart(negotiateUrl, getAccessToken);
        });

    return connection;
}

/**
 * Tears down the live connection (config toggled Live Updates off
 * mid-session). Safe to call when nothing is connected. The next
 * startBeaconSignalRConnection() call rebuilds a fresh HubConnection.
 */
export function stopBeaconSignalRConnection() {
    stoppedIntentionally = true;
    // Turning Live Updates back on goes through the config modal, whose
    // save re-fetches everything anyway.
    pushesMayBeMissed = false;
    if (manualRestartTimer) {
        clearTimeout(manualRestartTimer);
        manualRestartTimer = null;
    }
    const c = connection;
    connection = null;
    if (!c) {
        setStatus('disconnected');
        return Promise.resolve();
    }
    console.log('[SignalR] stopping connection (Live Updates disabled)');
    setStatus('disconnected');
    // onclose fires from here, but connection is already null and
    // stoppedIntentionally is set, so it won't schedule a restart.
    return c.stop()
        .catch((err) => console.warn('[SignalR] error while stopping:', err));
}

export { getSubject };
