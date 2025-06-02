let extensionEnabled = true;
let aggressiveMode = false;

function updateStoredSettings(callback) {
    chrome.storage.local.get(['adRemoverEnabled', 'adRemoverAggressiveMode'], (result) => {
        extensionEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
        aggressiveMode = result.adRemoverAggressiveMode === true;
        if (callback) callback();
    });
}

function updateBlockingRulesState() {
    const rulesetId = "ads"; // ID from manifest.json

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

function notifyAllTabs(message) {
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(tab.id, message)
                    .catch(error => { /* console.log(`[Ad Remover BG] Could not send message to tab ${tab.id}: ${error.message}`) */ });
            }
        });
    });
}

// Initial setup: Called when extension is installed or updated, or browser starts
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("[Ad Remover BG] Installed.");
        chrome.storage.local.set({
            adRemoverEnabled: true,
            adRemoverTheme: 'light',
            adRemoverAggressiveMode: false
        }, () => {
            updateStoredSettings(updateBlockingRulesState);
        });
    } else if (details.reason === "update") {
        console.log("[Ad Remover BG] Updated to version " + chrome.runtime.getManifest().version);
        updateStoredSettings(updateBlockingRulesState); // Ensure rules are correctly set after an update
    }
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let settingsChangedForRules = false;
    let settingsChangedForContentScript = false;

    if (message.action === 'enable' || message.action === 'disable') {
        const newState = message.action === 'enable';
        if (extensionEnabled !== newState) {
            extensionEnabled = newState;
            chrome.storage.local.set({ adRemoverEnabled: extensionEnabled }); // Persist
            console.log(`[Ad Remover BG] Extension state changed to: ${extensionEnabled ? 'Enabled' : 'Disabled'}`);
            settingsChangedForRules = true;
            settingsChangedForContentScript = true; // Content script also needs to know
        }
    } else if (message.action === 'aggressiveModeChanged') {
        const newAggressiveState = message.aggressive;
        if (aggressiveMode !== newAggressiveState) {
            aggressiveMode = newAggressiveState;
            chrome.storage.local.set({ adRemoverAggressiveMode: aggressiveMode }); // Persist
            console.log(`[Ad Remover BG] Aggressive mode changed to: ${aggressiveMode}`);
            settingsChangedForContentScript = true;
            // Rule state might not change directly, but content script behavior will
        }
    }

    if (settingsChangedForRules) {
        updateBlockingRulesState();
    }
    if (settingsChangedForContentScript) {
        // Notify content scripts about the new state (enable/disable or aggressive mode)
        const notificationMessage = message.action === 'aggressiveModeChanged' ?
            { action: 'aggressiveModeChanged', aggressive: aggressiveMode } :
            { action: extensionEnabled ? 'enable' : 'disable' };
        notifyAllTabs(notificationMessage);
    }

    sendResponse({ status: "success", acknowledged: true });
    return true; // Indicates that sendResponse might be called asynchronously
});

// Debugging listener for matched rules
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (extensionEnabled) { // Only log if the extension is active
        // console.log(`[Ad Remover BG] Blocked by rule ${info.rule.ruleId} (ruleset: ${info.rule.rulesetId || 'dynamic'}): ${info.request.url}`);
    }
});

// Initial load of settings when the browser starts (not just install/update)
chrome.runtime.onStartup.addListener(() => {
    console.log("[Ad Remover BG] Browser startup.");
    updateStoredSettings(updateBlockingRulesState);
});

// Ensure settings are loaded once when the script first runs (e.g., after enabling the extension)
updateStoredSettings(updateBlockingRulesState);