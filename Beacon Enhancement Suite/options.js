window.addEventListener("load", function load(event){
});



// Saves options to chrome.storage
function save_options() {
  var time = document.getElementById('time').value;
  chrome.storage.sync.set({
    time: time
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1000);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    time: 'today'
  }, function(items) {
    document.getElementById('time').value = items.time;
  });

}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);