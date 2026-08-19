"use strict";

/**
 * File-backed logger. Every entry is timestamped and appended to a log file
 * inside the OS user-data directory, and mirrored to the console.
 */

const fs = require("fs");
const path = require("path");

/**
 * @param {string} logFilePath Absolute path of the log file.
 * @returns {{info: Function, warn: Function, error: Function, logFilePath: string}}
 */
function createLogger(logFilePath) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

  function write(level, message) {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, line, "utf8");
    const consoleTarget = level === "ERROR" ? console.error : console.log;
    consoleTarget(`[${level}] ${message}`);
  }

  return {
    logFilePath,
    info: (message) => write("INFO", message),
    warn: (message) => write("WARN", message),
    error: (message) => write("ERROR", message),
  };
}

module.exports = { createLogger };
