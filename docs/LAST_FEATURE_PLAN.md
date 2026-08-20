# Feature Plan (from TODO.md)

> ALREADY IMPLEMENTED

This document outlines the implementation plan for the remaining features in `TODO.md`.

## Overview

The `TODO.md` file defines three features to implement:
1. **Add app icon** (application window, Windows executable, installer, and taskbar).
2. **Add Windows installer creation workflow (`electron-builder`)** (packaging scripts and NSIS installer configuration).
3. **Open in default PDF app after saving PDF file** (automatic launch of the saved PDF using the system's default viewer via Electron's `shell.openPath`).

---

## Detailed Feature Plans

### Feature 1: Add App Icon

#### Current State
- The app uses SVGs for dependency cards (`uv.svg`, `markdown-convert.svg`), but there is no dedicated application icon for the window, executable, taskbar, or installer.
- `src/main/main.js` initializes `BrowserWindow` without an `icon` option.

#### Proposed Changes
1. **Create icon assets:**
   - Design a clean, minimalist icon aligned with the app's visual style (ink `#23262d`, blue `#2b6cb0`, paper `#ffffff` palette, 2px border aesthetic representing Markdown -> PDF conversion).
   - Generate multi-resolution Windows icon file: `build/icon.ico` (containing 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256).
   - Generate PNG icon: `build/icon.png` / `src/renderer/assets/icons/app-icon.png` (512x512 / 256x256).
2. **Wire icon to Electron `BrowserWindow`:**
   - In `src/main/main.js`, add `icon: path.join(__dirname, "..", "renderer", "assets", "icons", "app-icon.png")` (or `.ico`) to `createMainWindow()`.

---

### Feature 2: Windows Installer Creation Workflow (`electron-builder`)

#### Current State
- `package.json` contains only `electron` and test scripts.
- `.project-actions.json` already defines VS Code / action shortcuts for `npm run dist` ("Build Installer (win)") and `npm run dist:linux` ("Build Linux AppImage").

#### Proposed Changes
1. **Add `electron-builder` dependency:**
   - Add `"electron-builder"` to `devDependencies` in `package.json`.
2. **Add npm scripts in `package.json`:**
   - `"dist"`: `"electron-builder --win"`
   - `"dist:win"`: `"electron-builder --win"`
   - `"dist:dir"` / `"pack"`: `"electron-builder --win --dir"` (fast unpacked build for testing packaging without running installer)
   - `"dist:linux"`: `"electron-builder --linux AppImage"`
3. **Configure `electron-builder` in `package.json` (under `"build"` key):**
   ```json
   "build": {
     "appId": "com.julynx.markdown-convert-gui",
     "productName": "markdown-convert-gui",
     "directories": {
       "output": "dist",
       "buildResources": "build"
     },
     "files": [
       "src/**/*",
       "package.json"
     ],
     "win": {
       "target": [
         {
           "target": "nsis",
           "arch": ["x64"]
         }
       ],
       "icon": "build/icon.ico"
     },
     "nsis": {
       "oneClick": false,
       "perMachine": false,
       "allowToChangeInstallationDirectory": true,
       "createDesktopShortcut": true,
       "createStartMenuShortcut": true,
       "shortcutName": "markdown-convert-gui"
     }
   }
   ```
4. **Ensure clean repository state:**
   - Confirm `.gitignore` ignores `dist/` and `dist-unpacked/` (already present).

---

### Feature 3: Open in Default PDF App After Saving PDF File

#### Current State
- In `src/main/converter.js`, `runConversionBatch` moves the converted temporary PDF to the user-selected `destinationPath`, logs `Saved: <path>`, and moves to the next file without opening it.
- In `src/main/ipc.js`, `conversion:run` invokes `runConversionBatch`.

#### Proposed Changes
1. **Enhance `converter.js` with dependency injection:**
   - Add `openSavedFile` callback to `runConversionBatch`'s callbacks argument: `runConversionBatch(filePaths, { promptSavePath, onProgress, openSavedFile }, logger)`.
   - After `moveFile(tempPdfPath, destinationPath)`, invoke `await openSavedFile(destinationPath)` if provided.
   - Wrap in a safe `try...catch` so that if the OS fails to open the file (e.g. no default viewer or locked handler), it logs a warning and does not crash or interrupt the rest of the conversion batch.
2. **Wire Electron `shell.openPath` in `src/main/ipc.js`:**
   - Import `shell` from `electron`.
   - Provide `openSavedFile: async (savedPath) => { const err = await shell.openPath(savedPath); if (err) { logger.warn(\`Could not open saved PDF: ${err}\`); } }`.
3. **Add unit tests:**
   - Create `tests/converter.test.js` to test `runConversionBatch` behavior:
     - Verifies `openSavedFile` is called when destination is selected.
     - Verifies `openSavedFile` is *not* called when user skips/cancels the save prompt.
     - Verifies error in `openSavedFile` is handled gracefully without failing the batch.

---

## Verification Plan

1. **Automated Unit Tests:**
   - Run `npm test` to ensure existing and new tests (`tests/converter.test.js`) pass.
2. **Runtime Verification:**
   - Start app with `npm start`.
   - Convert a Markdown file, pick a save destination, and confirm the generated PDF automatically opens in Windows' default PDF viewer.
3. **Build & Packaging Verification:**
   - Run `npm run pack` (unpacked directory) and verify the executable runs with the correct icon.
   - Run `npm run dist` and verify that the NSIS setup executable (`markdown-convert-gui Setup <version>.exe`) is generated in `dist/`.
4. **Update `TODO.md`:**
   - Mark completed items or update accordingly.
