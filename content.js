/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * content.js - Content script for localStorage injection
 *
 * This script runs in the context of the PolyTrack page and handles
 * importing tracks into localStorage.
 */

// Key prefix used by PolyTrack
const TRACK_KEY_PREFIX = 'polytrack_v4_prod_track_';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'importTracks') {
    importTracks(message.tracks, message.mode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'getExistingTracks') {
    const tracks = getExistingTracks();
    sendResponse({ tracks });
    return true;
  }
});

/**
 * Get all existing track names from localStorage
 */
function getExistingTracks() {
  const tracks = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(TRACK_KEY_PREFIX)) {
      const trackName = key.replace(TRACK_KEY_PREFIX, '');
      tracks.push(trackName);
    }
  }
  return tracks;
}

/**
 * Check if a track name already exists
 */
function trackExists(name) {
  const key = `${TRACK_KEY_PREFIX}${name}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Generate a unique track name by appending a number
 */
function generateUniqueName(baseName) {
  let counter = 1;
  let newName = baseName;

  while (trackExists(newName)) {
    newName = `${baseName} (${counter})`;
    counter++;

    // Safety limit
    if (counter > 1000) {
      throw new Error(`Could not generate unique name for "${baseName}"`);
    }
  }

  return newName;
}

/**
 * Save a single track to localStorage
 */
function saveTrack(name, data) {
  const key = `${TRACK_KEY_PREFIX}${name}`;
  const payload = JSON.stringify({
    data: data,
    saveTime: Date.now()
  });
  localStorage.setItem(key, payload);
}

/**
 * Import multiple tracks with collision handling
 */
async function importTracks(tracks, mode) {
  const results = {
    success: true,
    imported: 0,
    skipped: 0,
    renamed: 0,
    overwritten: 0,
    total: tracks.length,
    errors: []
  };

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    let finalName = track.name;
    let status = 'imported';

    try {
      const exists = trackExists(track.name);

      if (exists) {
        switch (mode) {
          case 'skip':
            // Skip this track
            results.skipped++;
            status = 'skipped';
            sendProgress(i + 1, tracks.length, track.name, status);
            continue;

          case 'overwrite':
            // Overwrite existing track
            results.overwritten++;
            status = 'overwritten';
            break;

          case 'rename':
            // Generate new name
            finalName = generateUniqueName(track.name);
            results.renamed++;
            status = 'renamed';
            break;
        }
      }

      // Validate track data
      if (!track.data || !track.data.startsWith('PolyTrack')) {
        results.errors.push(`Invalid track data for "${track.name}"`);
        sendProgress(i + 1, tracks.length, track.name, 'error');
        continue;
      }

      // Save the track
      saveTrack(finalName, track.data);
      results.imported++;

      // Send progress update
      sendProgress(i + 1, tracks.length, finalName, status);

      // Small delay to avoid overwhelming the browser
      if (i < tracks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error) {
      results.errors.push(`Error importing "${track.name}": ${error.message}`);
      sendProgress(i + 1, tracks.length, track.name, 'error');
    }
  }

  return results;
}

/**
 * Send progress update to popup
 */
function sendProgress(current, total, trackName, status) {
  chrome.runtime.sendMessage({
    action: 'importProgress',
    current,
    total,
    trackName,
    status
  }).catch(() => {
    // Popup might be closed, ignore error
  });
}

// Log that content script is loaded
console.log('[TURBO LOADER 9000] Content script loaded on:', window.location.href);
