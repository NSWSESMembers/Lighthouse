console.info('Lighthouse: Teams/content/Edit.js');

//replace window title with team name if set

var callsign = vm.callsign.peek();

if (typeof callsign !== 'undefined')
{
	document.title = callsign;
}