
/**
 * Fetches the correct language file (messages.json), parses it,
 * and applies the translations to the options page's HTML.
 * @param {string} lang - The language code (e.g., 'en', 'ar').
 */
async function loadAndApplyTranslations(lang) {
    // Set HTML lang and dir attributes for proper text rendering
    document.documentElement.lang = lang;
    document.body.dir = (lang === 'ar') ? 'rtl' : 'ltr';

    try {
        // Fetch the correct language file
        const messagesUrl = chrome.runtime.getURL(`/_locales/${lang}/messages.json`);
        const response = await fetch(messagesUrl);

        // Fallback to English if the language file isn't found
        if (!response.ok) {
            console.error(`Could not load translations for language: "${lang}". Falling back to 'en'.`);
            if (lang !== 'en') {
                loadAndApplyTranslations('en');
            }
            return;
        }

        const messages = await response.json();

        // Apply translations to all elements with a 'data-i18n' attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            if (messages[messageKey]) {
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
    const themeToggle = document.getElementById('theme-toggle');
    const aggressiveModeToggle = document.getElementById('aggressive-mode-toggle');
    const languageSelect = document.getElementById('language-select');
    const saveStatusEl = document.getElementById('save-status');

    // Load stored settings when the page is opened
    chrome.storage.local.get(['adRemoverTheme', 'adRemoverAggressiveMode', 'adRemoverLanguage'], function (result) {
        // Set the theme toggle
        const currentTheme = result.adRemoverTheme || 'light';
        themeToggle.checked = currentTheme === 'dark';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);

        // Set the aggressive mode toggle
        aggressiveModeToggle.checked = result.adRemoverAggressiveMode === true;

        // Set the language selector and apply translations
        const currentLanguage = result.adRemoverLanguage || navigator.language.split('-')[0] || 'en';
        languageSelect.value = currentLanguage;
        loadAndApplyTranslations(currentLanguage);
    });

    // Function to show a temporary "Saved!" status message
    function showSaveStatus(messageKey, isSuccess = true) {
        // We will just use a simple hardcoded message for simplicity
        const message = "Settings saved!";
        saveStatusEl.textContent = message;
        saveStatusEl.className = 'save-status ' + (isSuccess ? 'success' : 'error');
        saveStatusEl.style.display = 'block';
        setTimeout(() => {
            saveStatusEl.style.display = 'none';
        }, 3000);
    }

    // Add listener for the theme toggle
    themeToggle.addEventListener('change', function () {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        chrome.storage.local.set({ adRemoverTheme: newTheme }, function () {
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${newTheme}`);
            showSaveStatus('optionsSaveStatusSuccess');
        });
    });

    // Add listener for the aggressive mode toggle
    aggressiveModeToggle.addEventListener('change', function () {
        const isAggressive = aggressiveModeToggle.checked;
        chrome.storage.local.set({ adRemoverAggressiveMode: isAggressive }, function () {
            showSaveStatus(isAggressive ? 'optionsSaveStatusAggressiveEnabled' : 'optionsSaveStatusAggressiveDisabled');
            chrome.runtime.sendMessage({ action: 'aggressiveModeChanged', aggressive: isAggressive });
        });
    });

    // Add listener for the language selector
    languageSelect.addEventListener('change', function () {
        const newLanguage = languageSelect.value;
        chrome.storage.local.set({ adRemoverLanguage: newLanguage }, function () {
            // Reload translations for the options page itself
            loadAndApplyTranslations(newLanguage);
            showSaveStatus('optionsSaveStatusLanguage');
            // Notify other parts of the extension (like the popup) about the change
            chrome.runtime.sendMessage({ action: 'languageChanged', language: newLanguage });
        });
    });
});