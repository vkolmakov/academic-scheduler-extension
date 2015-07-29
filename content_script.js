$('.qnb-container').remove();
var date = $('.date-top').text();
chrome.runtime.sendMessage({method: 'getDate', dateText: date});
