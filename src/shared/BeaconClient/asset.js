import $ from 'jquery';

export function filter(assetFilter, host, userId = 'notPassed', token, cb) {
  console.debug('fetching SES Asset Locations with filter on result');
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/ResourceLocations/Radio?resourceTypes=',
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    data: {
      LighthouseFunction: 'shared_asset_code',
      userId: userId
    },
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        if (assetFilter.length == 0) { //show everything
          cb(response.responseJSON)
        } else { //filtered
          var filteredResult = []
            response.responseJSON.forEach(function(v) {
              if (assetFilter.includes(v.properties.name)) {
                filteredResult.push(v)
              }
            })
          cb(filteredResult)
        }
      }
    }
  })
}