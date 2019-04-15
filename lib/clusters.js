
function returnCluster(unit,cb) {
	//use a XMLHttpRequest because the auth headers in jquerys ajax call dont like hitting local urls due to preflight errors
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
       // Action to be performed when the document is read;
       var clusterCode = JSON.parse(this.response)[unit]
       cb(clusterCode)
   }
};
xhttp.open("GET", (typeof lighthouseUrl !== 'undefined'? lighthouseUrl : '/') +'resources/unitClusters.json', true);
xhttp.send();
}

function returnSiblings(unit,cb) {
	//use a XMLHttpRequest because the auth headers in jquerys ajax call dont like hitting local urls due to preflight errors
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
       // Action to be performed when the document is read;
       var units = JSON.parse(this.response)
			 console.log(unit)
			 var cluster = units[unit].clusterCode
			 var results = []
			 for (var key in units) {
				 if (units[key].clusterCode == cluster) {
					 results.push(key)
				 }
			 }
       cb(results)
   }
};
xhttp.open("GET", (typeof lighthouseUrl !== 'undefined'? lighthouseUrl : '/')+'resources/unitClusters.json', true);
xhttp.send();
}


module.exports = {
	returnCluster: returnCluster,
	returnSiblings: returnSiblings

}
