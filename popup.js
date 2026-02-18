/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * popup.js - Main popup logic
 *
 * PolyTrack uses a custom encoding system:
 * - 62-character alphabet: A-Za-z0-9
 * - Variable bit lengths (5 or 6 bits per character)
 * - Deflate compression for PolyTrack1 format
 */

// ==========================================
// PolyTrack Custom Encoding (from game bundle)
// ==========================================

// Forward alphabet: index -> character
const yA = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"];

// Reverse lookup: char code -> index (or -1 for invalid)
const bA = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,-1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51];

/**
 * EA - Bit packing helper for decoder
 * Packs bits into a byte array
 */
function EA(bytes, bitOffset, numBits, value, isLast) {
  const byteIndex = Math.floor(bitOffset / 8);
  while (byteIndex >= bytes.length) bytes.push(0);

  const bitPos = bitOffset - 8 * byteIndex;
  bytes[byteIndex] |= (value << bitPos) & 255;

  if (bitPos > 8 - numBits && !isLast) {
    const nextByteIndex = byteIndex + 1;
    if (nextByteIndex >= bytes.length) bytes.push(0);
    bytes[nextByteIndex] |= value >> (8 - bitPos);
  }
}

/**
 * kA - Bit reading helper for encoder
 * Reads bits from a byte array
 */
function kA(bytes, bitOffset) {
  const byteIndex = Math.floor(bitOffset / 8);
  if (byteIndex >= bytes.length) return 0;

  const bitPos = bitOffset - 8 * byteIndex;
  let value = bytes[byteIndex] >> bitPos;

  if (byteIndex + 1 < bytes.length && bitPos > 2) {
    value |= bytes[byteIndex + 1] << (8 - bitPos);
  }

  return value & 63; // 6 bits max
}

/**
 * xA - PolyTrack custom decoder
 * Decodes the custom 62-char encoding to bytes
 * Returns Uint8Array or null on error
 */
function xA(str) {
  let bitOffset = 0;
  const bytes = [];
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode >= bA.length) return null;

    const value = bA[charCode];
    if (value === -1) return null;

    const isLast = i === len - 1;

    // Variable bit length: values 0-30 use 6 bits, 31+ use 5 bits
    if ((30 & ~value) !== 0) {
      EA(bytes, bitOffset, 6, value, isLast);
      bitOffset += 6;
    } else {
      EA(bytes, bitOffset, 5, value & 31, isLast);
      bitOffset += 5;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * AA - PolyTrack custom encoder
 * Encodes bytes to the custom 62-char format
 */
function AA(bytes) {
  let bitOffset = 0;
  let result = "";
  const totalBits = 8 * bytes.length;

  while (bitOffset < totalBits) {
    const value = kA(bytes, bitOffset);
    let charIndex;

    // Variable bit length encoding
    if ((30 & ~value) !== 0) {
      charIndex = value;
      bitOffset += 6;
    } else {
      charIndex = value & 31;
      bitOffset += 5;
    }

    result += yA[charIndex];
  }

  return result;
}

/**
 * wv - Base64URL decoder (for v1n format)
 * Standard base64url: replace - with +, _ with /, add padding, then atob
 */
function wv(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4) base64 += '=';
  try {
    const decoded = atob(base64);
    // Convert to Uint8Array
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return null;
  }
}

/**
 * Decode v3 format share code
 * Format: v3 + [2 chars = name length] + [N chars = name] + [rest = track data]
 * Example: v3LACl0RgI0TTNF4pdXWm...
 *   - "v3" prefix
 *   - "LA" decodes via xA to get name length (e.g., 11)
 *   - Next ceil(11/3*4)=15 chars encode the name bytes
 */
