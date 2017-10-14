
function returnPostCode(suburb,cb) {

$.get( lighthouseUrl+'resources/nsw_postcodes.json', function( data ) {
		var postcode = data[suburb]
		cb(postcode)
});


}

module.exports = {
	returnPostCode: returnPostCode
}
