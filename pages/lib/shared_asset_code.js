const $ = require('jquery');

function getFilteredAssets(hqs, host, userId = 'notPassed', token, cb) {
  console.debug('fetching SES Asset Locations with HQ filter on result');
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
        if (hqs.length == 0) { //show everything
          cb(response.responseJSON)
        } else { //filtered
          var filteredResult = []
          hqs.forEach(function(q) { //for every lhq passed filter assets
            response.responseJSON.forEach(function(v) {
              if (v.properties.entity == q.Name) {
                filteredResult.push(v)
              }
            })
          })
          cb(filteredResult)
        }
      }
    }
  })
}

module.exports = {
  getFilteredAssets: getFilteredAssets
};