function decodeV3(shareCode) {
  if (!shareCode.startsWith('v3') || shareCode.startsWith('v2')) return null;

  try {
    // Get name length from first 2 chars after "v3"
    const nameLenChars = shareCode.substring(2, 4);
    const nameLenBytes = xA(nameLenChars);
    if (!nameLenBytes || nameLenBytes.length === 0) {
      console.error(`[v3 decode] Failed to decode name length from "${nameLenChars}"`);
      return null;
    }

    const nameLen = nameLenBytes[0];
    console.log(`[v3 decode] Name length: ${nameLen}`);

    // Calculate encoded chars for name: ceil(nameLen / 3 * 4)
    const nameEncodedLen = Math.ceil(nameLen / 3 * 4);
    console.log(`[v3 decode] Name encoded length: ${nameEncodedLen}`);

    // Decode name
    const nameEncodedStr = shareCode.substring(4, 4 + nameEncodedLen);
    console.log(`[v3 decode] Name encoded string: "${nameEncodedStr}"`);

    const nameBytes = xA(nameEncodedStr);
    if (!nameBytes) {
      console.error(`[v3 decode] Failed to decode name bytes`);
      return null;
    }

    // UTF-8 decode the name
    const name = new TextDecoder().decode(nameBytes.slice(0, nameLen));
    console.log(`[v3 decode] Decoded name: "${name}"`);

    return { name, shareCode };
  } catch (e) {
    console.error('v3 decode error:', e);
    return null;
  }
}

/**
 * Decode v1n format share code
 * Format: v1n + [2 chars base64url = name length] + [URL-encoded name] + [track data]
 * Example: v1nEgwhirled%20up%20boxBQAB...
 *   - "v1n" prefix
 *   - "Eg" base64 decodes to 18 (length of URL-encoded name)
 *   - "whirled%20up%20box" (18 chars) URL-decodes to "whirled up box"
 */
function decodeV1n(shareCode) {
  if (!shareCode.startsWith('v1n')) return null;

  try {
    // Get name length from chars 3-5 (base64url encoded)
    const nameLenBytes = wv(shareCode.substring(3, 5));
    if (!nameLenBytes || nameLenBytes.length === 0) return null;

    const nameLen = nameLenBytes[0];
    console.log(`[v1n decode] Name length: ${nameLen}`);

    // Next nameLen chars are URL-encoded name
    const encodedName = shareCode.substring(5, 5 + nameLen);
    console.log(`[v1n decode] Encoded name: "${encodedName}"`);

    const name = decodeURIComponent(encodedName);
    console.log(`[v1n decode] Decoded name: "${name}"`);

    return { name, shareCode };
  } catch (e) {
    console.error('v1n decode error:', e);
    return null;
  }
}

/**
 * Decode PolyTrack storage formats (PolyTrack1, PolyTrack24pdr, etc.)
 * These are storage formats that can be saved directly to localStorage.
 * Name cannot be extracted without game-internal decoding.
 */
function decodePolyTrackStorage(data) {
  if (!data.startsWith('PolyTrack')) return null;

  // All PolyTrack* storage formats are stored as-is
  return { name: null, data };
}

/**
 * Extract track name from any share code format
 */
function extractTrackName(shareCode) {
  if (shareCode.startsWith('v3') && !shareCode.startsWith('v2')) {
    const result = decodeV3(shareCode);
    return result ? result.name : null;
  }

  if (shareCode.startsWith('v1n')) {
    const result = decodeV1n(shareCode);
    return result ? result.name : null;
  }

  return null;
}

// State
let parsedTracks = [];
let collisionMode = 'skip'; // skip, overwrite, rename
let isImporting = false;
let legacyMode = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const loadFileBtn = document.getElementById('loadFileBtn');
const fileDropZone = document.getElementById('fileDropZone');
const fileName = document.getElementById('fileName');
const trackCount = document.getElementById('trackCount');
const importBtn = document.getElementById('importBtn');
const statusDisplay = document.getElementById('statusDisplay');
const ledReady = document.getElementById('ledReady');
const ledProcessing = document.getElementById('ledProcessing');
const ledError = document.getElementById('ledError');
const modeKnob = document.getElementById('modeKnob');
const modeDescription = document.getElementById('modeDescription');
const consoleOutput = document.getElementById('consoleOutput');
const clearConsole = document.getElementById('clearConsole');
const progressText = document.getElementById('progressText');
const helpToggle = document.getElementById('helpToggle');
const formatHelp = document.getElementById('formatHelp');
const closeHelp = document.getElementById('closeHelp');
const exportBtn = document.getElementById('exportBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const legacyModeBtn = document.getElementById('legacyModeBtn');

// Mode descriptions
const modeDescriptions = {
  skip: 'Skip existing tracks',
  overwrite: 'Overwrite existing tracks',
  rename: 'Add suffix to duplicates'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  setupEventListeners();
  setLedState('ready');
  log('TURBO LOADER 9000 INITIALIZED', 'success');
  log('WAITING FOR TRACK DATA...');
});

