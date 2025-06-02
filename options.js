document.addEventListener('DOMContentLoaded', function () {
    const themeToggle = document.getElementById('theme-toggle');
    const aggressiveModeToggle = document.getElementById('aggressive-mode-toggle');
    const languageSelect = document.getElementById('language-select'); // Placeholder
    const saveStatusEl = document.getElementById('save-status');

    // Load stored settings
    chrome.storage.local.get(['adRemoverTheme', 'adRemoverAggressiveMode', 'adRemoverLanguage'], function (result) {
        // Theme
        const currentTheme = result.adRemoverTheme || 'light';
        themeToggle.checked = currentTheme === 'dark';
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);

        // Aggressive Mode
        aggressiveModeToggle.checked = result.adRemoverAggressiveMode === true;

        // Language (placeholder)
        if (result.adRemoverLanguage) {
            languageSelect.value = result.adRemoverLanguage;
        }
    });

    function showSaveStatus(message, isSuccess = true) {
        saveStatusEl.textContent = message;
        saveStatusEl.className = 'save-status ' + (isSuccess ? 'success' : 'error');
        setTimeout(() => {
            saveStatusEl.style.display = 'none';
            saveStatusEl.className = 'save-status'; // Reset class
        }, 3000);
    }

    // Save theme preference
    themeToggle.addEventListener('change', function () {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        chrome.storage.local.set({ adRemoverTheme: newTheme }, function () {
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${newTheme}`);
            showSaveStatus('Theme settings saved!');
            // Notify popup or other parts if needed
             chrome.runtime.sendMessage({ action: 'themeChanged', theme: newTheme }).catch(e => console.log(e));
        });
    });

    // Save aggressive mode preference
    aggressiveModeToggle.addEventListener('change', function () {
        const isAggressive = aggressiveModeToggle.checked;
        chrome.storage.local.set({ adRemoverAggressiveMode: isAggressive }, function () {
            showSaveStatus(`Aggressive mode ${isAggressive ? 'enabled' : 'disabled'}.`);
            // Notify background script if aggressive mode changes require immediate action
            chrome.runtime.sendMessage({ action: 'aggressiveModeChanged', aggressive: isAggressive }).catch(e => console.log(e));
        });
    });

    // Save language preference (placeholder)
    languageSelect.addEventListener('change', function () {
        const newLanguage = languageSelect.value;
        chrome.storage.local.set({ adRemoverLanguage: newLanguage }, function () {
            showSaveStatus(`Language preference saved (currently a placeholder).`);
        });
    });
});