/**
 * Requirements screen: renders one card per dependency and installs the first
 * missing one when the user clicks "Install requirements". On success the main
 * process relaunches the app, so a resolved promise means the install failed.
 */

import { createScreenManager } from "./screen-manager.js";

/**
 * @param {ReturnType<typeof createScreenManager>} screenManager
 */
export function createRequirementsScreen(screenManager) {
  const cardsContainer = document.getElementById("requirement-cards");
  const installButton = document.getElementById("install-button");
  const installProgress = document.getElementById("install-progress");
  const installProgressText = document.getElementById("install-progress-text");
  const installError = document.getElementById("install-error");
  const installErrorOutput = document.getElementById("install-error-output");

  let statuses = [];

  /** Renders one card per requirement, green when found, red when missing. */
  function renderCards() {
    cardsContainer.replaceChildren();
    for (const status of statuses) {
      const card = document.createElement("div");
      card.className = `requirement-card ${status.found ? "found" : "missing"}`;

      const icon = document.createElement("img");
      icon.className = "card-icon";
      icon.src = status.icon;
      icon.alt = "";

      const text = document.createElement("div");
      text.className = "card-text";
      const name = document.createElement("span");
      name.className = "card-name";
      name.textContent = status.name;
      const description = document.createElement("span");
      description.className = "card-description";
      description.textContent = status.description;
      text.append(name, description);

      const statusLabel = document.createElement("span");
      statusLabel.className = "card-status";
      statusLabel.textContent = status.found ? "Installed" : "Not found";

      card.append(icon, text, statusLabel);
      cardsContainer.appendChild(card);
    }
  }

  /** Shows the screen with the given requirement statuses. */
  function show(requirementStatuses) {
    statuses = requirementStatuses;
    renderCards();
    installButton.disabled = false;
    installProgress.hidden = true;
    installError.hidden = true;
    screenManager.show("screen-requirements");
  }

  /** Installs the first missing requirement; the app relaunches on success. */
  async function install() {
    const firstMissing = statuses.find((status) => !status.found);
    installButton.disabled = true;
    installError.hidden = true;
    installProgress.hidden = false;
    installProgressText.textContent = firstMissing
      ? `Installing ${firstMissing.name}. This can take a few minutes...`
      : "Installing...";

    const result = await window.markdownConvertGui.installRequirements();

    installProgress.hidden = true;
    installButton.disabled = false;
    if (!result.ok) {
      installErrorOutput.textContent = result.output || "The installer returned no output.";
      installError.hidden = false;
    }
  }

  installButton.addEventListener("click", () => {
    install().catch((error) => {
      installProgress.hidden = true;
      installButton.disabled = false;
      installErrorOutput.textContent = error.stack || String(error);
      installError.hidden = false;
    });
  });

  return { show };
}
