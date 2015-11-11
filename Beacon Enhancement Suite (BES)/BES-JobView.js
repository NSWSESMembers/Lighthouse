//replace window title with job number
var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "document.title = \"#\"+jobId";
    (document.head || document.documentElement).appendChild(s)

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
var s = document.createElement('script');
s.src = chrome.extension.getURL('BES-JobsViewContent.js');
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

label.innerText = "BES Quick Text";


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





//Finalise Job Quick Text

var block = document.getElementById("completeTeamModal").getElementsByClassName("modal-body");
var child = block[0]


var div = document.createElement("div");
div.classList.add("form-group");


var innerdiv = document.createElement("div");
innerdiv.classList.add("row");


var label = document.createElement("label");
label.classList.add("col-md-3");
label.classList.add("control-label");

label.innerText = "BES Quick Text";


var textboxdiv = document.createElement("div");
textboxdiv.classList.add("col-md-9");


var textbox = document.createElement("select");
textbox.classList.add("form-control");

textbox.id = "CompleteQuickTextBox";
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

console.log(child.childNodes)

child.insertBefore(div,child.childNodes[28]);



