"use strict";

/**
 * Entry point of markdown-convert-gui. Creates the frameless main window,
 * refreshes the PATH from the registry and loads the renderer, which then
 * drives the requirements check, update check and conversion flow.
 */

const path = require("path");
const { app, BrowserWindow } = require("electron");
const { createLogger } = require("./logger");
const { refreshWindowsPath } = require("./environment");
const { createInstallConsentStore } = require("./install-consent");
const { registerIpcHandlers } = require("./ipc");

const WINDOW_WIDTH = 780;
const WINDOW_HEIGHT = 600;

/** Creates the single frameless application window. */
function createMainWindow() {
  const iconPath = path.join(__dirname, "..", "renderer", "assets", "icons", "app-icon.png");

  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    title: "markdown-convert-gui",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenu(null);

  const previewArg = process.argv.find((arg) => arg.startsWith("--preview-screen="));
  const loadOptions = previewArg ? { search: `screen=${previewArg.split("=")[1]}` } : undefined;
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"), loadOptions);
  return mainWindow;
}

app.whenReady().then(async () => {
  const logger = createLogger(path.join(app.getPath("userData"), "logs", "app.log"));
  logger.info(`markdown-convert-gui ${app.getVersion()} starting.`);

  await refreshWindowsPath(logger);

  const consentStore = createInstallConsentStore(
    path.join(app.getPath("userData"), "install-consent.json"),
    logger
  );

  const mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow, logger, consentStore);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
