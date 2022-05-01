/* global lighthouseUrl */
function returnPostCode(suburb,cb) {
	//use a XMLHttpRequest because the auth headers in jquerys ajax call dont like hitting local urls due to preflight errors
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
       // Action to be performed when the document is read;
       var postcode = JSON.parse(this.response)[suburb]
       cb(postcode)
   }
};
xhttp.open("GET", lighthouseUrl+'resources/nsw_postcodes.json', true);
xhttp.send();

}
module.exports = {
	returnPostCode: returnPostCode
}
