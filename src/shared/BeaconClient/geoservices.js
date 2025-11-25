import $ from 'jquery';
import { getName } from './unit.js';

export function unitBoundary(unitId, host, userId = 'notPassed', token, callback) {
    getName(unitId, host, userId, token, function (response) {
        if (response && response.Code) {
            $.ajax({
                type: 'GET',
                url: host + "/Api/v1/GeoServices/Unit/" + response.Code + "/Boundary/?LighthouseFunction=unitBoundary&userId=" + userId,
                beforeSend: function (n) {
                    n.setRequestHeader("Authorization", "Bearer " + token)
                },
                cache: false,
                dataType: 'json',
                complete: function (response, textStatus) {
                    if (textStatus == 'success') {
                        let results = response.responseJSON;
                        if (typeof callback === "function") {
                            callback(results);
                        }
                    }
                }
            })
        }
    })
}