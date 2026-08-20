"use strict";

/**
 * IPC layer: exposes main-process capabilities to the renderer and translates
 * failures into plain objects the renderer can display loudly.
 */

const path = require("path");
const { ipcMain, dialog, app, shell } = require("electron");
const { checkRequirements, installFirstMissingRequirement } = require("./requirements");
const { checkForUpdate, installUpdate } = require("./updater");
const { runConversionBatch, DropValidationError, ConversionError } = require("./converter");

/**
 * Serializes an error into a plain object safe to send over IPC.
 *
 * @param {Error} error
 * @returns {{name: string, message: string, output: string, offendingFiles: string[]}}
 */
function serializeError(error) {
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    output: error.output || "",
    offendingFiles: error.offendingFiles || [],
  };
}

/**
 * Registers every IPC handler used by the renderer.
 *
 * @param {Electron.BrowserWindow} mainWindow
 * @param {{info: Function, warn: Function, error: Function}} logger
 * @param {{hasConsent: Function, grantConsent: Function, clearConsent: Function}} consentStore
 */
function registerIpcHandlers(mainWindow, logger, consentStore) {
  ipcMain.handle("window:close", () => {
    mainWindow.close();
  });

  ipcMain.handle("requirements:check", async () => {
    return checkRequirements(logger);
  });

  ipcMain.handle("install-consent:get", () => {
    return consentStore.hasConsent();
  });

  ipcMain.handle("install-consent:grant", () => {
    consentStore.grantConsent();
  });

  ipcMain.handle("install-consent:clear", () => {
    consentStore.clearConsent();
  });

  ipcMain.handle("requirements:install", async () => {
    const statuses = await checkRequirements(logger);
    const result = await installFirstMissingRequirement(statuses, logger);
    if (result.ok) {
      logger.info("Relaunching the app so the new installation is picked up.");
      app.relaunch();
      app.exit(0);
    }
    return result;
  });

  ipcMain.handle("update:check", async () => {
    return checkForUpdate(logger);
  });

  ipcMain.handle("update:install", async () => {
    return installUpdate(logger);
  });

  ipcMain.handle("files:pick", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Markdown files",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Markdown and CSS", extensions: ["md", "css"] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("conversion:run", async (event, filePaths) => {
    try {
      const summary = await runConversionBatch(
        filePaths,
        {
          promptSavePath: (pdfName) => promptSavePath(mainWindow, pdfName),
          onProgress: (progress) => {
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send("conversion:progress", progress);
            }
          },
          openSavedFile: async (savedPath) => {
            const openError = await shell.openPath(savedPath);
            if (openError) {
              logger.warn(`Could not open saved PDF: ${openError}`);
            }
          },
        },
        logger
      );
      return { ok: true, ...summary };
    } catch (error) {
      if (error instanceof DropValidationError || error instanceof ConversionError) {
        logger.error(`${error.name}: ${error.message}`);
      } else {
        logger.error(`Unexpected conversion error: ${error.stack || error.message}`);
      }
      return { ok: false, error: serializeError(error) };
    }
  });
}

/**
 * Shows the OS save dialog for one converted PDF.
 *
 * @param {Electron.BrowserWindow} mainWindow
 * @param {string} pdfName Default file name of the PDF.
 * @returns {Promise<string|null>} Chosen destination, or null when cancelled.
 */
async function promptSavePath(mainWindow, pdfName) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Select location to save "${pdfName}"`,
    defaultPath: path.join(app.getPath("documents"), pdfName),
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  return result.canceled ? null : result.filePath;
}

module.exports = { registerIpcHandlers };