function initializeUI() {
  // Set initial mode
  updateModeLabel('skip');
}

function setupEventListeners() {
  // File input
  loadFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  fileDropZone.addEventListener('dragover', handleDragOver);
  fileDropZone.addEventListener('dragleave', handleDragLeave);
  fileDropZone.addEventListener('drop', handleDrop);
  fileDropZone.addEventListener('click', () => fileInput.click());

  // Mode knob
  modeKnob.addEventListener('click', cycleMode);

  // Mode labels
  document.querySelectorAll('.mode-label').forEach(label => {
    label.addEventListener('click', () => {
      const mode = label.dataset.mode;
      setMode(mode);
    });
  });

  // Import button
  importBtn.addEventListener('click', startImport);

  // Console clear
  clearConsole.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
    log('CONSOLE CLEARED');
  });

  // Help panel
  helpToggle.addEventListener('click', () => {
    formatHelp.classList.toggle('visible');
  });

  closeHelp.addEventListener('click', () => {
    formatHelp.classList.remove('visible');
  });

  // Export all tracks
  exportBtn.addEventListener('click', exportAllTracks);

  // Delete all tracks
  deleteAllBtn.addEventListener('click', deleteAllTracksWithConfirm);

  // Legacy mode toggle
  legacyModeBtn.addEventListener('click', toggleLegacyMode);
}

// File Handling
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length > 0) {
    processFiles(files);
  }
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  fileDropZone.classList.add('dragover');
}

function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  fileDropZone.classList.remove('dragover');
}

function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  fileDropZone.classList.remove('dragover');

  const files = Array.from(event.dataTransfer.files);
  if (files.length > 0) {
    // Filter for valid file types
    const validFiles = files.filter(file =>
      file.name.endsWith('.txt') || file.name.endsWith('.csv')
    );

    if (validFiles.length === 0) {
      setStatus('INVALID FILE TYPE');
      setLedState('error');
      log('ERROR: Only .txt and .csv files supported', 'error');
      return;
    }

    if (validFiles.length < files.length) {
      log(`WARNING: Skipped ${files.length - validFiles.length} invalid file(s)`, 'warning');
    }

    processFiles(validFiles);
  }
}

function processFile(file) {
  setStatus('LOADING...');
  setLedState('processing');
  log(`LOADING FILE: ${file.name}`);

  const reader = new FileReader();

  reader.onload = (e) => {
    const content = e.target.result;
    parseFileContent(content, file.name);
  };

  reader.onerror = () => {
    setStatus('READ ERROR');
    setLedState('error');
    log('ERROR: Could not read file', 'error');
  };

  reader.readAsText(file);
}

/**
 * Process multiple files and combine all tracks
 */
async function processFiles(files) {
  setStatus('LOADING...');
  setLedState('processing');
  log(`LOADING ${files.length} FILE(S)...`);

  parsedTracks = []; // Reset tracks
  let totalValidTracks = 0;
  let totalInvalidTracks = 0;
  const fileNames = [];

  try {
    // Read all files
    const fileContents = await Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      })
    );

    // Process each file
    for (const { name, content } of fileContents) {
      log(`PROCESSING: ${name}`);
      const result = parseFileContentMulti(content, name);
      totalValidTracks += result.validCount;
      totalInvalidTracks += result.invalidCount;
      fileNames.push(name);
    }

    // Update UI
    if (files.length === 1) {
      fileName.textContent = fileNames[0];
    } else {
      fileName.textContent = `${files.length} files loaded`;
    }
    trackCount.textContent = totalValidTracks.toString();

    if (totalValidTracks > 0) {
      setStatus(`${totalValidTracks} TRACKS READY`);
      setLedState('ready');
      importBtn.disabled = false;
      log(`=== TOTAL: ${totalValidTracks} TRACKS FROM ${files.length} FILE(S) ===`, 'success');
      if (totalInvalidTracks > 0) {
        log(`${totalInvalidTracks} LINES SKIPPED ACROSS ALL FILES`, 'warning');
      }
    } else {
      setStatus('NO VALID TRACKS');
      setLedState('error');
      importBtn.disabled = true;
      log('ERROR: No valid tracks found in any file', 'error');
    }

    updateProgressText(0, totalValidTracks);

  } catch (error) {
    setStatus('READ ERROR');
    setLedState('error');
    log(`ERROR: ${error.message}`, 'error');
  }
}

