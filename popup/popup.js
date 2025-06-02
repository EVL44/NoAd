document.addEventListener('DOMContentLoaded', function () {
    const statusToggle = document.getElementById('status-toggle');
    const blockedCountEl = document.getElementById('blocked-count');
    const totalBlockedCountEl = document.getElementById('total-blocked-count');

    // Load initial state and theme
    chrome.storage.local.get(['adRemoverEnabled', 'adRemoverTheme'], function (result) {
        const isEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
        statusToggle.checked = isEnabled;

        const theme = result.adRemoverTheme || 'light'; // Default to light
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    });

    statusToggle.addEventListener('change', function () {
        const newState = statusToggle.checked;
        chrome.storage.local.set({ adRemoverEnabled: newState }, () => {
            // Send message to background script
            chrome.runtime.sendMessage({ action: newState ? 'enable' : 'disable' });

            // Update content scripts on active tabs
            chrome.tabs.query({}, tabs => { // Query all tabs, not just active
                tabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: newState ? 'enable' : 'disable'
                        }).catch(error => console.log(`Error sending message to tab ${tab.id}: ${error.message}. It might be a privileged page.`));
                    }
                });
            });
            console.log(`Ad Remover ${newState ? 'enabled' : 'disabled'}`);
        });
    });

    // Placeholder for fetching and displaying blocked counts
    // You'll need to implement logic in your background script to track these
    // and make them available to the popup.
    function updateBlockedCounts() {
        chrome.storage.local.get(['blockedThisPage', 'blockedTotal'], function(result) {
            if (blockedCountEl) blockedCountEl.textContent = result.blockedThisPage || '0';
            if (totalBlockedCountEl) totalBlockedCountEl.textContent = result.blockedTotal || 'N/A';
        });
    }

    // Example: Listen for updates from background script (if you implement it)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateCounts") {
            if (blockedCountEl) blockedCountEl.textContent = message.blockedThisPage || '0';
            if (totalBlockedCountEl) totalBlockedCountEl.textContent = message.blockedTotal || 'N/A';
        }
    });

    // Initial update
    updateBlockedCounts();
});