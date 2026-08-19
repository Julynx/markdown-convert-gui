/**
 * Renderer bootstrap: wires the titlebar, runs the startup sequence
 * (requirements check, then markdown-convert update check, then main screen)
 * and routes between screens.
 */

import { createScreenManager } from "./screen-manager.js";
import { createRequirementsScreen } from "./requirements-screen.js";
import { createUpdateScreen } from "./update-screen.js";
import { createMainScreen } from "./main-screen.js";
import { createErrorScreen } from "./error-screen.js";

const api = window.markdownConvertGui;

const screenManager = createScreenManager();
const errorScreen = createErrorScreen(screenManager);
const requirementsScreen = createRequirementsScreen(screenManager);
const updateScreen = createUpdateScreen(screenManager);
const mainScreen = createMainScreen(screenManager, errorScreen);

document.getElementById("close-button").addEventListener("click", () => {
  api.closeWindow();
});

errorScreen.backButton.addEventListener("click", () => {
  mainScreen.show();
});

/** Runs the startup sequence: requirements, then update check, then main. */
async function bootstrap() {
  screenManager.show("screen-loading");

  const statuses = await api.checkRequirements();
  const missingCount = statuses.filter((status) => !status.found).length;
  if (missingCount > 0) {
    requirementsScreen.show(statuses);
    return;
  }

  const updateStatus = await api.checkForUpdate();
  if (updateStatus.status === "outdated") {
    await updateScreen.run();
  }

  mainScreen.show();
}

/**
 * Development helper: `?screen=<id>` renders a single screen directly,
 * bypassing the startup sequence, to preview screens without side effects.
 *
 * @returns {boolean} True when a preview screen was shown.
 */
function showPreviewScreen() {
  const previewId = new URLSearchParams(window.location.search).get("screen");
  if (!previewId) {
    return false;
  }
  if (previewId === "screen-requirements") {
    api.checkRequirements().then((statuses) => requirementsScreen.show(statuses));
    return true;
  }
  screenManager.show(previewId);
  return true;
}

if (!showPreviewScreen()) {
  bootstrap().catch((error) => {
    errorScreen.show({
      title: "Something went wrong.",
      message: error.message || String(error),
      output: error.stack || "",
    });
  });
}
