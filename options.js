document.addEventListener('DOMContentLoaded', function () {
    const themeToggle = document.getElementById('theme-toggle');
    const aggressiveModeToggle = document.getElementById('aggressive-mode-toggle');
    const languageSelect = document.getElementById('language-select');
    const saveStatusEl = document.getElementById('save-status');

    // Function to apply translations to the options page
    function applyTranslations(selectedLang = 'en') {
         // Set HTML lang attribute for proper text rendering (e.g., RTL for Arabic)
        document.documentElement.lang = selectedLang;
        if (selectedLang === 'ar') {
            document.body.dir = 'rtl';
        } else {
            document.body.dir = 'ltr';
        }

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const messageKey = element.getAttribute('data-i18n');
            const translatedText = chrome.i18n.getMessage(messageKey);
            if (translatedText) {
                if (element.tagName === 'OPTION') { // For option elements, set text directly
                    element.textContent = translatedText;
                } else {
                    element.textContent = translatedText;
                }
            }
        });
        // Update select options manually if needed, though data-i18n on option tags should work with the above
        // document.querySelector('option[value="en"]').textContent = chrome.i18n.getMessage("optionsLanguageEnglish");
        // document.querySelector('option[value="ar"]').textContent = chrome.i18n.getMessage("optionsLanguageArabic");
    }

    // Load stored settings
    chrome.storage.local.get(['adRemoverTheme', 'adRemoverAggressiveMode', 'adRemoverLanguage'], function (result) {
        const currentTheme = result.adRemoverTheme || 'light';
        themeToggle.checked = currentTheme === 'dark';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);

        aggressiveModeToggle.checked = result.adRemoverAggressiveMode === true;

        const currentLanguage = result.adRemoverLanguage || navigator.language.split('-')[0] || 'en';
        languageSelect.value = currentLanguage;
        applyTranslations(currentLanguage); // Apply translations on load
    });

    function showSaveStatus(messageKey, isSuccess = true) {
        const message = chrome.i18n.getMessage(messageKey) || messageKey; // Get translated message
        saveStatusEl.textContent = message;
        saveStatusEl.className = 'save-status ' + (isSuccess ? 'success' : 'error');
        saveStatusEl.style.display = 'block'; // Make it visible
        setTimeout(() => {
            saveStatusEl.style.display = 'none';
            saveStatusEl.className = 'save-status'; 
        }, 3000);
    }

    themeToggle.addEventListener('change', function () {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        chrome.storage.local.set({ adRemoverTheme: newTheme }, function () {
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${newTheme}`);
            showSaveStatus('optionsSaveStatusSuccess');
            chrome.runtime.sendMessage({ action: 'themeChanged', theme: newTheme }).catch(e => console.log("Error sending themeChanged message:", e));
        });
    });

    aggressiveModeToggle.addEventListener('change', function () {
        const isAggressive = aggressiveModeToggle.checked;
        chrome.storage.local.set({ adRemoverAggressiveMode: isAggressive }, function () {
            showSaveStatus(isAggressive ? 'optionsSaveStatusAggressiveEnabled' : 'optionsSaveStatusAggressiveDisabled');
            chrome.runtime.sendMessage({ action: 'aggressiveModeChanged', aggressive: isAggressive }).catch(e => console.log("Error sending aggressiveModeChanged message:",e));
        });
    });

    languageSelect.addEventListener('change', function () {
        const newLanguage = languageSelect.value;
        chrome.storage.local.set({ adRemoverLanguage: newLanguage }, function () {
            applyTranslations(newLanguage); // Re-apply translations for the current page
            showSaveStatus('optionsSaveStatusLanguage');
            // Notify other parts of the extension (like popup) if they need to update dynamically
            chrome.runtime.sendMessage({ action: 'languageChanged', language: newLanguage }).catch(e => console.log("Error sending languageChanged message:",e));
        });
    });
});
