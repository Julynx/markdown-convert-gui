/**
 * Main screen: drag-and-drop target plus the Explore button. Hands validated
 * file sets to the conversion flow and shows progress while converting.
 */

import { createScreenManager } from "./screen-manager.js";

/**
 * @param {ReturnType<typeof createScreenManager>} screenManager
 * @param {{show: Function}} errorScreen
 */
export function createMainScreen(screenManager, errorScreen) {
  const exploreButton = document.getElementById("explore-button");
  const conversionStatus = document.getElementById("conversion-status");

  let conversionRunning = false;

  /** Shows the main screen. */
  function show() {
    screenManager.show("screen-main");
  }

  /**
   * Runs the conversion batch for the given files and reports the outcome.
   *
   * @param {string[]} filePaths
   */
  async function startConversion(filePaths) {
    if (conversionRunning || filePaths.length === 0) {
      return;
    }
    conversionRunning = true;

    const unsubscribe = window.markdownConvertGui.onConversionProgress((progress) => {
      if (progress.stage === "converting") {
        conversionStatus.textContent =
          `Converting ${progress.fileName} (${progress.current} of ${progress.total})...`;
      } else {
        conversionStatus.textContent =
          `Choose where to save ${progress.fileName} (${progress.current} of ${progress.total})...`;
      }
    });

    screenManager.show("screen-converting");

    try {
      const result = await window.markdownConvertGui.runConversion(filePaths);
      if (result.ok) {
        show();
      } else {
        errorScreen.show(describeError(result.error));
      }
    } catch (error) {
      errorScreen.show({
        title: "Something went wrong.",
        message: error.message || String(error),
        output: error.stack || "",
      });
    } finally {
      unsubscribe();
      conversionRunning = false;
    }
  }

  /**
   * Maps an error object from the main process to error-screen content.
   *
   * @param {{name: string, message: string, output: string, offendingFiles: string[]}} error
   */
  function describeError(error) {
    if (error.name === "DropValidationError") {
      return {
        title: "These files can't be converted.",
        message: error.message,
        offendingFiles: error.offendingFiles,
      };
    }
    if (error.name === "ConversionError") {
      return {
        title: "Conversion failed.",
        message: error.message,
        output: error.output,
      };
    }
    return { title: "Something went wrong.", message: error.message, output: error.output };
  }

  /** Opens the file picker and converts the chosen files. */
  async function explore() {
    const filePaths = await window.markdownConvertGui.pickFiles();
    if (filePaths.length > 0) {
      await startConversion(filePaths);
    }
  }

  exploreButton.addEventListener("click", () => {
    explore().catch((error) => {
      errorScreen.show({
        title: "Something went wrong.",
        message: error.message || String(error),
        output: error.stack || "",
      });
    });
  });

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!conversionRunning) {
      document.body.classList.add("drop-target");
    }
  });

  window.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) {
      document.body.classList.remove("drop-target");
    }
  });

  window.addEventListener("drop", (event) => {
    event.preventDefault();
    document.body.classList.remove("drop-target");
    if (conversionRunning) {
      return;
    }
    const droppedFiles = Array.from(event.dataTransfer.files);
    const filePaths = droppedFiles.map((file) => window.markdownConvertGui.getPathForFile(file));
    startConversion(filePaths);
  });

  return { show };
}
