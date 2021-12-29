// function for searching the ops log for jobs on the SES asbestos register

var $ = require('jquery');


function getAddress3wa(addressObj,cb) {

	const apiKey = '5NB2X8B6'
	const lang = 'en'
	const format = 'json'
	const coords = encodeURIComponent(addressObj.Latitude + ',' + addressObj.Longitude)
	const apiCall = 'https://api.what3words.com/v3/convert-to-3wa?coordinates=' + coords + '&key=' + apiKey + '&format=json'
	
	$.ajax({
		type: 'GET',
		url: apiCall,
		cache: true,
		dataType: 'json',
		complete: function(data, textStatus) {
			if(textStatus == 'success') {
				console.log("what3words api success: " + data.responseText)
				cb(data.responseJSON)
			} else {
				console.log("what3words api error: " + textStatus )
				cb(false)
			}
		},
		error: function (data) {
			console.log("what3words api error: " + data)
			cb(false)
		}
	})
}

module.exports = getAddress3wa;