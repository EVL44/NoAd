
/**
 * Fetches the correct language file (messages.json), parses it,
 * and applies the translations to the popup's HTML.
 * @param {string} lang - The language code (e.g., 'en', 'ar').
 */
async function loadAndApplyTranslations(lang) {
    // Set HTML lang and dir attributes for proper text rendering (e.g., RTL for Arabic)
    document.documentElement.lang = lang;
    document.body.dir = (lang === 'ar') ? 'rtl' : 'ltr';

    try {
        // Fetch the correct language file from the _locales directory
        const messagesUrl = chrome.runtime.getURL(`/_locales/${lang}/messages.json`);
        const response = await fetch(messagesUrl);

        // If the language file isn't found, default to English
        if (!response.ok) {
            console.error(`Could not load translations for language: "${lang}". Falling back to 'en'.`);
            if (lang !== 'en') {
                loadAndApplyTranslations('en');
            }
            return;
        }

        const messages = await response.json();

        // Find all elements with a 'data-i18n' attribute and apply the translation
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            if (messages[messageKey]) {
                // Use the 'message' property from the JSON file
                element.textContent = messages[messageKey].message;
            } else {
                console.warn(`Translation key "${messageKey}" not found for language "${lang}".`);
            }
        });
    } catch (error) {
        console.error('Error loading or applying translations:', error);
    }
}


document.addEventListener('DOMContentLoaded', function () {
    const statusToggle = document.getElementById('status-toggle');
    const blockedOnPageEl = document.getElementById('blocked-on-page-count');
    const totalBlockedCountEl = document.getElementById('total-blocked-count');

    // Load initial state from storage
    chrome.storage.local.get(
        ['adRemoverEnabled', 'adRemoverTheme', 'adRemoverLanguage', 'totalBlockedAdCount', 'currentPageAdCount'],
        function (result) {
            // Set the toggle to the saved state (or true by default)
            const isEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
            statusToggle.checked = isEnabled;

            // Apply the saved theme (or 'light' by default)
            const theme = result.adRemoverTheme || 'light';
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${theme}`);

            // Determine the language to use
            const lang = result.adRemoverLanguage || navigator.language.split('-')[0] || 'en';
            // Load and apply the translations for the determined language
            loadAndApplyTranslations(lang);

            // Update the ad counter displays
            updateBlockedCounts(result.currentPageAdCount, result.totalBlockedAdCount);
        }
    );

    // Add listener for the enable/disable toggle
    statusToggle.addEventListener('change', function () {
        const newState = statusToggle.checked;
        chrome.storage.local.set({ adRemoverEnabled: newState });
        // Send a message to the background script to update the blocking rules
        chrome.runtime.sendMessage({ action: newState ? 'enable' : 'disable' });
    });

    // Function to update the displayed ad counts
    function updateBlockedCounts(pageCount, totalCount) {
        // If there's no page count, display "N/A"
        blockedOnPageEl.textContent = (typeof pageCount === 'number') ? pageCount.toString() : 'N/A';
        totalBlockedCountEl.textContent = totalCount || '0';
    }

    // Listen for messages from other parts of the extension to update the UI
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updateCounters") {
            if (message.hasOwnProperty('totalBlockedAdCount')) {
                chrome.storage.local.set({ totalBlockedAdCount: message.totalBlockedAdCount });
                totalBlockedCountEl.textContent = message.totalBlockedAdCount.toString();
            }
        } else if (message.action === "updatePageCount") {
            blockedOnPageEl.textContent = message.count.toString();
            chrome.storage.local.set({ currentPageAdCount: message.count });
        } else if (message.action === 'languageChanged') {
            // If the language is changed from the options page, reload translations
            loadAndApplyTranslations(message.language);
        }
        return true; // Keep the message channel open for asynchronous response
    });

    // When the popup opens, request the latest counts
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            // Ask the content script of the active tab for its ad count
            chrome.tabs.sendMessage(tabs[0].id, { action: "getCounts" })
                .catch(e => {
                    // Content script may not be running on this page (e.g., chrome:// pages)
                    // In that case, just use the value from storage
                    chrome.storage.local.get('currentPageAdCount', result => {
                        updateBlockedCounts(result.currentPageAdCount, undefined);
                    });
                });
        }
        // Get the total count from storage, which is managed by the background script
        chrome.storage.local.get('totalBlockedAdCount', result => {
             if (totalBlockedCountEl) totalBlockedCountEl.textContent = result.totalBlockedAdCount || '0';
        });
    });
});