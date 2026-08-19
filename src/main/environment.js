"use strict";

/**
 * Refreshes process.env.PATH from the Windows registry.
 *
 * GUI applications inherit the PATH captured at logon time, so tools installed
 * after logon (Python, uv tools, etc.) are invisible until the next logon.
 * Reading the Machine and User PATH values directly from the registry makes
 * newly installed tools discoverable as soon as the app restarts, which is
 * what makes the install-then-relaunch flow work.
 */

const { runCommand } = require("./process-runner");

const POWERSHELL_PATH_QUERY = [
  "$machine = [Environment]::GetEnvironmentVariable('Path','Machine')",
  "$user = [Environment]::GetEnvironmentVariable('Path','User')",
  "ConvertTo-Json -Compress @($machine, $user)",
].join("; ");

/**
 * Reads the Machine and User PATH values from the registry.
 *
 * @returns {Promise<{machinePath: string, userPath: string}>}
 */
async function readRegistryPathValues() {
  const result = await runCommand(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_PATH_QUERY],
    { timeoutMs: 30 * 1000 }
  );
  if (result.code !== 0) {
    throw new Error(`Registry PATH query failed: ${result.stderr.trim()}`);
  }
  const [machinePath, userPath] = JSON.parse(result.stdout.trim());
  return { machinePath: machinePath || "", userPath: userPath || "" };
}

/**
 * Merges PATH entries, preserving order and removing duplicates.
 *
 * @param {string[]} pathValues PATH strings in priority order.
 * @returns {string}
 */
function mergePathValues(pathValues) {
  const seen = new Set();
  const entries = [];
  for (const value of pathValues) {
    for (const entry of value.split(";")) {
      const trimmed = entry.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        entries.push(trimmed);
      }
    }
  }
  return entries.join(";");
}

/**
 * Replaces process.env.PATH with the current registry PATH (Machine + User),
 * falling back to the inherited PATH for entries not yet in the registry.
 *
 * @param {{info: Function, warn: Function}} logger
 * @returns {Promise<void>}
 */
async function refreshWindowsPath(logger) {
  try {
    const { machinePath, userPath } = await readRegistryPathValues();
    const refreshedPath = mergePathValues([userPath, machinePath, process.env.PATH || ""]);
    if (refreshedPath) {
      process.env.PATH = refreshedPath;
      logger.info("PATH refreshed from the Windows registry.");
    }
  } catch (error) {
    logger.warn(`Could not refresh PATH from the registry: ${error.message}`);
  }
}

module.exports = { refreshWindowsPath, mergePathValues };
