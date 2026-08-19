"use strict";

/**
 * Requirement definitions, detection probes and install commands for the
 * dependencies of markdown-convert-gui: UV (which manages Python versions
 * itself, so no system Python is needed) and the markdown-convert package.
 */

const { runCommand, probeCommand, formatCommandOutput } = require("./process-runner");

const REQUIREMENTS = [
  {
    id: "uv",
    name: "uv",
    description: "Fast Python package manager that runs markdown-convert.",
    icon: "assets/icons/uv.svg",
    installSteps: [
      {
        label: "Install uv via winget",
        command: "winget",
        args: [
          "install",
          "--id",
          "astral-sh.uv",
          "-e",
          "--accept-package-agreements",
          "--accept-source-agreements",
        ],
        successCodes: [0, -1978335189],
      },
    ],
  },
  {
    id: "markdown-convert",
    name: "markdown-convert package",
    description: "The Markdown to PDF converter itself.",
    icon: "assets/icons/markdown-convert.svg",
    installSteps: [
      {
        label: "Install the markdown-convert tool",
        command: "uv",
        args: ["tool", "install", "markdown-convert"],
        successCodes: [0],
      },
      {
        label: "Ensure ~/.local/bin is on PATH",
        command: "uv",
        args: ["tool", "update-shell"],
        successCodes: [0],
      },
    ],
  },
];

/**
 * Probes a requirement and returns its display name, icon and status.
 *
 * @param {object} requirement Entry of REQUIREMENTS.
 * @param {{info: Function}} logger
 * @returns {Promise<{id: string, name: string, description: string, icon: string, found: boolean, version: string}>}
 */
async function probeRequirement(requirement, logger) {
  try {
    const version = await REQUIREMENT_PROBES[requirement.id]();
    logger.info(`Requirement found: ${requirement.name} (${version})`);
    return {
      id: requirement.id,
      name: requirement.name,
      description: requirement.description,
      icon: requirement.icon,
      found: true,
      version,
    };
  } catch (error) {
    logger.info(`Requirement missing: ${requirement.name} (${error.message})`);
    return {
      id: requirement.id,
      name: requirement.name,
      description: requirement.description,
      icon: requirement.icon,
      found: false,
      version: "",
    };
  }
}

const REQUIREMENT_PROBES = {
  /** @returns {Promise<string>} The installed uv version. */
  async uv() {
    const output = await probeCommand("uv", ["--version"]);
    return output.replace(/^uv\s+/i, "").trim();
  },

  /** @returns {Promise<string>} The installed markdown-convert version. */
  async "markdown-convert"() {
    const output = await probeCommand("uv", ["tool", "list"]);
    const match = output.match(/^markdown-convert\s+v?([\w.\-+]+)/m);
    if (!match) {
      throw new Error("markdown-convert is not listed by `uv tool list`.");
    }
    return match[1];
  },
};

/**
 * Checks every requirement in order.
 *
 * @param {{info: Function}} logger
 * @returns {Promise<Array<object>>} One status entry per requirement.
 */
async function checkRequirements(logger) {
  const statuses = [];
  for (const requirement of REQUIREMENTS) {
    statuses.push(await probeRequirement(requirement, logger));
  }
  return statuses;
}

/**
 * Installs the first requirement that was not found, running each of its
 * install steps in order and capturing all output for error reporting.
 *
 * @param {Array<{id: string, found: boolean}>} statuses Result of checkRequirements.
 * @param {{info: Function, error: Function}} logger
 * @returns {Promise<{ok: boolean, installedId?: string, failedStep?: string, output?: string}>}
 */
async function installFirstMissingRequirement(statuses, logger) {
  const firstMissing = statuses.find((status) => !status.found);
  if (!firstMissing) {
    return { ok: true };
  }

  const requirement = REQUIREMENTS.find((entry) => entry.id === firstMissing.id);
  logger.info(`Installing requirement: ${requirement.name}`);

  const capturedOutput = [];

  for (const step of requirement.installSteps) {
    logger.info(`Step: ${step.label} -> ${step.command} ${step.args.join(" ")}`);
    const result = await runCommand(step.command, step.args);
    capturedOutput.push(`$ ${step.command} ${step.args.join(" ")}\n${formatCommandOutput(result)}`);

    if (!step.successCodes.includes(result.code)) {
      const output = capturedOutput.join("\n\n");
      logger.error(`Install step failed (${step.label}).\n${output}`);
      return { ok: false, installedId: requirement.id, failedStep: step.label, output };
    }
  }

  logger.info(`Requirement installed: ${requirement.name}`);
  return { ok: true, installedId: requirement.id };
}

module.exports = { REQUIREMENTS, checkRequirements, installFirstMissingRequirement };
