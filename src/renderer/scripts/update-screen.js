/**
 * Update screen: shown while markdown-convert upgrades itself. Not
 * interactive; on failure it shows the captured output with a retry option.
 */

import { createScreenManager } from "./screen-manager.js";

/**
 * @param {ReturnType<typeof createScreenManager>} screenManager
 */
export function createUpdateScreen(screenManager) {
  const updateError = document.getElementById("update-error");
  const updateErrorOutput = document.getElementById("update-error-output");
  const retryButton = document.getElementById("update-retry-button");
  const continueButton = document.getElementById("update-continue-button");

  /**
   * Shows the screen and runs the update. Resolves when the update succeeded
   * or when the user chooses to continue without updating.
   *
   * @returns {Promise<void>}
   */
  function run() {
    screenManager.show("screen-update");
    updateError.hidden = true;
    return attemptUpdate();
  }

  /** @returns {Promise<void>} */
  async function attemptUpdate() {
    try {
      const result = await window.markdownConvertGui.installUpdate();
      if (result.ok) {
        return;
      }
      await showFailure(result.output || "The updater returned no output.");
    } catch (error) {
      await showFailure(error.stack || String(error));
    }
  }

  /**
   * Shows the failure panel and waits for the user's choice.
   *
   * @param {string} output Captured updater output.
   * @returns {Promise<void>}
   */
  function showFailure(output) {
    updateErrorOutput.textContent = output;
    updateError.hidden = false;

    return new Promise((resolve) => {
      const onRetry = () => {
        cleanup();
        updateError.hidden = true;
        resolve(attemptUpdate());
      };
      const onContinue = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        retryButton.removeEventListener("click", onRetry);
        continueButton.removeEventListener("click", onContinue);
      };
      retryButton.addEventListener("click", onRetry);
      continueButton.addEventListener("click", onContinue);
    });
  }

  return { run };
}
