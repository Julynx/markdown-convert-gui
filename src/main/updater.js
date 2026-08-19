"use strict";

/**
 * Update check and self-update for the markdown-convert package.
 *
 * The installed version is read from `uv tool list`; the latest version is
 * read from the PyPI JSON API. A failed network request is reported as
 * "unavailable" so the caller can skip the update screen silently.
 */

const https = require("https");
const { runCommand, probeCommand, formatCommandOutput } = require("./process-runner");

const PYPI_METADATA_URL = "https://pypi.org/pypi/markdown-convert/json";
const UPDATE_CHECK_TIMEOUT_MS = 8000;

/**
 * Reads the installed markdown-convert version.
 *
 * @returns {Promise<string>}
 */
async function getInstalledVersion() {
  const output = await probeCommand("uv", ["tool", "list"]);
  const match = output.match(/^markdown-convert\s+v?([\w.\-+]+)/m);
  if (!match) {
    throw new Error("markdown-convert is not listed by `uv tool list`.");
  }
  return match[1];
}

/**
 * Fetches the latest markdown-convert version published on PyPI.
 *
 * @returns {Promise<string>}
 */
function getLatestVersion() {
  return new Promise((resolve, reject) => {
    const request = https.get(PYPI_METADATA_URL, { timeout: UPDATE_CHECK_TIMEOUT_MS }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`PyPI answered with status ${response.statusCode}.`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")).info.version);
        } catch (error) {
          reject(new Error(`Could not parse the PyPI response: ${error.message}`));
        }
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("The update check timed out."));
    });
    request.on("error", reject);
  });
}

/**
 * Compares two dotted version strings numerically.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Negative when a < b, zero when equal, positive when a > b.
 */
function compareVersions(a, b) {
  const partsA = a.split(".").map((part) => parseInt(part, 10) || 0);
  const partsB = b.split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (partsA[index] || 0) - (partsB[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/**
 * Checks whether an update of markdown-convert is available.
 *
 * @param {{info: Function, warn: Function}} logger
 * @returns {Promise<{status: "outdated"|"up-to-date"|"unavailable", installedVersion?: string, latestVersion?: string}>}
 */
async function checkForUpdate(logger) {
  try {
    const [installedVersion, latestVersion] = await Promise.all([
      getInstalledVersion(),
      getLatestVersion(),
    ]);
    logger.info(`markdown-convert versions: installed=${installedVersion}, latest=${latestVersion}`);
    if (compareVersions(installedVersion, latestVersion) < 0) {
      return { status: "outdated", installedVersion, latestVersion };
    }
    return { status: "up-to-date", installedVersion, latestVersion };
  } catch (error) {
    logger.warn(`Update check skipped: ${error.message}`);
    return { status: "unavailable" };
  }
}

/**
 * Upgrades markdown-convert to the latest version.
 * Uses a "@latest" marker to be able to update from a pinned version.
 * (eg. installed via "uv tool install markdown-convert==2.0.0")
 * 
 * @param {{info: Function, error: Function}} logger
 * @returns {Promise<{ok: boolean, output?: string}>}
 */
async function installUpdate(logger) {
  logger.info("Upgrading markdown-convert via `uv tool install markdown-convert@latest`.");
  const result = await runCommand("uv", ["tool", "install", "markdown-convert@latest"]);
  if (result.code !== 0) {
    const output = formatCommandOutput(result);
    logger.error(`markdown-convert upgrade failed.\n${output}`);
    return { ok: false, output };
  }
  logger.info("markdown-convert upgraded successfully.");
  return { ok: true };
}

module.exports = { checkForUpdate, installUpdate, compareVersions };
