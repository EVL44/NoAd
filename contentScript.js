// contentScript.js (for YouTube)
const observer = new MutationObserver(mutations => {
    // Remove video ads
    document.querySelectorAll('.video-ads, .ad-showing').forEach(element => {
      element.remove();
      console.warn("got u lol.");
    });
  
    // Remove banner ads
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
        console.warn("got u twice.");
      } 

    });
  
    // Skip ad overlay
    const skipButton = document.querySelector('.ytp-ad-skip-button');
    if (skipButton) skipButton.click();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Block ad autoplay
  if (window.location.pathname === '/watch') {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = video.duration;
      console.error(video)
      video.pause();
    }
  }