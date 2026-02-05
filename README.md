# TURBO LOADER 9000 - PolyTrack Mass Import

A Chrome extension for mass importing tracks into [PolyTrack](https://www.kodub.com/apps/polytrack) from text files.

Featuring an absolutely unhinged retro VST-style GUI that looks like it was designed by a mad scientist in a synthesizer factory.

## Features

- **Mass Import**: Import hundreds of tracks at once from a text file
- **Collision Handling**: Choose to skip, overwrite, or rename duplicate tracks
- **Progress Tracking**: Real-time VU meter and console output
- **Retro VST GUI**: A beautifully chaotic interface inspired by classic audio plugins

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. **Generate the icons** (required):
   - Open `icons/generate-icons.html` in your browser
   - Click "Generate & Download Icons"
   - Save the downloaded files to the `icons/` folder as:
     - `icon16.png`
     - `icon32.png`
     - `icon48.png`
     - `icon128.png`
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the extension folder

## Usage

### File Format

Create a text file (`.txt`) where each line contains a track in this format:

```
Track Name | PolyTrack14...
```

**Example:**

```
My Cool Track | PolyTrack14AbCdEfGh...
Another Track | PolyTrack14XyZ123...
Epic Race Course | PolyTrack14QwErTy...
```

- The `|` character separates the track name from the track data
- Track data must start with `PolyTrack` (usually `PolyTrack14`)
- One track per line
- Empty lines are ignored

### Importing Tracks

1. Navigate to [PolyTrack](https://www.kodub.com/apps/polytrack) in your browser
2. Click the extension icon in your toolbar
3. Click "LOAD TRACKS" or drag & drop your `.txt` file
4. Select your collision mode:
   - **SKIP**: Don't import tracks that already exist
   - **OVER**: Overwrite existing tracks with the same name
   - **RENAME**: Add a suffix to duplicate track names (e.g., "My Track (1)")
5. Click "INJECT TRACKS"
6. **Refresh the page** to see your imported tracks

## Collision Modes

| Mode | Description |
|------|-------------|
| SKIP | If a track with the same name exists, skip importing that track |
| OVERWRITE | Replace existing tracks with the imported version |
| RENAME | Keep both tracks by adding a number suffix to the imported track |

## Technical Details

### Storage Format

PolyTrack stores tracks in localStorage with the following format:

- **Key**: `polytrack_v4_prod_track_[TRACK_NAME]`
- **Value**: JSON object containing:
  - `data`: The encoded track data (starts with `PolyTrack14...`)
  - `saveTime`: Unix timestamp of when the track was saved

### Security Notes

- The track data string is a proprietary encoded format
- Do not modify the track data strings - they will fail to load if altered
- This extension only reads from your file and writes to localStorage

## Support the Developer

If you find this extension useful, consider buying me a coffee!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sankdoy)

## License

MIT License - Feel free to modify and share!

## Credits

Created by **Sankdoy**

---

*TURBO LOADER 9000 - Because importing tracks one at a time is for peasants.*
