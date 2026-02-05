/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * content.js - Content script for localStorage injection
 *
 * Stores tracks in localStorage using PolyTrack's expected format.
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
  console.log(`[TURBO LOADER] Saved track "${name}" with data starting: ${data.substring(0, 30)}...`);
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
    errors: [],
    warnings: []
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
            results.skipped++;
            status = 'skipped';
            sendProgress(i + 1, tracks.length, track.name, status);
            continue;

          case 'overwrite':
            results.overwritten++;
            status = 'overwritten';
            break;

          case 'rename':
            finalName = generateUniqueName(track.name);
            results.renamed++;
            status = 'renamed';
            break;
        }
      }

      // Determine what data to store
      let dataToStore = null;

      if (track.data && track.data.startsWith('PolyTrack')) {
        // Already in PolyTrack format - store directly
        dataToStore = track.data;
      } else if (track.shareCode) {
        // Share code - store it and let game try to parse
        // Note: This may not work directly, but we'll try
        dataToStore = track.shareCode;
        results.warnings.push(`Track "${finalName}" stored as share code - may need manual re-import`);
      }

      if (!dataToStore) {
        results.errors.push(`No valid data for track "${track.name}"`);
        sendProgress(i + 1, tracks.length, track.name, 'error');
        continue;
      }

      // Save the track
      saveTrack(finalName, dataToStore);
      results.imported++;
      sendProgress(i + 1, tracks.length, finalName, status);

      // Small delay between imports
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
