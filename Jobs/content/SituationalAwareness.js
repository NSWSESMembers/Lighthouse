console.info('Lighthouse: Jobs/content/SituationalAwareness.js');

window.addEventListener("load", pageFullyLoaded, false);


function pageFullyLoaded(e) {

//dont need to do this any more
// //reposition the close button
// var bar = document.getElementsByClassName("titleButton close");
// bar[0].style.backgroundPosition = "-33px 0px";


//hide the maximize button
var max = document.getElementsByClassName("titleButton maximize");
max[0].classList.add("hidden");


}