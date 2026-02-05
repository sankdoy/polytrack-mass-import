/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * injector.js - Script that runs in the page context
 *
 * This file is injected into the page when needed to access localStorage
 * in contexts where the content script can't directly access it.
 */

(function() {
  'use strict';

  // Key prefix used by PolyTrack
  const TRACK_KEY_PREFIX = 'polytrack_v4_prod_track_';

  // Listen for messages from the content script
  window.addEventListener('message', (event) => {
    // Only accept messages from the same window
    if (event.source !== window) return;

    const message = event.data;

    if (message.type === 'TURBO_LOADER_IMPORT') {
      const results = importTracks(message.tracks, message.mode);
      window.postMessage({
        type: 'TURBO_LOADER_RESULT',
        results: results
      }, '*');
    }

    if (message.type === 'TURBO_LOADER_GET_TRACKS') {
      const tracks = getExistingTracks();
      window.postMessage({
        type: 'TURBO_LOADER_TRACKS',
        tracks: tracks
      }, '*');
    }
  });

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

  function trackExists(name) {
    const key = `${TRACK_KEY_PREFIX}${name}`;
    return localStorage.getItem(key) !== null;
  }

  function generateUniqueName(baseName) {
    let counter = 1;
    let newName = baseName;

    while (trackExists(newName)) {
      newName = `${baseName} (${counter})`;
      counter++;
      if (counter > 1000) break;
    }

    return newName;
  }

  function saveTrack(name, data) {
    const key = `${TRACK_KEY_PREFIX}${name}`;
    const payload = JSON.stringify({
      data: data,
      saveTime: Date.now()
    });
    localStorage.setItem(key, payload);
  }

  function importTracks(tracks, mode) {
    const results = {
      success: true,
      imported: 0,
      skipped: 0,
      renamed: 0,
      overwritten: 0,
      total: tracks.length,
      errors: []
    };

    for (const track of tracks) {
      let finalName = track.name;

      try {
        const exists = trackExists(track.name);

        if (exists) {
          switch (mode) {
            case 'skip':
              results.skipped++;
              continue;
            case 'overwrite':
              results.overwritten++;
              break;
            case 'rename':
              finalName = generateUniqueName(track.name);
              results.renamed++;
              break;
          }
        }

        if (!track.data || !track.data.startsWith('PolyTrack')) {
          results.errors.push(`Invalid track data for "${track.name}"`);
          continue;
        }

        saveTrack(finalName, track.data);
        results.imported++;

      } catch (error) {
        results.errors.push(`Error importing "${track.name}": ${error.message}`);
      }
    }

    return results;
  }

  console.log('[TURBO LOADER 9000] Injector script ready');
})();