/**
 * Check if a string looks like valid PolyTrack data or a share code
 */
function isValidTrackData(data) {
  if (!data || data.length < 10) return false;

  // Accept multiple formats:
  // 1. Starts with "PolyTrack" (storage formats: PolyTrack1, PolyTrack24pdr, etc.)
  // 2. Starts with "v1n", "v3" (share code formats)

  if (data.startsWith('PolyTrack')) return true;
  if (data.startsWith('v3') && !data.startsWith('v2')) return true;
  if (data.startsWith('v1n')) return true;

  return false;
}

/**
 * Process track data - extract name and prepare for import
 * Returns { data: string, shareCode: string|null, name: string|null } or null if invalid
 */
function processTrackData(rawData) {
  if (!rawData || rawData.length < 10) return null;

  // Remove whitespace (game does this too)
  const cleanData = rawData.replace(/\s+/g, '');

  // Already in PolyTrack format - use as-is
  if (cleanData.startsWith('PolyTrack')) {
    return { data: cleanData, shareCode: null, name: null };
  }

  // v3 format share code
  if (cleanData.startsWith('v3') && !cleanData.startsWith('v2')) {
    const result = decodeV3(cleanData);
    if (result) {
      // Store the share code - we'll try to use game's import
      return { data: null, shareCode: cleanData, name: result.name };
    }
    // Even if name extraction failed, the share code might still be valid
    return { data: null, shareCode: cleanData, name: null };
  }

  // v1n format share code
  if (cleanData.startsWith('v1n')) {
    const result = decodeV1n(cleanData);
    if (result) {
      return { data: null, shareCode: cleanData, name: result.name };
    }
    return { data: null, shareCode: cleanData, name: null };
  }

  return null;
}

/**
 * Parse file content and return counts (for multi-file processing)
 */
function parseFileContentMulti(content, name) {
  const lines = content.split('\n').filter(line => line.trim());

  let validCount = 0;
  let invalidCount = 0;
  let shareCodeCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip comment lines
    if (line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // Try to parse as "Track Name | Track Data" format first
    const pipeIndex = line.indexOf('|');

    if (pipeIndex !== -1) {
      const trackName = line.substring(0, pipeIndex).trim();
      const rawTrackData = line.substring(pipeIndex + 1).trim();

      if (trackName && isValidTrackData(rawTrackData)) {
        const processed = processTrackData(rawTrackData);
        if (processed) {
          parsedTracks.push({
            name: trackName,
            data: processed.data,
            shareCode: processed.shareCode
          });
          validCount++;
          if (processed.shareCode) shareCodeCount++;
          log(`LINE ${i + 1}: "${trackName}" (pipe format)`, 'success');
          continue;
        }
      }
    }

    // No pipe format - check if the whole line is valid track data
    if (isValidTrackData(line)) {
      const processed = processTrackData(line);

      if (processed) {
        // Try to get name from extraction or generate one
        let trackName = processed.name;

        if (!trackName) {
          trackName = `Imported Track ${validCount + 1}`;
          log(`LINE ${i + 1}: Using generated name "${trackName}"`, 'warning');
        } else {
          log(`LINE ${i + 1}: "${trackName}" (extracted from share code)`, 'success');
        }

        parsedTracks.push({
          name: trackName,
          data: processed.data,
          shareCode: processed.shareCode
        });
        validCount++;
        if (processed.shareCode) shareCodeCount++;
      } else {
        invalidCount++;
        log(`LINE ${i + 1}: Failed to parse track data`, 'error');
      }
    } else {
      invalidCount++;
      log(`LINE ${i + 1}: Skipped - not recognized as track data`, 'warning');
    }
  }

  return { validCount, invalidCount, shareCodeCount };
}

