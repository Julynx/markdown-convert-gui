"use strict";

/**
 * Minimal promise wrapper around child_process.spawn that captures stdout and
 * stderr so failures can surface the full command output to the user.
 */

const { spawn } = require("child_process");

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Runs a command and resolves with its exit code and captured output.
 * Never rejects on non-zero exit codes; rejects only on spawn failures.
 *
 * @param {string} command Executable name or path.
 * @param {string[]} args Arguments passed to the executable.
 * @param {object} [options]
 * @param {string} [options.cwd] Working directory for the command.
 * @param {number} [options.timeoutMs] Kill the process after this delay.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runCommand(command, args = [], options = {}) {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      shell: false,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs} ms: ${command} ${args.join(" ")}`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

/**
 * Runs a command expected to succeed quickly (version probes and similar).
 *
 * @param {string} command Executable name or path.
 * @param {string[]} args Arguments passed to the executable.
 * @returns {Promise<string>} Combined stdout and stderr.
 */
async function probeCommand(command, args = []) {
  const result = await runCommand(command, args, { timeoutMs: 30 * 1000 });
  if (result.code !== 0) {
    throw new Error(`Probe failed (${command}): ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return `${result.stdout}\n${result.stderr}`.trim();
}

/**
 * Formats captured command output for display to the user.
 *
 * @param {{code: number, stdout: string, stderr: string}} result
 * @returns {string}
 */
function formatCommandOutput(result) {
  const sections = [`Exit code: ${result.code}`];
  if (result.stdout.trim()) {
    sections.push(`Output:\n${result.stdout.trim()}`);
  }
  if (result.stderr.trim()) {
    sections.push(`Errors:\n${result.stderr.trim()}`);
  }
  return sections.join("\n\n");
}

module.exports = { runCommand, probeCommand, formatCommandOutput };
