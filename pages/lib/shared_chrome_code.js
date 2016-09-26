chrome.manifest = (function() {

    var manifestObject = false;
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            manifestObject = JSON.parse(xhr.responseText);
        }
    };
    xhr.open("GET", chrome.extension.getURL('/manifest.json'), false);

    try {
        xhr.send();
    } catch(e) {
        console.log('Couldn\'t load manifest.json');
    }

    return manifestObject;

})();
