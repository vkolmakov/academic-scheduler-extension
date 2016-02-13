chrome.runtime.sendMessage({
    method: 'getWebpageDate',
    webpageDateText: $('.wk-dayname').text()
});

