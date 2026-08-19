/**
 * Generic error screen: shows a title, an explanation, optionally the names
 * of offending files and captured command output. A single Back button
 * returns to the main screen.
 */

import { createScreenManager } from "./screen-manager.js";

/**
 * @param {ReturnType<typeof createScreenManager>} screenManager
 * @param {object} elements
 */
export function createErrorScreen(screenManager) {
  const title = document.getElementById("error-title");
  const message = document.getElementById("error-message");
  const fileList = document.getElementById("error-files");
  const output = document.getElementById("error-output");
  const backButton = document.getElementById("error-back-button");

  /**
   * @param {{title: string, message: string, offendingFiles?: string[], output?: string}} details
   */
  function show(details) {
    title.textContent = details.title;
    message.textContent = details.message;

    fileList.replaceChildren();
    if (details.offendingFiles && details.offendingFiles.length > 0) {
      for (const fileName of details.offendingFiles) {
        const item = document.createElement("li");
        item.textContent = fileName;
        fileList.appendChild(item);
      }
      fileList.hidden = false;
    } else {
      fileList.hidden = true;
    }

    if (details.output) {
      output.textContent = details.output;
      output.hidden = false;
    } else {
      output.hidden = true;
    }

    screenManager.show("screen-error");
  }

  return { show, backButton };
}
