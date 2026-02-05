/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * background.js - Service worker
 */

// Log when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[TURBO LOADER 9000] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Open the PolyTrack page on first install
    chrome.tabs.create({
      url: 'https://www.kodub.com/apps/polytrack'
    });
  }
});

// Relay messages between content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward progress updates from content script to popup
  if (message.action === 'importProgress') {
    // This is handled by the popup's listener
    return false;
  }

  return false;
});

// Handle action button click when not on PolyTrack
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we're on PolyTrack
  if (!tab.url || !tab.url.includes('kodub.com')) {
    // Redirect to PolyTrack
    await chrome.tabs.update(tab.id, {
      url: 'https://www.kodub.com/apps/polytrack'
    });
  }
});

console.log('[TURBO LOADER 9000] Background service worker initialized');
