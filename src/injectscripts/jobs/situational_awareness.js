window.addEventListener("load", pageFullyLoaded, false);

function pageFullyLoaded(e) {
  //hide the maximize button
  var max = document.getElementsByClassName("titleButton maximize");
  max[0].classList.add("hidden");
}
