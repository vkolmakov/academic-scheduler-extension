function saveOptions() {
    var url = document.getElementById('inputUrl').value;
    chrome.storage.sync.set({
        settingsUrl: url
    }, function(){
        var status = document.getElementById('status');
        status.textContent = 'Options saved!';
    });
}

function restoreOptions() {
    chrome.storage.sync.get(function(items) {
        document.getElementById('inputUrl').value = items.settingsUrl;
        var status = document.getElementById('status');
        status.textContent = 'Options restored!';
    });
}

// setting default options
restoreOptions();

document.getElementById('save-button').addEventListener('click', saveOptions);
document.getElementById('restore-button').addEventListener('click', restoreOptions);
