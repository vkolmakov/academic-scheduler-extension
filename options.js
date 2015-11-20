function saveOptions() {
    var url = document.getElementById('inputUrl').value;
    var date = document.getElementById('inputEndSemesterDate').value;

    chrome.storage.sync.set({
        settingsUrl: url,
        endSemesterDate: date
    }, function(){
        var status = document.getElementById('status');
        status.textContent = 'Options saved!';
	chrome.runtime.sendMessage({'method': 'updateSettings'});
    });
}

function restoreOptions() {
    chrome.storage.sync.get(function(items) {
        document.getElementById('inputUrl').value = items.settingsUrl;
        document.getElementById('inputEndSemesterDate').value = items.endSemesterDate;
        var status = document.getElementById('status');
        status.textContent = 'Options restored!';
    });
}

// setting default options
restoreOptions();

document.getElementById('save-button').addEventListener('click', saveOptions);
document.getElementById('restore-button').addEventListener('click', restoreOptions);
