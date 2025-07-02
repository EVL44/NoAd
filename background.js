let extensionEnabled = true;
let aggressiveMode = false;
let totalBlockedThisSession = 0;

function updateStoredSettings(callback) {
    chrome.storage.local.get(['adRemoverEnabled', 'adRemoverAggressiveMode', 'adRemoverLanguage'], (result) => {
        extensionEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
        aggressiveMode = result.adRemoverAggressiveMode === true;
        // Language setting is mostly for UI, background doesn't directly use it for logic here
        if (callback) callback();
    });
}

function updateBlockingRulesState() {
    const rulesetId = "ads"; 

    if (extensionEnabled) {
        chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [rulesetId] })
            .then(() => console.log(`[Ad Remover BG] Ruleset '${rulesetId}' enabled.`))
            .catch(err => console.error(`[Ad Remover BG] Error enabling ruleset '${rulesetId}':`, err));
    } else {
        chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [rulesetId] })
            .then(() => console.log(`[Ad Remover BG] Ruleset '${rulesetId}' disabled.`))
            .catch(err => console.error(`[Ad Remover BG] Error disabling ruleset '${rulesetId}':`, err));
    }
}

function notifyAllTabsOfStateChange(message) {
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(tab.id, message)
                    .catch(error => { /* console.log(`[Ad Remover BG] Could not send message to tab ${tab.id}: ${error.message}`) */ });
            }
        });
    });
}

// Initialize settings and counters on install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("[Ad Remover BG] Installed.");
        chrome.storage.local.set({
            adRemoverEnabled: true,
            adRemoverTheme: 'light',
            adRemoverAggressiveMode: false,
            adRemoverLanguage: navigator.language.split('-')[0] || 'en', // Default to browser lang or English
            totalBlockedAdCount: 0,
            currentPageAdCount: 0 // Initialize page count
        }, () => {
            updateStoredSettings(updateBlockingRulesState);
            totalBlockedThisSession = 0; // Reset session counter on new install
        });
    } else if (details.reason === "update") {
        console.log("[Ad Remover BG] Updated to version " + chrome.runtime.getManifest().version);
        // Preserve existing settings on update, but ensure counters are initialized if not present
        chrome.storage.local.get(['totalBlockedAdCount', 'currentPageAdCount'], (result) => {
            const update = {};
            if (result.totalBlockedAdCount === undefined) update.totalBlockedAdCount = 0;
            if (result.currentPageAdCount === undefined) update.currentPageAdCount = 0; // Though this is tab-specific
            if (Object.keys(update).length > 0) chrome.storage.local.set(update);
        });
        updateStoredSettings(updateBlockingRulesState);
        // Session counter might persist or reset depending on desired behavior. Let's reset it here.
        totalBlockedThisSession = 0; 
        chrome.storage.local.set({ totalBlockedAdCount: 0 });

    }
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let settingsChangedForRules = false;
    let settingsChangedForContentScript = false;
    let response = { status: "success", acknowledged: true };

    if (message.action === 'enable' || message.action === 'disable') {
        const newState = message.action === 'enable';
        if (extensionEnabled !== newState) {
            extensionEnabled = newState;
            chrome.storage.local.set({ adRemoverEnabled: extensionEnabled });
            console.log(`[Ad Remover BG] Extension state changed to: ${extensionEnabled ? 'Enabled' : 'Disabled'}`);
            settingsChangedForRules = true;
            settingsChangedForContentScript = true;
        }
    } else if (message.action === 'aggressiveModeChanged') {
        const newAggressiveState = message.aggressive;
        if (aggressiveMode !== newAggressiveState) {
            aggressiveMode = newAggressiveState;
            chrome.storage.local.set({ adRemoverAggressiveMode: aggressiveMode });
            console.log(`[Ad Remover BG] Aggressive mode changed to: ${aggressiveMode}`);
            settingsChangedForContentScript = true;
        }
    } else if (message.action === 'languageChanged') {
        // console.log("[Ad Remover BG] Language changed to:", message.language);
        // No direct background action, but good to acknowledge. UI parts handle this.
    } else if (message.action === 'incrementPageAdCount') {
        // This message would come from contentScript.js
        // We need to associate it with the sender's tab.
        if (sender.tab && sender.tab.id) {
            chrome.storage.local.get(`tabAdCount_${sender.tab.id}`, result => {
                let currentTabCount = result[`tabAdCount_${sender.tab.id}`] || 0;
                currentTabCount++;
                let update = {};
                update[`tabAdCount_${sender.tab.id}`] = currentTabCount;
                chrome.storage.local.set(update);
                // Optionally send updated count back to popup if it's open for this tab
                 chrome.runtime.sendMessage({ action: "updatePageCount", count: currentTabCount, tabId: sender.tab.id });
            });
        }
    } else if (message.action === 'resetPageAdCount') {
         if (sender.tab && sender.tab.id) {
            let update = {};
            update[`tabAdCount_${sender.tab.id}`] = 0;
            chrome.storage.local.set(update);
            // Optionally send updated count back to popup
            chrome.runtime.sendMessage({ action: "updatePageCount", count: 0, tabId: sender.tab.id });
        }
    }


    if (settingsChangedForRules) {
        updateBlockingRulesState();
    }
    if (settingsChangedForContentScript) {
        const notificationMessage = message.action === 'aggressiveModeChanged' ?
            { action: 'aggressiveModeChanged', aggressive: aggressiveMode } :
            { action: extensionEnabled ? 'enable' : 'disable' };
        notifyAllTabsOfStateChange(notificationMessage);
    }

    sendResponse(response);
    return true; 
});

// Listen for matched rules (declarativeNetRequest)
// IMPORTANT: This relies on the user having "Collect errors" enabled for the extension in chrome://extensions
// for the onRuleMatchedDebug event to fire. This is not ideal for typical users.
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (extensionEnabled) {
        totalBlockedThisSession++;
        // console.log(`[Ad Remover BG] DNR Blocked by rule ${info.rule.ruleId}. Total this session: ${totalBlockedThisSession}. URL: ${info.request.url}`);
        chrome.storage.local.set({ totalBlockedAdCount: totalBlockedThisSession });
        // Send update to popup if it's open
        chrome.runtime.sendMessage({ action: "updateCounters", totalBlockedAdCount: totalBlockedThisSession })
            .catch(e => { /* Popup might not be open */ });
    }
});

// Reset page-specific ad counts when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    chrome.storage.local.remove(`tabAdCount_${tabId}`);
});


// Initial load of settings
updateStoredSettings(updateBlockingRulesState);
// Initialize totalBlockedAdCount in storage if not present from a previous session
chrome.storage.local.get('totalBlockedAdCount', (result) => {
    if (result.totalBlockedAdCount !== undefined) {
        totalBlockedThisSession = result.totalBlockedAdCount;
    } else {
        chrome.storage.local.set({ totalBlockedAdCount: 0 });
    }
});
