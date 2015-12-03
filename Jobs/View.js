console.info('Lighthouse: Jobs/View.js');

//replace window title with job number
var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "document.title = \"#\"+jobId";
    (document.head || document.documentElement).appendChild(s)

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
var s = document.createElement('script');
s.src = chrome.extension.getURL('Jobs/content/View.js');
(document.head || document.documentElement).appendChild(s)


//Finalise Job Quick Text

var block = document.getElementById("finaliseJobModal").getElementsByClassName("modal-body");
var child = block[0]


var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-4");
label.classList.add("col-lg-3");
label.classList.add("control-label");

label.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh-black.png") + "\"> Quick Text";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-lg-9");


var textbox = document.createElement("select");
textbox.classList.add("form-control");
textbox.id = "FinaliseQuickTextBox";
//textbox.classList.add("form-control");
var option = document.createElement("option");
option.text = "";
textbox.add(option);

var option = document.createElement("option");
option.text = "All paperwork and documentation completed";
textbox.add(option);

var option = document.createElement("option");
option.text = "NFA";
textbox.add(option);

var option = document.createElement("option");
option.text = "Job completed";
textbox.add(option);

textboxdiv.appendChild(textbox);



innerdiv.appendChild(label);

innerdiv.appendChild(textboxdiv);

div.appendChild(innerdiv);


child.insertBefore(div,child.childNodes[2]);







//complete Job Quick Text

var block = document.getElementById("completeRescueModal").getElementsByClassName("modal-body");
var child = block[0];


var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-4");
label.classList.add("col-lg-3");
label.classList.add("control-label");

label.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh-black.png") + "\"> Quick Fill";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-lg-9");


var textbox = document.createElement("select");
textbox.classList.add("form-control");
textbox.id = "CompleteQuickTextBox";
//textbox.classList.add("form-control");
var option = document.createElement("option");
option.text = "";
textbox.add(option);

var option = document.createElement("option");
option.text = "All paperwork and documentation completed";
textbox.add(option);

var option = document.createElement("option");
option.text = "NFA";
textbox.add(option);

var option = document.createElement("option");
option.text = "NFA SES. Refered to Council";
textbox.add(option);

var option = document.createElement("option");
option.text = "Job completed";
textbox.add(option);

textboxdiv.appendChild(textbox);



innerdiv.appendChild(label);

innerdiv.appendChild(textboxdiv);

div.appendChild(innerdiv);


child.insertBefore(div,child.childNodes[6]);














//Team Complete Job Quick Text

var block = document.getElementById("completeTeamModal").getElementsByClassName("modal-body");
var child = block[0]


var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-3");
label.classList.add("control-label");

label.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh-black.png") + "\"> Quick Text";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-md-9");


var textbox = document.createElement("select");
textbox.classList.add("form-control");

textbox.id = "CompleteTeamQuickTextBox";
textbox.width = "100%";

var quickText = ["","NSW SES volunteers attended scene and resident no longer required assistance."]
                    for (var i = 0; i < quickText.length; i++) {
                        var opt = document.createElement('option');
                        opt.text = quickText[i];
                        opt.value = quickText[i];
                        textbox.add(opt);
                    }




textboxdiv.appendChild(textbox);




innerdiv.appendChild(label);

innerdiv.appendChild(textboxdiv);

div.appendChild(innerdiv);


child.insertBefore(div,child.childNodes[28]);





//Team Complete Job Quick Taks

var block = document.getElementById("completeTeamModal").getElementsByClassName("modal-body");
var child = block[0]


var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-3");
label.classList.add("control-label");

label.innerHTML = "<img width=\"16px\" style=\"vertical-align: top;margin-right:5px\" src=\"" + chrome.extension.getURL("lh-black.png") + "\"> Quick Tasks";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-md-9");


makeButton("Storm/Tree Ops","stormtree","tag-task");
makeButton("Storm/Property Protect","stormproperty","tag-task");
makeButton("Storm/Public Safety","stormsafety","tag-task");
makeButton("Storm/Road Access","stormaccess","tag-task");
makeButton("Storm/Recon","stormrecon","tag-task");


makeButton("RCR/Calloff","rcrcalloff","tag-rescue");
makeButton("RCR/Extricate","rcrcallextricate","tag-rescue");



function makeButton(text, id, icon) {


var outterspan = document.createElement("span");
outterspan.classList.add("label");
outterspan.classList.add("tag");
outterspan.classList.add(icon);

outterspan.id = id;

var innerspan = document.createElement("span");
innerspan.classList.add("tag-text");
innerspan.innerText=text


outterspan.appendChild(innerspan);

textboxdiv.appendChild(outterspan);



}



innerdiv.appendChild(label);

innerdiv.appendChild(textboxdiv);

div.appendChild(innerdiv);


child.insertBefore(div,child.childNodes[28]);










// //Team and Job and Finalise

// var block = document.getElementById("completeTeamModal").getElementsByClassName("modal-footer");
// var child = block[0]


// var a = document.createElement("a");
// a.classList.add("btn");
// a.classList.add("btn-success");
// a.classList.add("ladda-button");
// a.style.backgroundColor = "rebeccapurple";
// a.style.borderColor = "rebeccapurple";
// a.id="lighthousecompleteandfinal";


// var span = document.createElement("span");
// span.classList.add("ladda-label");
// span.innerText = "Complete Team & Job & Finalise";





// a.appendChild(span);

// console.log(span);

// child.insertBefore(a,child.childNodes[4]);



