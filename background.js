

let enabled = true;

// Initialize rules
chrome.runtime.onInstalled.addListener(() => {
    updateRules();
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'enable' || message.action === 'disable') {
        enabled = message.action === 'enable';
        updateRules();
    }
});

function updateRules() {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1000],
        addRules: enabled ? [{
            id: 1000,
            priority: 1,
            action: { type: "block" },
            condition: {
                urlFilter: "||ads.youtube.com/*",
                resourceTypes: ["xmlhttprequest"]
            }
        }] : []
    });
}

// chrome.runtime.onInstalled.addListener(() => {
// 	chrome.declarativeNetRequest.updateDynamicRules({
// 	  removeRuleIds: [1000],
// 	  addRules: [
// 		{
// 		  id: 1000,
// 		  priority: 1,
// 		  action: { type: "block" },
// 		  condition: {
// 			urlFilter: "||ads.youtube.com/*",
// 			resourceTypes: ["xmlhttprequest"]
// 		  }
// 		}
// 	  ]
// 	});
//   });
  
  // Optional: listen to blocked requests (doesn't work in all cases with declarativeNetRequest)
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
	console.log(`[Ad Remover] Blocked request: ${info.request.url}`);
  });
  