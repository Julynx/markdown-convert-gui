"use strict";

/**
 * Preload bridge: the only surface the renderer can reach. Exposes typed
 * wrappers around the IPC channels and the file-path helper needed for
 * drag and drop (File objects no longer carry their path in Electron).
 */

const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("markdownConvertGui", {
  /** Closes the application window. */
  closeWindow: () => ipcRenderer.invoke("window:close"),

  /** @returns {Promise<Array<object>>} Status of every requirement. */
  checkRequirements: () => ipcRenderer.invoke("requirements:check"),

  /** Installs the first missing requirement, then relaunches the app. */
  installRequirements: () => ipcRenderer.invoke("requirements:install"),

  /** @returns {Promise<{status: string}>} Update availability. */
  checkForUpdate: () => ipcRenderer.invoke("update:check"),

  /** Upgrades markdown-convert to the latest version. */
  installUpdate: () => ipcRenderer.invoke("update:install"),

  /** @returns {Promise<string[]>} Paths chosen in the open dialog. */
  pickFiles: () => ipcRenderer.invoke("files:pick"),

  /**
   * Runs a conversion batch.
   *
   * @param {string[]} filePaths Markdown and CSS files to convert.
   */
  runConversion: (filePaths) => ipcRenderer.invoke("conversion:run", filePaths),

  /**
   * Subscribes to conversion progress events.
   *
   * @param {Function} callback Receives the progress object.
   * @returns {Function} Unsubscribe function.
   */
  onConversionProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("conversion:progress", listener);
    return () => ipcRenderer.removeListener("conversion:progress", listener);
  },

  /**
   * Resolves the absolute path of a dropped File object.
   *
   * @param {File} file File object from a drop event.
   * @returns {string} Absolute path on disk.
   */
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
