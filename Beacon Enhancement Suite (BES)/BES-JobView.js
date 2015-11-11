//replace window title with job number
var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "document.title = \"#\"+jobId";
    (document.head || document.documentElement).appendChild(s)



var block = document.getElementById("finaliseJobModal").getElementsByClassName("modal-body");
var child = block[0]


console.log(child);



var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-4");
label.classList.add("col-lg-3");
label.classList.add("control-label");

label.innerText = "BES Quick Fill";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-md-4");
textboxdiv.classList.add("col-lg-3");


var textbox = document.createElement("select");
textbox.id = "QuickFillBox";
//textbox.classList.add("form-control");
var option = document.createElement("option");
option.text = "";
textbox.add(option);

var option = document.createElement("option");
option.text = "All paperwork and documentation completed.";
textbox.add(option);



textboxdiv.appendChild(textbox);



innerdiv.appendChild(label);

innerdiv.appendChild(textboxdiv);

div.appendChild(innerdiv);

console.log(div);

child.insertBefore(div,child.childNodes[2]);



document.getElementById("QuickFillBox").onchange = function() {
console.log(this.value)

var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
block[0].value = this.value


}


