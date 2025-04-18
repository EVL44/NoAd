document.addEventListener('DOMContentLoaded', function() {
    const onBtn = document.getElementById('on-btn');
    const offBtn = document.getElementById('off-btn');
    const toggleContainer = document.querySelector('.toggle-container');
    let enabled = true;

    // Initialize state
    chrome.storage.local.get(['enabled'], function(result) {
        enabled = result.enabled !== undefined ? result.enabled : true;
        updateButtonState();
    });

    function updateButtonState() {
        if(enabled) {
            onBtn.classList.add('toggle-inactive');
            offBtn.classList.add('toggle-active');
            onBtn.classList.remove('toggle-active');
            offBtn.classList.remove('toggle-inactive');
        } else {
            onBtn.classList.add('toggle-active');
            offBtn.classList.add('toggle-inactive');
            onBtn.classList.remove('toggle-inactive');
            offBtn.classList.remove('toggle-active');
        }
    }

    function toggleExtension(state) {
        chrome.storage.local.set({ enabled: state }, () => {
            // Send message to background script
            chrome.runtime.sendMessage({ action: state ? 'enable' : 'disable' });
            
            // Update content scripts on active tabs
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: state ? 'enable' : 'disable' 
                    });
                });
            });
        });
    }

    onBtn.addEventListener('click', () => {
        enabled = true;
        updateButtonState();
        toggleExtension(true);
    });

    offBtn.addEventListener('click', () => {
        enabled = false;
        updateButtonState();
        toggleExtension(false);
    });
});