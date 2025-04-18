// contentScript.js (for YouTube)

let isEnabled = true;
let observer;

function initAdBlocking() {
  if(!isEnabled) return;

  observer = new MutationObserver(mutations => {
      // Existing ad removal logic
      document.querySelectorAll('.video-ads, .ad-showing').forEach(el => el.remove());
      
  });

  const banners = [
    '#masthead-ad', 
    '#player-ads',
    '.ytd-banner-promo-renderer',
    '#ad-container'
  ];
  
  banners.forEach(selector => {
    const ad = document.querySelector(selector);
    if (ad) {
      ad.remove();
    } 

  });

  // Skip ad overlay
  const skipButton = document.querySelector('.ytp-ad-skip-button');
  if (skipButton) skipButton.click();

  observer.observe(document.body, {
      childList: true,
      subtree: true
  });
}

// const observer = new MutationObserver(mutations => {
//     // Remove video ads
//     document.querySelectorAll('.video-ads, .ad-showing').forEach(element => {
//       element.remove();
//     });
  
//     // Remove banner ads
//     const banners = [
//       '#masthead-ad', 
//       '#player-ads',
//       '.ytd-banner-promo-renderer',
//       '#ad-container'
//     ];
    
//     banners.forEach(selector => {
//       const ad = document.querySelector(selector);
//       if (ad) {
//         ad.remove();
//       } 

//     });
  
//     // Skip ad overlay
//     const skipButton = document.querySelector('.ytp-ad-skip-button');
//     if (skipButton) skipButton.click();
//   });

//   document.addEventListener("DOMContentLoaded", () => {
//     if (document.body) {
//       observer.observe(document.body, {
//         childList: true,
//         subtree: true
//       });
//     }
//   });
  

  chrome.runtime.onMessage.addListener(message => {
    if(message.action === 'enable') {
        isEnabled = true;
        initAdBlocking();
    } else if(message.action === 'disable') {
        isEnabled = false;
        if(observer) observer.disconnect();
    }
  });

  // Initial load
  chrome.storage.local.get(['enabled'], result => {
    isEnabled = result.enabled ?? true;
    if(isEnabled) initAdBlocking();
  });
  
  // Block ad autoplay
  if (window.location.pathname === '/watch') {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = video.duration;
      video.pause();
    }
  }