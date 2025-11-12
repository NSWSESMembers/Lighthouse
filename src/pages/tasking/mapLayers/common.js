import BeaconClient from '../../../shared/BeaconClient.js';

function getTransportApiKeyOpsLog(origin) {
    switch (origin) {
        case 'https://previewbeacon.ses.nsw.gov.au':
            return '46273';
        case 'https://beacon.ses.nsw.gov.au':
            return '515514';
        case 'https://trainbeacon.ses.nsw.gov.au':
            return '36753';
        default:
            return '0';
    }
}

