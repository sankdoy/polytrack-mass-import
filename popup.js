/**
 * TURBO LOADER 9000 - PolyTrack Mass Import Extension
 * popup.js - Main popup logic
 */

// State
let parsedTracks = [];
let collisionMode = 'skip'; // skip, overwrite, rename
let isImporting = false;

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
}

// File Handling
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
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

  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setStatus('INVALID FILE TYPE');
      setLedState('error');
      log('ERROR: Only .txt and .csv files supported', 'error');
    }
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

function parseFileContent(content, name) {
  parsedTracks = [];
  const lines = content.split('\n').filter(line => line.trim());

  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try to parse as "Track Name | Track Data" format
    const pipeIndex = line.indexOf('|');

    if (pipeIndex !== -1) {
      const trackName = line.substring(0, pipeIndex).trim();
      const trackData = line.substring(pipeIndex + 1).trim();

      if (trackName && trackData && trackData.startsWith('PolyTrack')) {
        parsedTracks.push({
          name: trackName,
          data: trackData
        });
        validCount++;
      } else {
        invalidCount++;
        log(`LINE ${i + 1}: Invalid format - missing name or invalid data`, 'warning');
      }
    } else {
      // Maybe it's just track data without a name?
      // Check if the line starts with PolyTrack
      if (line.startsWith('PolyTrack')) {
        // Generate a name
        const trackName = `Imported Track ${validCount + 1}`;
        parsedTracks.push({
          name: trackName,
          data: line
        });
        validCount++;
        log(`LINE ${i + 1}: No name found, using "${trackName}"`, 'warning');
      } else {
        invalidCount++;
        log(`LINE ${i + 1}: Invalid format - no pipe separator found`, 'warning');
      }
    }
  }

  // Update UI
  fileName.textContent = name;
  trackCount.textContent = validCount.toString();

  if (validCount > 0) {
    setStatus(`${validCount} TRACKS READY`);
    setLedState('ready');
    importBtn.disabled = false;
    log(`PARSED ${validCount} TRACKS SUCCESSFULLY`, 'success');
    if (invalidCount > 0) {
      log(`${invalidCount} LINES SKIPPED (INVALID FORMAT)`, 'warning');
    }
  } else {
    setStatus('NO VALID TRACKS');
    setLedState('error');
    importBtn.disabled = true;
    log('ERROR: No valid tracks found in file', 'error');
    log('FORMAT: Track Name | PolyTrack14...', 'warning');
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

  // Send tracks to content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'importTracks',
      tracks: parsedTracks,
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
        tracks: parsedTracks,
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

  const { imported, skipped, renamed, overwritten, total } = response;

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
    }
  }
});
