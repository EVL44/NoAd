// Final, most aggressive version of contentScript.js

let isEnabled = true;
let observer;
let adCheckInterval;
let aggressiveMode = false;

// Keywords to identify ad-related domains and URLs.
// This list is now central to the new click-interception logic.
const AD_KEYWORDS = [
    'googleads.g.doubleclick.net', 'adservice.google.com', 'googlesyndication.com',
    'adnxs.com', 'criteo.com', 'rubiconproject.com', 'doubleclick.net',
    'popads.net', 'propellerads.com', 'adsterra.com', 'exoclick.com',
    'revcontent.com', 'mgid.com', 'outbrain.com', 'taboola.com',
    'onclickads.net', 'trafficjunky.net', 'juicyads.com', 'adtarget.com',
    'adcash.com', 'yllix.com', 'ad-choices', 'ad-placement', 'popunder',
    'click-ad', 'adserver', 'banner-ad', 'preroll', 'postitial',
     'adthrive.com', 'media.net', 'adnimo.com',
    'servicer.mubawab.com', 'docdrop.ink', 'extension-download.com',

    'utm_source=', 'utm_medium=', 'utm_campaign=', 'ad-choices',
    'ad-placement', 'popunder', 'click-ad', 'adserver', 'banner-ad',
    'preroll', 'postitial', '/ads/', 'advertisement'
];

// Selectors for finding and removing ad elements from the page
const AD_ELEMENT_SELECTORS = [
    '.ad-showing', '.video-ads', '.ytp-ad-module', '.ytp-ad-player-overlay',
    '.ytp-ad-overlay-slot', '.ytp-ad-skip-button-container',
    'ytd-display-ad-renderer', 'ytd-promoted-video-renderer',
    'ytd-in-feed-ad-layout-renderer', '#player-ads', '#masthead-ad',
    '[class*="popup"], [id*="popup"]', '[class*="overlay"], [id*="overlay"]',
    '[class*="modal"], [id*="modal"]', 'div[id^="google_ads_"]',
    'div[style*="position: fixed"][style*="left: 0px"][style*="top: 0px"][style*="width: 100%"][style*="height: 100%"]'
];

/**
 * Removes an element from the page.
 * @param {HTMLElement} element The element to remove.
 * @param {string} reason A description for logging purposes.
 * @param {MouseEvent} event The click event.
 * @returns {boolean} True if the element was removed.
 */

function handleRedirectClick(event) {
    if (!isEnabled || !aggressiveMode) {
        return; // Only run when enabled and in aggressive mode.
    }

    let targetElement = event.target;
    for (let i = 0; i < 5 && targetElement; i++) {
        const attributes = (targetElement.className + ' ' + targetElement.id).toLowerCase();
        if (AD_INDICATORS.some(keyword => attributes.includes(keyword))) {
            console.log(`[NoAd] Blocked click due to ad keyword in element:`, targetElement);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        targetElement = targetElement.parentElement;
    }

    const linkElement = event.target.closest('a');
    if (linkElement && linkElement.href) {
        const url = linkElement.href.toLowerCase();
        if (AD_INDICATORS.some(keyword => url.includes(keyword))) {
            console.log(`[NoAd] Blocked click due to ad keyword in URL: ${linkElement.href}`);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
    }
}

function removeElement(element, reason = 'ad element') {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        // console.log(`[NoAd] Removed ${reason}:`, element);
        return true;
    }
    return false;
}

/**
 * Actively removes ad elements from the page based on the selector list.
 */
function runAdRemoval() {
    AD_ELEMENT_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            removeElement(el, `selector match: ${selector}`);
        });
    });

    document.querySelectorAll('iframe').forEach(iframe => {
        const iframeSrc = iframe.src || '';
        if (iframeSrc && AD_KEYWORDS.some(keyword => iframeSrc.includes(keyword))) {
             removeElement(iframe, 'ad iframe');
        }
    });
}

/**
 * This is the new, core logic to stop redirect ads.
 * It listens for all clicks. If a click would lead to an ad page,
 * it stops the click from doing anything.
 * This runs ONLY in Aggressive Mode.
 */
function initClickListener() {
    document.addEventListener('click', (event) => {
        // This logic only runs if the extension is enabled AND in aggressive mode
        if (!isEnabled || !aggressiveMode) {
            return;
        }

        // Find the link (<a> tag) that was clicked, if any
        const link = event.target.closest('a');
        if (!link || !link.href) {
            return; // Not a link click, do nothing
        }

        // Check if the link's destination URL contains any of our ad keywords
        const isAdLink = AD_KEYWORDS.some(keyword => link.href.includes(keyword));

        if (isAdLink) {
            console.log(`[NoAd] Blocked a redirect ad click to: ${link.href}`);
            // Stop the click! This prevents the new tab from opening.
            event.preventDefault();
            event.stopPropagation();
        }
    }, true); // The 'true' is crucial - it captures the click before the website can.
}


function initAdBlocking() {
    if (!isEnabled) {
        if (observer) observer.disconnect();
        if (adCheckInterval) clearInterval(adCheckInterval);
        document.addEventListener('click', handleRedirectClick, true);
        return;
    }

    // Run the ad removal logic immediately
    runAdRemoval();

    // Set up an observer to watch for new elements being added to the page
    if (!observer) {
        observer = new MutationObserver(runAdRemoval);
    }
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    // Also run the removal logic on a timer, just in case the observer misses something
    if (adCheckInterval) clearInterval(adCheckInterval);
    adCheckInterval = setInterval(runAdRemoval, aggressiveMode ? 1000 : 2500);
}

// === SCRIPT INITIALIZATION ===

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'enable' || message.action === 'disable') {
        isEnabled = message.action === 'enable';
        initAdBlocking();
    } else if (message.action === 'aggressiveModeChanged') {
        aggressiveMode = message.aggressive;
        initAdBlocking(); // Re-initialize to apply new interval speed
    }
    sendResponse({status: "Content script updated"});
    return true;
});

// Get the initial settings from storage when the page loads
chrome.storage.local.get(['adRemoverEnabled', 'adRemoverAggressiveMode'], result => {
    isEnabled = result.adRemoverEnabled !== undefined ? result.adRemoverEnabled : true;
    aggressiveMode = result.adRemoverAggressiveMode === true;

    // Start the click listener immediately. It will self-disable if not in aggressive mode.
    initClickListener();

    if (isEnabled) {
        // Start the ad blocking if the page is ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initAdBlocking);
        } else {
            initAdBlocking();
        }
    }
});