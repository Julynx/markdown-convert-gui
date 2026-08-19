"use strict";

/**
 * Unit tests for the persistent install-consent store.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createInstallConsentStore } = require("../src/main/install-consent");

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

/** @returns {{filePath: string, cleanup: Function}} A throwaway consent file path. */
function tempConsentPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "install-consent-test-"));
  return {
    filePath: path.join(directory, "install-consent.json"),
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test("a missing consent file counts as no consent", () => {
  const { filePath, cleanup } = tempConsentPath();
  try {
    const store = createInstallConsentStore(filePath, silentLogger);
    assert.equal(store.hasConsent(), false);
  } finally {
    cleanup();
  }
});

test("granted consent persists across store instances", () => {
  const { filePath, cleanup } = tempConsentPath();
  try {
    createInstallConsentStore(filePath, silentLogger).grantConsent();
    const reopenedStore = createInstallConsentStore(filePath, silentLogger);
    assert.equal(reopenedStore.hasConsent(), true);
  } finally {
    cleanup();
  }
});

test("clearing the consent removes it", () => {
  const { filePath, cleanup } = tempConsentPath();
  try {
    const store = createInstallConsentStore(filePath, silentLogger);
    store.grantConsent();
    store.clearConsent();
    assert.equal(store.hasConsent(), false);
  } finally {
    cleanup();
  }
});

test("clearing a consent that was never granted does not fail", () => {
  const { filePath, cleanup } = tempConsentPath();
  try {
    const store = createInstallConsentStore(filePath, silentLogger);
    store.clearConsent();
    assert.equal(store.hasConsent(), false);
  } finally {
    cleanup();
  }
});

test("a corrupt consent file counts as no consent", () => {
  const { filePath, cleanup } = tempConsentPath();
  try {
    fs.writeFileSync(filePath, "not json", "utf8");
    const store = createInstallConsentStore(filePath, silentLogger);
    assert.equal(store.hasConsent(), false);
  } finally {
    cleanup();
  }
});