/**
 * Parse file content (single file - legacy function)
 */
function parseFileContent(content, name) {
  parsedTracks = [];
  const result = parseFileContentMulti(content, name);
  const { validCount, invalidCount, shareCodeCount } = result;

  // Update UI
  fileName.textContent = name;
  trackCount.textContent = validCount.toString();

  if (validCount > 0) {
    setStatus(`${validCount} TRACKS READY`);
    setLedState('ready');
    importBtn.disabled = false;
    log(`PARSED ${validCount} TRACKS SUCCESSFULLY`, 'success');
    if (shareCodeCount > 0) {
      log(`FOUND ${shareCodeCount} SHARE CODES - Names extracted`, 'success');
    }
    if (invalidCount > 0) {
      log(`${invalidCount} LINES SKIPPED`, 'warning');
    }
  } else {
    setStatus('NO VALID TRACKS');
    setLedState('error');
    importBtn.disabled = true;
    log('ERROR: No valid tracks found in file', 'error');
    log('Supported formats:', 'warning');
    log('  - Share codes (v1n..., v3...)', 'warning');
    log('  - PolyTrack data (PolyTrack1..., PolyTrack24pdr...)', 'warning');
    log('  - Track Name | TrackData', 'warning');
  }

  updateProgressText(0, validCount);
}

// Mode Handling
function cycleMode() {
  const modes = ['skip', 'overwrite', 'rename'];
  const currentIndex = modes.indexOf(collisionMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  setMode(modes[nextIndex]);
}

function setMode(mode) {
  collisionMode = mode;
  modeKnob.dataset.mode = mode;
  updateModeLabel(mode);
  modeDescription.textContent = modeDescriptions[mode];
  log(`MODE SET: ${mode.toUpperCase()}`);
}

function updateModeLabel(activeMode) {
  document.querySelectorAll('.mode-label').forEach(label => {
    label.classList.toggle('active', label.dataset.mode === activeMode);
  });
}

// Legacy Mode
function toggleLegacyMode() {
  legacyMode = !legacyMode;
  legacyModeBtn.classList.toggle('active', legacyMode);
  legacyModeBtn.querySelector('.utility-text').textContent = legacyMode ? 'LEGACY: ON' : 'LEGACY: OFF';
  log(legacyMode
    ? 'LEGACY MODE ON - New formats will be converted to PolyTrack1'
    : 'LEGACY MODE OFF - Tracks stored in original format',
    legacyMode ? 'warning' : 'default'
  );
}

/**
 * Convert a newer PolyTrack storage format (e.g. PolyTrack24pdr) to PolyTrack1
 * for compatibility with older game versions.
 *
 * Heuristic: the version tag after 'PolyTrack' is all lowercase letters and digits
 * (e.g. '24pdr'). The encoded body starts at the first uppercase letter.
 * Replacing the version tag with '1' produces a PolyTrack1-prefixed string.
 *
 * Returns the converted string, or null if input is already PolyTrack1 / not convertible.
 */
function convertToPolyTrack1(data) {
  if (!data || !data.startsWith('PolyTrack')) return null;
  if (data.startsWith('PolyTrack1')) return null;

  const rest = data.substring(9); // everything after 'PolyTrack'
  // Body starts at the first uppercase letter; version tag is all lowercase+digits before it
  const bodyStart = rest.search(/[A-Z]/);
  if (bodyStart <= 0) return null;

  return 'PolyTrack1' + rest.substring(bodyStart);
}

// Import Logic
async function startImport() {
  if (isImporting || parsedTracks.length === 0) return;

  isImporting = true;
  importBtn.disabled = true;
  setStatus('IMPORTING...');
  setLedState('processing');
  log('STARTING IMPORT SEQUENCE...');

  // Get the active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab) {
    handleImportError('No active tab found');
    return;
  }

  // Check if we're on the right domain
  if (!tab.url.includes('kodub.com')) {
    handleImportError('Please navigate to PolyTrack first');
    log('Navigate to: https://www.kodub.com/apps/polytrack', 'warning');
    return;
  }

  // Apply legacy conversion if enabled
  let tracksToImport = parsedTracks;
  if (legacyMode) {
    let convertedCount = 0;
    tracksToImport = parsedTracks.map(track => {
      if (track.data && track.data.startsWith('PolyTrack') && !track.data.startsWith('PolyTrack1')) {
        const converted = convertToPolyTrack1(track.data);
        if (converted) {
          convertedCount++;
          return { ...track, data: converted };
        }
      }
      return track;
    });
    if (convertedCount > 0) {
      log(`LEGACY CONVERT: ${convertedCount} track(s) → PolyTrack1 format`, 'warning');
    }
  }

  // Send tracks to content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'importTracks',
      tracks: tracksToImport,
      mode: collisionMode
    });

    if (response && response.success) {
      handleImportSuccess(response);
    } else {
      handleImportError(response?.error || 'Unknown error');
    }
  } catch (error) {
    // Content script might not be loaded, try injecting it
    log('INJECTING CONTENT SCRIPT...', 'warning');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });

      // Wait a bit then retry
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'importTracks',
        tracks: tracksToImport,
        mode: collisionMode
      });

      if (response && response.success) {
        handleImportSuccess(response);
      } else {
        handleImportError(response?.error || 'Import failed');
      }
    } catch (injectError) {
      handleImportError('Could not inject into page. Try refreshing PolyTrack.');
    }
  }
}

