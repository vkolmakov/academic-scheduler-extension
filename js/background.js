;(function () {
    var calendarUrlRegex = /(https:\/\/www\.google\.com\/calendar.*)|(https:\/\/calendar\.google\.com\/calendar\/*)/;

    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (calendarUrlRegex.exec(tab.url)) {
            chrome.tabs.executeScript(tabId, {
                file: "js/content_script.js"
            });
        }
    });

    chrome.runtime.onMessage.addListener (function (message, sender, sendResponse) {
        if (message.method === 'getWebpageDate') {
            var webpageDate = moment(message.webpageDateText, 'dddd M/D')
                .format('YYYY/MM/DD');

            chrome.storage.local.get('webpageDate', function (value) {
                chrome.storage.local.remove('webpageDate', function () {
                    value = {
                        webpageDate: webpageDate
                    };
                    chrome.storage.local.set(value);
                });
            });
        }
    });
}());
