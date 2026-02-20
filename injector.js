/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * injector.js - Script that runs in the page context
 *
 * This file is injected into the page when needed to access localStorage
 * in contexts where the content script can't directly access it.
 */

(function() {
  'use strict';

  function detectTrackStorageConfig() {
    const fallbackVersion = 4;
    const trackPrefixCounts = new Map(); // prefix -> count
    const prodVersions = new Set();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const prodMatch = key.match(/^polytrack_v(\d+)_prod_/);
      if (prodMatch) {
        prodVersions.add(Number(prodMatch[1]));
      }

      const trackMatch = key.match(/^(polytrack_v\d+_prod_track_)/);
      if (trackMatch) {
        const prefix = trackMatch[1];
        trackPrefixCounts.set(prefix, (trackPrefixCounts.get(prefix) || 0) + 1);
      }
    }

    let trackKeyPrefix = null;
    if (trackPrefixCounts.size > 0) {
      const sorted = [...trackPrefixCounts.entries()].sort((a, b) => b[1] - a[1]);
      trackKeyPrefix = sorted[0][0];
    } else {
      const inferredVersion = prodVersions.size > 0 ? Math.max(...prodVersions) : fallbackVersion;
      trackKeyPrefix = `polytrack_v${inferredVersion}_prod_track_`;
    }

    let encodeName = name => name;
    let decodeName = name => name;
    let payloadMode = 'json'; // 'json' | 'raw'
    let payloadTemplate = null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(trackKeyPrefix)) continue;

      const suffix = key.substring(trackKeyPrefix.length);

      try {
        const decoded = decodeURIComponent(suffix);
        if (decoded !== suffix) {
          encodeName = name => encodeURIComponent(name);
          decodeName = name => decodeURIComponent(name);
        }
      } catch {
        // ignore
      }

      const rawValue = localStorage.getItem(key);
      if (typeof rawValue === 'string') {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed && typeof parsed === 'object' && 'data' in parsed) {
            payloadMode = 'json';
            payloadTemplate = parsed;
          } else {
            payloadMode = 'raw';
          }
        } catch {
          payloadMode = 'raw';
        }
      }

      break;
    }

    return {
      trackKeyPrefix,
      encodeName,
      decodeName,
      payloadMode,
      payloadTemplate
    };
  }

  const TRACK_STORAGE = detectTrackStorageConfig();
  const TRACK_KEY_PREFIX = TRACK_STORAGE.trackKeyPrefix;

  console.log('[TURBO LOADER 9000] Injector track storage config:', {
    prefix: TRACK_KEY_PREFIX,
    payloadMode: TRACK_STORAGE.payloadMode,
    hasTemplate: Boolean(TRACK_STORAGE.payloadTemplate)
  });

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
        const trackName = TRACK_STORAGE.decodeName(key.replace(TRACK_KEY_PREFIX, ''));
        tracks.push(trackName);
      }
    }
    return tracks;
  }

  function trackExists(name) {
    const key = `${TRACK_KEY_PREFIX}${TRACK_STORAGE.encodeName(name)}`;
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
    const key = `${TRACK_KEY_PREFIX}${TRACK_STORAGE.encodeName(name)}`;

    if (TRACK_STORAGE.payloadMode === 'raw') {
      localStorage.setItem(key, data);
      return;
    }

    const template = TRACK_STORAGE.payloadTemplate && typeof TRACK_STORAGE.payloadTemplate === 'object'
      ? { ...TRACK_STORAGE.payloadTemplate }
      : {};

    template.data = data;
    template.saveTime = Date.now();
    template.timestamp = template.saveTime;

    localStorage.setItem(key, JSON.stringify(template));
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