function handleImportSuccess(response) {
  isImporting = false;
  importBtn.disabled = false;

  const { imported, skipped, renamed, overwritten, total, failedTracks } = response;

  setStatus('IMPORT COMPLETE!');
  setLedState('ready');
  updateMeterBars(100);
  updateProgressText(imported, total);

  document.querySelector('.vst-container').classList.add('success-flash');
  setTimeout(() => {
    document.querySelector('.vst-container').classList.remove('success-flash');
  }, 500);

  log('=== IMPORT COMPLETE ===', 'success');
  log(`IMPORTED: ${imported}`, 'success');
  if (skipped > 0) log(`SKIPPED: ${skipped}`, 'warning');
  if (renamed > 0) log(`RENAMED: ${renamed}`);
  if (overwritten > 0) log(`OVERWRITTEN: ${overwritten}`);

  // Download failed tracks log if there are any
  if (failedTracks && failedTracks.length > 0) {
    log(`FAILED: ${failedTracks.length}`, 'error');
    log('Downloading failed tracks log...', 'warning');
    downloadFailedTracksLog(failedTracks);
  }

  log('REFRESH PAGE TO SEE TRACKS', 'warning');
}

function handleImportError(error) {
  isImporting = false;
  importBtn.disabled = parsedTracks.length === 0;

  setStatus('IMPORT FAILED');
  setLedState('error');

  document.querySelector('.vst-container').classList.add('error-flash');
  setTimeout(() => {
    document.querySelector('.vst-container').classList.remove('error-flash');
  }, 500);

  log(`ERROR: ${error}`, 'error');
}

// UI Updates
function setStatus(text) {
  statusDisplay.querySelector('.led-text').textContent = text;
}

function setLedState(state) {
  ledReady.classList.remove('active');
  ledProcessing.classList.remove('active');
  ledError.classList.remove('active');

  switch (state) {
    case 'ready':
      ledReady.classList.add('active');
      break;
    case 'processing':
      ledProcessing.classList.add('active');
      break;
    case 'error':
      ledError.classList.add('active');
      break;
  }
}

function updateMeterBars(percentage) {
  const bars = document.querySelectorAll('.meter-bar');
  const activeBars = Math.round((percentage / 100) * bars.length);

  bars.forEach((bar, index) => {
    bar.classList.toggle('active', index < activeBars);
  });
}

function updateProgressText(current, total) {
  progressText.textContent = `${current} / ${total} TRACKS`;
}

