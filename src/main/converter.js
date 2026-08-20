"use strict";

/**
 * Conversion pipeline: validates the dropped files, converts each Markdown
 * file to a temporary PDF with the markdown-convert CLI, asks the user where
 * to save each PDF, and moves it there.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runCommand, formatCommandOutput } = require("./process-runner");
const { planConversionJobs, DropValidationError } = require("./drop-rules");

const CONVERSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Error thrown when the markdown-convert CLI fails. Carries the captured
 * command output for display.
 */
class ConversionError extends Error {
  /**
   * @param {string} message User-facing summary.
   * @param {string} output Captured command output.
   */
  constructor(message, output) {
    super(message);
    this.name = "ConversionError";
    this.output = output;
  }
}

/**
 * Creates the temporary folder that receives the converted PDFs.
 *
 * @returns {string} Absolute path of the new temporary folder.
 */
function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "markdown-convert-gui-"));
}

/**
 * Removes a temporary folder and everything in it, ignoring failures.
 *
 * @param {string} workspacePath
 * @param {{warn: Function}} logger
 */
function cleanTempWorkspace(workspacePath, logger) {
  try {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  } catch (error) {
    logger.warn(`Could not remove the temporary folder ${workspacePath}: ${error.message}`);
  }
}

/**
 * Converts one Markdown file to a PDF inside the temporary workspace.
 *
 * @param {{markdownPath: string, cssPath: string|null}} job
 * @param {string} workspacePath Temporary folder receiving the PDF.
 * @param {{info: Function}} logger
 * @returns {Promise<string>} Absolute path of the produced PDF.
 * @throws {ConversionError} When the conversion fails.
 */
async function convertOneFile(job, workspacePath, logger) {
  const pdfName = `${path.basename(job.markdownPath, path.extname(job.markdownPath))}.pdf`;
  const tempPdfPath = path.join(workspacePath, pdfName);

  const args = [job.markdownPath, "--mode=once", `--out=${tempPdfPath}`];
  if (job.cssPath) {
    args.push(`--css=${job.cssPath}`);
  }

  logger.info(`Converting: markdown-convert ${args.join(" ")}`);
  const result = await runCommand("markdown-convert", args, {
    cwd: path.dirname(job.markdownPath),
    timeoutMs: CONVERSION_TIMEOUT_MS,
  });

  if (result.code !== 0 || !fs.existsSync(tempPdfPath)) {
    throw new ConversionError(
      `Conversion failed for ${path.basename(job.markdownPath)}.`,
      formatCommandOutput(result)
    );
  }

  return tempPdfPath;
}

/**
 * Moves a file, falling back to copy + delete across filesystems.
 *
 * @param {string} sourcePath
 * @param {string} destinationPath
 */
function moveFile(sourcePath, destinationPath) {
  try {
    fs.renameSync(sourcePath, destinationPath);
  } catch (error) {
    if (error.code !== "EXDEV") {
      throw error;
    }
    fs.copyFileSync(sourcePath, destinationPath);
    fs.unlinkSync(sourcePath);
  }
}

/**
 * Runs the full batch: validate, convert each file, prompt for a destination,
 * moves each PDF and optionally opens the saved file in the default viewer.
 * The batch stops at the first conversion failure.
 *
 * @param {string[]} filePaths Dropped or picked files.
 * @param {object} callbacks
 * @param {Function} callbacks.promptSavePath Called with the default PDF name;
 *   must resolve to the chosen destination path, or null when the user cancels.
 * @param {Function} callbacks.onProgress Called with progress events for the UI.
 * @param {Function} [callbacks.openSavedFile] Optional callback invoked with the
 *   saved destination path to launch the default viewer.
 * @param {Function} [callbacks.convertFn] Optional conversion runner function.
 * @param {{info: Function, warn: Function, error: Function}} logger
 * @returns {Promise<{savedCount: number, skippedCount: number}>}
 */
async function runConversionBatch(
  filePaths,
  { promptSavePath, onProgress, openSavedFile, convertFn = convertOneFile },
  logger
) {
  const { jobs } = planConversionJobs(filePaths);
  const workspacePath = createTempWorkspace();
  let savedCount = 0;
  let skippedCount = 0;

  try {
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const fileName = path.basename(job.markdownPath);
      onProgress({ stage: "converting", fileName, current: index + 1, total: jobs.length });

      const tempPdfPath = await convertFn(job, workspacePath, logger);
      const pdfName = path.basename(tempPdfPath);

      onProgress({ stage: "saving", fileName: pdfName, current: index + 1, total: jobs.length });
      const destinationPath = await promptSavePath(pdfName);

      if (destinationPath) {
        moveFile(tempPdfPath, destinationPath);
        savedCount += 1;
        logger.info(`Saved: ${destinationPath}`);
        if (typeof openSavedFile === "function") {
          try {
            await openSavedFile(destinationPath);
          } catch (openError) {
            logger.warn(`Could not open saved PDF: ${openError.message || openError}`);
          }
        }
      } else {
        fs.rmSync(tempPdfPath, { force: true });
        skippedCount += 1;
        logger.info(`Skipped by user: ${pdfName}`);
      }
    }
  } catch (error) {
    cleanTempWorkspace(workspacePath, logger);
    throw error;
  }

  cleanTempWorkspace(workspacePath, logger);
  return { savedCount, skippedCount };
}

module.exports = {
  runConversionBatch,
  convertOneFile,
  createTempWorkspace,
  cleanTempWorkspace,
  ConversionError,
  DropValidationError,
};
