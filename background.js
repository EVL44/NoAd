// background.js
chrome.runtime.onInstalled.addListener(() => {
	chrome.declarativeNetRequest.updateDynamicRules({
	  addRules: [{
		'id': 1000,
		'priority': 1,
		'action': {'type': 'block'},
		'condition': {
		  'urlFilter': '||ads.youtube.com/*',
		  'resourceTypes': ['xmlhttprequest']
		}
	  }],
	  removeRuleIds: [1000]
	});
  });