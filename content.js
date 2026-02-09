/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * content.js - Content script for localStorage injection
 *
 * Stores tracks in localStorage using PolyTrack's expected format.
 */

// Only operate inside the game's iframe (app-polytrack.kodub.com)
// The top-level www.kodub.com has its own separate localStorage - we don't want that one
const IS_GAME_FRAME = window.location.hostname === 'app-polytrack.kodub.com';

if (!IS_GAME_FRAME) {
  console.log('[TURBO LOADER 9000] Skipping - not the game frame:', window.location.href);
}

// Key prefix used by PolyTrack
const TRACK_KEY_PREFIX = 'polytrack_v4_prod_track_';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages if we're not in the game iframe
  if (!IS_GAME_FRAME) return false;
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

  if (message.action === 'exportAllTracks') {
    exportAllTracks()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'deleteAllTracks') {
    deleteAllTracks()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
    warnings: [],
    failedTracks: []
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
        const errorMsg = `No valid data for track "${track.name}"`;
        results.errors.push(errorMsg);
        results.failedTracks.push({
          name: track.name,
          data: track.shareCode || track.data || '',
          reason: 'Failed to decode/encode track data'
        });
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
      const errorMsg = `Error importing "${track.name}": ${error.message}`;
      results.errors.push(errorMsg);
      results.failedTracks.push({
        name: track.name,
        data: track.shareCode || track.data || '',
        reason: error.message
      });
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

/**
 * Export all tracks to a downloadable text file
 */
async function exportAllTracks() {
  try {
    const tracks = [];

    // Get all tracks from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TRACK_KEY_PREFIX)) {
        const trackName = key.replace(TRACK_KEY_PREFIX, '');
        const trackDataJSON = localStorage.getItem(key);

        if (trackDataJSON) {
          try {
            const parsed = JSON.parse(trackDataJSON);
            tracks.push({
              name: trackName,
              data: parsed.data,
              saveTime: parsed.saveTime
            });
          } catch (e) {
            console.error(`Failed to parse track "${trackName}":`, e);
          }
        }
      }
    }

    if (tracks.length === 0) {
      return { success: false, error: 'No tracks found to export' };
    }

    // Create file content in the format: Track Name | Track Data
    let fileContent = `# PolyTrack Exported Tracks - ${new Date().toLocaleString()}\n`;
    fileContent += `# Total Tracks: ${tracks.length}\n\n`;

    tracks.forEach(track => {
      fileContent += `${track.name} | ${track.data}\n`;
    });

    // Create and download the file
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `polytrack_export_${timestamp}.txt`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      count: tracks.length,
      filename: filename
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete all imported tracks from localStorage
 */
async function deleteAllTracks() {
  try {
    const tracksToDelete = [];

    // Collect all track keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TRACK_KEY_PREFIX)) {
        tracksToDelete.push(key);
      }
    }

    if (tracksToDelete.length === 0) {
      return { success: false, error: 'No tracks found to delete' };
    }

    // Delete all tracks
    tracksToDelete.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`[TURBO LOADER] Deleted ${tracksToDelete.length} tracks`);

    return {
      success: true,
      count: tracksToDelete.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Log that content script is loaded
console.log('[TURBO LOADER 9000] Content script loaded on:', window.location.href);