function log(message, type = 'default') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = `> ${message}`;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Listen for progress updates from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'importProgress') {
    const { current, total, trackName, status } = message;
    const percentage = Math.round((current / total) * 100);
    updateMeterBars(percentage);
    updateProgressText(current, total);

    if (status === 'imported') {
      log(`IMPORTED: ${trackName}`, 'success');
    } else if (status === 'skipped') {
      log(`SKIPPED: ${trackName}`, 'warning');
    } else if (status === 'renamed') {
      log(`RENAMED: ${trackName}`);
    } else if (status === 'overwritten') {
      log(`OVERWRITTEN: ${trackName}`);
    } else if (status === 'error') {
      log(`FAILED: ${trackName}`, 'error');
    }
  }
});

/**
 * Download failed tracks log file
 */
function downloadFailedTracksLog(failedTracks) {
  let content = `# PolyTrack Failed Tracks Log - ${new Date().toLocaleString()}\n`;
  content += `# Total Failed: ${failedTracks.length}\n`;
  content += `# These tracks could not be imported due to decode/encode errors\n\n`;

  failedTracks.forEach((track, index) => {
    content += `## Track ${index + 1}: ${track.name}\n`;
    content += `Reason: ${track.reason}\n`;
    content += `Data: ${track.data}\n\n`;
  });

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `polytrack_failed_tracks_${timestamp}.txt`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  log(`Downloaded: ${filename}`, 'success');
}

/**
 * Export all tracks from PolyTrack
 */
async function exportAllTracks() {
  setStatus('EXPORTING...');
  setLedState('processing');
  log('EXPORTING ALL TRACKS...');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab) {
      log('ERROR: No active tab found', 'error');
      setStatus('EXPORT FAILED');
      setLedState('error');
      return;
    }

    if (!tab.url.includes('kodub.com')) {
      log('ERROR: Please navigate to PolyTrack first', 'error');
      setStatus('EXPORT FAILED');
      setLedState('error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'exportAllTracks'
    });

    if (response && response.success) {
      setStatus('EXPORT COMPLETE!');
      setLedState('ready');
      log(`EXPORTED ${response.count} TRACKS`, 'success');
      log(`File: ${response.filename}`, 'success');

      document.querySelector('.vst-container').classList.add('success-flash');
      setTimeout(() => {
        document.querySelector('.vst-container').classList.remove('success-flash');
      }, 500);
    } else {
      setStatus('EXPORT FAILED');
      setLedState('error');
      log(`ERROR: ${response?.error || 'Export failed'}`, 'error');
    }
  } catch (error) {
    setStatus('EXPORT FAILED');
    setLedState('error');
    log(`ERROR: ${error.message}`, 'error');
  }
}

/**
 * Delete all tracks with confirmation
 */
async function deleteAllTracksWithConfirm() {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This will DELETE ALL imported tracks from PolyTrack!\n\n' +
    'This action CANNOT be undone!\n\n' +
    'Are you sure you want to continue?'
  );

  if (!confirmed) {
    log('DELETE CANCELLED', 'warning');
    return;
  }

  setStatus('DELETING...');
  setLedState('processing');
  log('DELETING ALL TRACKS...');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab) {
      log('ERROR: No active tab found', 'error');
      setStatus('DELETE FAILED');
      setLedState('error');
      return;
    }

    if (!tab.url.includes('kodub.com')) {
      log('ERROR: Please navigate to PolyTrack first', 'error');
      setStatus('DELETE FAILED');
      setLedState('error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'deleteAllTracks'
    });

    if (response && response.success) {
      setStatus('DELETE COMPLETE!');
      setLedState('ready');
      log(`DELETED ${response.count} TRACKS`, 'success');
      log('REFRESH PAGE TO SEE CHANGES', 'warning');

      document.querySelector('.vst-container').classList.add('success-flash');
      setTimeout(() => {
        document.querySelector('.vst-container').classList.remove('success-flash');
      }, 500);
    } else {
      setStatus('DELETE FAILED');
      setLedState('error');
      log(`ERROR: ${response?.error || 'Delete failed'}`, 'error');
    }
  } catch (error) {
    setStatus('DELETE FAILED');
    setLedState('error');
    log(`ERROR: ${error.message}`, 'error');
  }
}
