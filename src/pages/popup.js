require('./lib/shared_chrome_code.js'); // side-effect

let version = 'Lighthouse v'+chrome.manifest.version+' '+(chrome.manifest.name.includes("Development") ? "Development" : "Production")

document.getElementById("version").innerHTML = version

document.getElementById("beacon").addEventListener("click", function()
{
	window.open('https://beacon.ses.nsw.gov.au','_blank');

});
document.getElementById("train").addEventListener("click", function()
{
	window.open('https://trainbeacon.ses.nsw.gov.au','_blank');

});
document.getElementById("version").addEventListener("click", function()
{
	window.open('http://lighthouse.ses.nsw.gov.au','_blank');

});
