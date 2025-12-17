import $ from 'jquery';

export function get(unitId, host, userId = 'notPassed', token, callback) {
    $.ajax({
        type: 'GET',
        url: host + "/Api/v1/Suppliers/Job/" + unitId + "?LighthouseFunction=suppliersGet&userId=" + userId,
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