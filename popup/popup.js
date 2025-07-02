document.addEventListener('DOMContentLoaded', function () {
    const statusToggle = document.getElementById('status-toggle');
    const blockedOnPageEl = document.getElementById('blocked-on-page-count');
    const totalBlockedCountEl = document.getElementById('total-blocked-count');

    // Function to apply translations
    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            const translatedText = chrome.i18n.getMessage(messageKey);
            if (translatedText) {
                // For elements like <h1>, <p>, <a>, it's usually textContent
                // For elements that might contain other elements (like the stats labels),
                // we might need to be more careful or ensure data-i18n is on the innermost text node wrapper.
                // Here, we assume simple text replacement.
                if (element.tagName === 'A' || element.tagName === 'BUTTON' || element.tagName === 'LABEL' || element.tagName === 'P' || element.tagName === 'H1' || element.tagName === 'SPAN') {
                    element.textContent = translatedText;
                } else {
                     // Fallback or specific handling if needed
                    element.innerHTML = translatedText; // Use innerHTML if the message might contain simple HTML tags (though generally not recommended for i18n messages)
                }
            }
        });
        // For the window title, it's a bit trickier as it's outside the body.
        // document.title = chrome.i18n.getMessage("popupTitle") || "NoAd"; // This won't work for popup title
    }


    // Load initial state, theme, and apply translations
    chrome.storage.local.get(['adRemoverEnabled', 'adRemoverTheme', 'adRemoverLanguage', 'totalBlockedAdCount', 'currentPageAdCount'], function (result) {
        const isEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
        statusToggle.checked = isEnabled;

        const theme = result.adRemoverTheme || 'light';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        
        const lang = result.adRemoverLanguage || navigator.language.split('-')[0] || 'en';
        // Set HTML lang attribute for proper text rendering (e.g., RTL for Arabic)
        document.documentElement.lang = lang;
        if (lang === 'ar') {
            document.body.dir = 'rtl';
        } else {
            document.body.dir = 'ltr';
        }
        applyTranslations(); // Apply translations after setting language direction

        updateBlockedCounts(result.currentPageAdCount, result.totalBlockedAdCount);
    });

    statusToggle.addEventListener('change', function () {
        const newState = statusToggle.checked;
        chrome.storage.local.set({ adRemoverEnabled: newState }, () => {
            chrome.runtime.sendMessage({ action: newState ? 'enable' : 'disable' });
            // No need to message all tabs from popup; background script handles enabling/disabling rules and content scripts
            console.log(`Ad Remover ${newState ? 'enabled' : 'disabled'}`);
        });
    });

    function updateBlockedCounts(pageCount, totalCount) {
        const notApplicable = chrome.i18n.getMessage("popupNOLabel") || "N/A";
        if (blockedOnPageEl) {
            // If pageCount is from the active tab and is a number, display it. Otherwise, N/A.
            blockedOnPageEl.textContent = (typeof pageCount === 'number') ? pageCount.toString() : notApplicable;
        }
        if (totalBlockedCountEl) {
            totalBlockedCountEl.textContent = totalCount || '0';
        }
    }
    
    // Listen for updates from background script or content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateCounters") {
            if (message.hasOwnProperty('totalBlockedAdCount')) {
                 chrome.storage.local.set({ totalBlockedAdCount: message.totalBlockedAdCount });
                 if (totalBlockedCountEl) totalBlockedCountEl.textContent = message.totalBlockedAdCount.toString();
            }
            // For page-specific count, it's better if the content script of the active tab sends it
            // or if the background script can associate it with the tab opening the popup.
            // This example assumes background script might send it.
            if (message.hasOwnProperty('currentPageAdCount')) {
                 chrome.storage.local.set({ currentPageAdCount: message.currentPageAdCount });
                 if (blockedOnPageEl) blockedOnPageEl.textContent = message.currentPageAdCount.toString();
            }
        } else if (message.action === "updatePageCount") {
            // Sent from content script of the active tab
             if (blockedOnPageEl) blockedOnPageEl.textContent = message.count.toString();
             chrome.storage.local.set({ currentPageAdCount: message.count });

        }
    });

    // Request current counts when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            // Ask content script of active tab for its current page count
            chrome.tabs.sendMessage(tabs[0].id, { action: "getCounts" })
                .catch(e => {
                    // console.warn("Could not request page count from active tab, it might be a restricted page or not have content script.", e);
                    // If content script doesn't respond, rely on stored value or show N/A
                     chrome.storage.local.get('currentPageAdCount', result => {
                        const notApplicable = chrome.i18n.getMessage("popupNOLabel") || "N/A";
                        if (blockedOnPageEl) blockedOnPageEl.textContent = (typeof result.currentPageAdCount === 'number') ? result.currentPageAdCount.toString() : notApplicable;
                     });
                });
        }
         // Also get total count from storage (updated by background)
        chrome.storage.local.get('totalBlockedAdCount', result => {
            if (totalBlockedCountEl) totalBlockedCountEl.textContent = result.totalBlockedAdCount || '0';
        });
    });

});
