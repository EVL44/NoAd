let isEnabled = true;
let observer;
let adCheckInterval;
let aggressiveMode = false; // Will be updated from storage

// More comprehensive list of YouTube ad selectors
const YOUTUBE_AD_SELECTORS = [
    '.ad-showing', '.video-ads', '.ytp-ad-module', '.ytp-ad-player-overlay', 
    '.ytp-ad-overlay-slot', '.ytp-ad-skip-button-container', '.ytp-ad-skip-button-modern',
    'button.ytp-ad-skip-button-slot', '.ytp-ad-message-container', 
    'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer', 
    'ytd-display-ad-renderer', 'ytd-promoted-video-renderer', 
    'ytd-video-masthead-ad-v3-renderer', 'ytd-in-feed-ad-layout-renderer',
    '#player-ads', '#masthead-ad', '.ytp-ad-progress-list', 
    '.ytp-ad-hover-text-button', 'ytm-promoted-sparkles-text-search-renderer',
    'div#movie_player.ad-interrupting', // Player when an ad is interrupting
    '.ytp-ad-text.ytp-ad-preview-text', // "Ad" label before skip
    '.ytp-ad-player-overlay-skip-or-preview',
    'div.ytp-ad-image-overlay', 'div.ytp-ad-instream-overlay',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]' // Ads in engagement panel
];

// General pop-up and overlay selectors
const POPUP_OVERLAY_SELECTORS = [
    '[class*="popup"], [id*="popup"]',
    '[class*="overlay"], [id*="overlay"]',
    '[class*="modal"], [id*="modal"]',
    '[id^="sp_message_container"]', // Common consent/ad popups
    'div[style*="z-index: 214748364"]', // High z-index (often popups, check last digit)
    'div[style*="z-index: 999999"]' // Another common high z-index
];

const POPUP_IFRAME_KEYWORDS = [
    'googleads.g.doubleclick.net', 'adservice.google.com', 'googlesyndication.com',
    'adnxs.com', 'criteo.com', 'rubiconproject.com', 'doubleclick.net',
    'popads.net', 'propellerads.com', 'adsterra.com', 'exoclick.com',
    'revcontent.com', 'mgid.com', 'outbrain.com', 'taboola.com',
    'onclickads.net', 'trafficjunky.net', 'juicyads.com', 'adtarget.com',
    'adcash.com', 'yllix.com'
];

function clickElement(element) {
    if (element && typeof element.click === 'function' && element.offsetParent !== null) { // Check if visible
        element.click();
        // console.log('[Ad Remover] Clicked element:', element);
        return true;
    }
    return false;
}

function removeElement(element, reason = 'ad element') {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        // console.log(`[Ad Remover] Removed ${reason}:`, element);
        return true;
    }
    return false;
}

function hideElementAndChildren(element, reason = 'ad element') {
    if (element && element.style) {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('width', '0px', 'important');
        element.style.setProperty('height', '0px', 'important');
        element.style.setProperty('position', 'absolute', 'important'); // Try to collapse space
        element.style.setProperty('opacity', '0', 'important');
        // console.log(`[Ad Remover] Hid ${reason}:`, element);
        
        // Also hide children that might pop back up
        const children = element.getElementsByTagName('*');
        for (let i = 0; i < children.length; i++) {
            if (children[i].style) {
                 children[i].style.setProperty('display', 'none', 'important');
            }
        }
        return true;
    }
    return false;
}

function handleYouTubeAds() {
    let adsManipulated = 0;
    const videoPlayer = document.querySelector('#movie_player');

    YOUTUBE_AD_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (selector.includes('skip-button')) {
                if (clickElement(el)) adsManipulated++;
            } else {
                if (hideElementAndChildren(el, 'YouTube ad element')) adsManipulated++;
            }
        });
    });
    
    if (videoPlayer && videoPlayer.classList.contains('ad-showing')) {
        const adVideoElements = videoPlayer.querySelectorAll('video.html5-main-video');
        adVideoElements.forEach(video => {
            try {
                if (video.volume > 0) video.volume = 0;
                if (video.playbackRate < 16) video.playbackRate = 16; // Speed up significantly
                if (!video.ended && video.duration > 0 && video.currentTime < video.duration - 0.1) {
                     video.currentTime = video.duration - 0.1;
                     adsManipulated++;
                }
                // console.log('[Ad Remover] YT ad video manipulated.');
            } catch (e) { /* console.warn("Error manipulating YT ad video", e) */ }
        });
    }
    // return adsManipulated > 0;
}

