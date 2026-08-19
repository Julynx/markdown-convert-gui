"use strict";

/**
 * Persistent record of the user's consent to install missing requirements.
 * Stored as a small JSON file in the user-data directory so that the install
 * chain keeps going automatically across the app reboots required to pick up
 * new PATH entries. The consent is cleared once every requirement is found.
 */

const fs = require("fs");
const path = require("path");

/**
 * @param {string} filePath Absolute path of the JSON consent file.
 * @param {{info: Function, warn: Function}} logger
 * @returns {{hasConsent: Function, grantConsent: Function, clearConsent: Function}}
 */
function createInstallConsentStore(filePath, logger) {
  /**
   * @returns {boolean} True when the user has consented to installing
   *   missing requirements. Missing or unreadable files count as no consent.
   */
  function hasConsent() {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return data.consentGiven === true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.warn(`Could not read the install consent file: ${error.message}`);
      }
      return false;
    }
  }

  /** Persists the user's consent to install missing requirements. */
  function grantConsent() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ consentGiven: true }), "utf8");
    logger.info("Install consent saved.");
  }

  /** Removes the stored consent, for example once nothing is left to install. */
  function clearConsent() {
    fs.rmSync(filePath, { force: true });
    logger.info("Install consent cleared.");
  }

  return { hasConsent, grantConsent, clearConsent };
}

module.exports = { createInstallConsentStore };
