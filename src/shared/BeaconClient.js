/*
  This file acts as our interface to the Beacon REST API.
*/

import * as job from './BeaconClient/job.js';
import * as asset from './BeaconClient/asset.js';
import * as nitc from './BeaconClient/nitc.js';
import * as operationslog from './BeaconClient/operationslog.js';
import * as resources from './BeaconClient/resources.js';
import * as team from './BeaconClient/team.js';
import * as unit from './BeaconClient/unit.js';
import * as entities from './BeaconClient/entities.js';
import * as tasking from './BeaconClient/tasking.js';
import * as notifications from './BeaconClient/notifications.js';
import * as geoservices from './BeaconClient/geoservices.js';
import * as tags from './BeaconClient/tags.js';
import * as sectors from './BeaconClient/sectors.js';
import * as frao from './BeaconClient/frao.js';
import * as contacts from './BeaconClient/contacts.js';
import * as messages from './BeaconClient/messages.js';
import * as suppliers from './BeaconClient/suppliers.js';

export { job, asset, nitc, operationslog, resources, team, unit, entities, tasking, notifications, geoservices, tags, sectors, frao, contacts, messages, suppliers };

// re-export functions
export default { job, asset, nitc, operationslog, resources, team, unit, entities, tasking, notifications, geoservices, tags, sectors, frao, contacts, messages, suppliers, toFormUrlEncoded };

export function toFormUrlEncoded(obj) {
    const params = [];
    for (const key in obj) {
        const value = obj[key];

        if (Array.isArray(value)) {
            value.forEach(v => params.push(
                encodeURIComponent(key + "[]") + "=" + encodeURIComponent(v)
            ));
        } else {
            params.push(
                encodeURIComponent(key) + "=" + encodeURIComponent(value ?? "")
            );
        }
    }
    return params.join("&");
}
