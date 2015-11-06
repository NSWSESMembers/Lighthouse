// Saves options to chrome.storage
function save_options() {
  var id = document.getElementById('id').value;
  var time = document.getElementById('time').value;
  chrome.storage.sync.set({
    unitid: id,
    time: time
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    unitid: '199',
    time: 'today'
  }, function(items) {
    document.getElementById('id').value = items.unitid;
    document.getElementById('time').value = items.time;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);