"use strict";

/**
 * Pure validation of dropped/picked file combinations, following the rules of
 * PLAN.md. Turns a list of file paths into a list of conversion jobs, or
 * throws a DropValidationError naming the offending files.
 *
 * Valid combinations:
 *   - one or more .md files, no .css        -> default CSS for all
 *   - one or more .md files + exactly 1 css -> that CSS shared by all
 *   - every .md paired with a same-named css -> each pair converted separately
 * Everything else is an error.
 */

const path = require("path");

const VALID_COMBINATIONS_HINT =
  "Valid combinations: Markdown files alone, Markdown files with a single shared CSS file, " +
  "or Markdown files each paired with a same-named CSS file.";

/**
 * Error thrown when a dropped or picked file set is not a valid combination.
 * Carries the names of the offending files for display.
 */
class DropValidationError extends Error {
  /**
   * @param {string} message User-facing explanation of the problem.
   * @param {string[]} offendingFiles Names of the files causing the problem.
   */
  constructor(message, offendingFiles) {
    super(message);
    this.name = "DropValidationError";
    this.offendingFiles = offendingFiles;
  }
}

/**
 * Returns the lowercase extension of a file path, without the dot.
 *
 * @param {string} filePath
 * @returns {string}
 */
function fileExtension(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

/**
 * Returns the file name without its extension.
 *
 * @param {string} filePath
 * @returns {string}
 */
function baseName(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

/**
 * Validates a set of files and builds the conversion jobs.
 *
 * @param {string[]} filePaths Absolute paths of the dropped or picked files.
 * @returns {{jobs: Array<{markdownPath: string, cssPath: string|null}>}}
 * @throws {DropValidationError} When the combination is invalid.
 */
function planConversionJobs(filePaths) {
  const markdownFiles = [];
  const cssFiles = [];
  const unsupportedFiles = [];

  for (const filePath of filePaths) {
    const extension = fileExtension(filePath);
    if (extension === "md") {
      markdownFiles.push(filePath);
    } else if (extension === "css") {
      cssFiles.push(filePath);
    } else {
      unsupportedFiles.push(filePath);
    }
  }

  if (unsupportedFiles.length > 0) {
    throw new DropValidationError(
      `Only Markdown (.md) and CSS (.css) files are accepted. ${VALID_COMBINATIONS_HINT}`,
      unsupportedFiles.map((filePath) => path.basename(filePath))
    );
  }

  if (markdownFiles.length === 0) {
    throw new DropValidationError(
      `No Markdown file to convert. A CSS file is only used to style a Markdown file. ${VALID_COMBINATIONS_HINT}`,
      cssFiles.map((filePath) => path.basename(filePath))
    );
  }

  if (cssFiles.length === 0) {
    return { jobs: markdownFiles.map((markdownPath) => ({ markdownPath, cssPath: null })) };
  }

  if (cssFiles.length === 1) {
    return { jobs: markdownFiles.map((markdownPath) => ({ markdownPath, cssPath: cssFiles[0] })) };
  }

  return planPairedJobs(markdownFiles, cssFiles);
}

/**
 * Builds jobs for the strict pairing rule: every Markdown file must pair with
 * a same-named CSS file, and there must be no unpaired CSS files.
 *
 * @param {string[]} markdownFiles
 * @param {string[]} cssFiles
 * @returns {{jobs: Array<{markdownPath: string, cssPath: string}>}}
 * @throws {DropValidationError} When any file is unpaired.
 */
function planPairedJobs(markdownFiles, cssFiles) {
  const cssByBaseName = new Map();
  for (const cssPath of cssFiles) {
    cssByBaseName.set(baseName(cssPath), cssPath);
  }

  const markdownBaseNames = new Set(markdownFiles.map(baseName));
  const unpairedMarkdown = markdownFiles.filter((filePath) => !cssByBaseName.has(baseName(filePath)));
  const unpairedCss = cssFiles.filter((filePath) => !markdownBaseNames.has(baseName(filePath)));
  const unpairedFiles = [...unpairedMarkdown, ...unpairedCss];

  if (unpairedFiles.length > 0 || markdownFiles.length !== cssFiles.length) {
    throw new DropValidationError(
      `With several CSS files, every Markdown file must be paired with a same-named CSS file ` +
        `(for example report.md with report.css). ${VALID_COMBINATIONS_HINT}`,
      unpairedFiles.map((filePath) => path.basename(filePath))
    );
  }

  return {
    jobs: markdownFiles.map((markdownPath) => ({
      markdownPath,
      cssPath: cssByBaseName.get(baseName(markdownPath)),
    })),
  };
}

module.exports = { planConversionJobs, DropValidationError };
