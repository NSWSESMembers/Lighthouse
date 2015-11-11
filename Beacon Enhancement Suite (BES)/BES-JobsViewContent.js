document.getElementById("QuickFillBox").onchange = function() {
console.log(this.value)

var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");

masterViewModel.finalisationText(this.value);

}