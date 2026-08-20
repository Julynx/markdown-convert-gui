"use strict";

/**
 * Generates PNG and multi-resolution ICO icon files from the source SVG asset
 * using Electron's offscreen rendering and nativeImage resizer.
 */

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow } = require("electron");

app.disableHardwareAcceleration();

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * Creates an ICO format binary buffer containing the supplied PNG frames.
 *
 * @param {Array<{width: number, height: number, buffer: Buffer}>} pngFrames
 * @returns {Buffer}
 */
function createIcoFromPngs(pngFrames) {
  const frameCount = pngFrames.length;
  const headerSize = 6 + frameCount * 16;
  let currentOffset = headerSize;
  const directoryEntries = [];

  for (const frame of pngFrames) {
    const widthByte = frame.width >= 256 ? 0 : frame.width;
    const heightByte = frame.height >= 256 ? 0 : frame.height;
    const imageSize = frame.buffer.length;
    const imageOffset = currentOffset;
    currentOffset += imageSize;

    const entry = Buffer.alloc(16);
    entry.writeUInt8(widthByte, 0);
    entry.writeUInt8(heightByte, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(imageSize, 8);
    entry.writeUInt32LE(imageOffset, 12);
    directoryEntries.push(entry);
  }

  const fileHeader = Buffer.alloc(6);
  fileHeader.writeUInt16LE(0, 0);
  fileHeader.writeUInt16LE(1, 2);
  fileHeader.writeUInt16LE(frameCount, 4);

  return Buffer.concat([fileHeader, ...directoryEntries, ...pngFrames.map((frame) => frame.buffer)]);
}

app.whenReady().then(async () => {
  const rootDir = path.resolve(__dirname, "..");
  const buildDir = path.join(rootDir, "build");
  const rendererIconsDir = path.join(rootDir, "src", "renderer", "assets", "icons");
  const svgPath = path.join(rendererIconsDir, "app-icon.svg");

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const renderWindow = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgContent = fs.readFileSync(svgPath, "utf8");
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 512px;
      height: 512px;
      overflow: hidden;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: 512px;
      height: 512px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;

  await renderWindow.loadURL(dataUri);

  const capturedMasterImage = await renderWindow.webContents.capturePage({
    x: 0,
    y: 0,
    width: 512,
    height: 512,
  });

  const masterPngBuffer = capturedMasterImage.toPNG();
  fs.writeFileSync(path.join(buildDir, "icon.png"), masterPngBuffer);

  const rendererIconImage = capturedMasterImage.resize({ width: 256, height: 256, quality: "best" });
  fs.writeFileSync(path.join(rendererIconsDir, "app-icon.png"), rendererIconImage.toPNG());

  const iconFrames = [];
  for (const size of ICON_SIZES) {
    const resizedImage = capturedMasterImage.resize({
      width: size,
      height: size,
      quality: "best",
    });
    iconFrames.push({
      width: size,
      height: size,
      buffer: resizedImage.toPNG(),
    });
  }

  const icoBuffer = createIcoFromPngs(iconFrames);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);

  renderWindow.destroy();
  app.quit();
});