function handlePopupsAndOverlays() {
    let popupsRemoved = 0;

    POPUP_OVERLAY_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const elText = el.textContent ? el.textContent.toLowerCase() : "";
            const hasAdIframe = el.querySelector(POPUP_IFRAME_KEYWORDS.map(k => `iframe[src*="${k}"]`).join(', '));
            const hasAdText = aggressiveMode && (elText.includes('advertisement') || elText.includes('close ad') || elText.includes("accept cookies"));

            if (hasAdIframe || hasAdText) {
                if (removeElement(el, 'popup/overlay element')) popupsRemoved++;
            }
        });
    });

    document.querySelectorAll('iframe').forEach(iframe => {
        const iframeSrc = iframe.src;
        if (iframeSrc && POPUP_IFRAME_KEYWORDS.some(keyword => iframeSrc.includes(keyword))) {
            const style = window.getComputedStyle(iframe);
            if ( (style.position === 'fixed' || style.position === 'absolute') ||
                 (parseInt(style.width, 10) < 10 && parseInt(style.height, 10) < 10) ||
                 (parseFloat(style.opacity) < 0.1 && parseFloat(style.opacity) > 0) || // Partially transparent
                 (style.visibility === 'hidden') ) {
                if (removeElement(iframe, 'suspicious ad iframe')) popupsRemoved++;
            } else if (aggressiveMode && (style.zIndex > 10000 || iframe.id === "credential_picker_iframe")) { // High z-index or specific known annoying iframes
                if (removeElement(iframe, 'aggressive iframe removal')) popupsRemoved++;
            }
        }
    });
    // return popupsRemoved > 0;
}

function runAdChecks() {
    if (!isEnabled) return;

    if (window.location.hostname.includes('youtube.com/*') || window.location.hostname.includes('googleusercontent.com/youtube.com/1')) {
        handleYouTubeAds();
    }
    handlePopupsAndOverlays();
}

function initAdBlocking() {
    if (!isEnabled) {
        if (observer) observer.disconnect();
        if (adCheckInterval) clearInterval(adCheckInterval);
        adCheckInterval = null;
        return;
    }

    runAdChecks(); 

    if (!observer) {
        observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                // More targeted check: only run if nodes were added, or specific attributes changed
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    runAdChecks();
                    return; // Optimization: once relevant mutation found, run checks and exit
                }
                if (mutation.type === 'attributes') {
                     // Check if relevant attributes (like class for ad-showing or style for display) changed
                    if (mutation.target && mutation.target.classList && mutation.target.classList.contains('ad-showing') || mutation.attributeName === 'style') {
                        runAdChecks();
                        return;
                    }
                }
            }
        });
    }
    // Observe the whole document, but with attribute filters for efficiency
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'id', 'src', 'data-display-style'] // Common attrs changed by ads
    });

    if (adCheckInterval) clearInterval(adCheckInterval); // Clear previous interval if any
    adCheckInterval = setInterval(runAdChecks, aggressiveMode ? 1200 : 2800);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'enable' || message.action === 'disable') {
        isEnabled = message.action === 'enable';
        if (isEnabled) {
            chrome.storage.local.get('adRemoverAggressiveMode', result => {
                aggressiveMode = result.adRemoverAggressiveMode === true;
                initAdBlocking();
            });
        } else {
            if (observer) observer.disconnect();
            if (adCheckInterval) clearInterval(adCheckInterval);
            adCheckInterval = null;
        }
        sendResponse({status: `Content script ${isEnabled ? 'enabled' : 'disabled'}`});
    } else if (message.action === 'aggressiveModeChanged') {
        aggressiveMode = message.aggressive;
        if (isEnabled) { // Only re-init if already enabled
            if (observer) observer.disconnect();
            if (adCheckInterval) clearInterval(adCheckInterval);
            observer = null; 
            adCheckInterval = null;
            initAdBlocking(); 
        }
        sendResponse({status: "Aggressive mode updated in content script"});
    }
    return true;
});

chrome.storage.local.get(['adRemoverEnabled', 'adRemoverAggressiveMode'], result => {
    isEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
    aggressiveMode = result.adRemoverAggressiveMode === true;
    
    if (isEnabled) {
        // Wait for document to be somewhat ready before initializing
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initAdBlocking, { once: true });
        } else {
            initAdBlocking();
        }
    }
});