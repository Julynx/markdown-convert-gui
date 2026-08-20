"use strict";

/**
 * Unit tests for the conversion pipeline and default PDF opener callback.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  runConversionBatch,
  createTempWorkspace,
  cleanTempWorkspace,
  ConversionError,
} = require("../src/main/converter");

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Creates a mock convert function that writes a dummy PDF to the workspace.
 *
 * @returns {Function}
 */
function createMockConvertFn() {
  return async (job, workspacePath) => {
    const pdfName = `${path.basename(job.markdownPath, path.extname(job.markdownPath))}.pdf`;
    const tempPdfPath = path.join(workspacePath, pdfName);
    fs.writeFileSync(tempPdfPath, "%PDF-1.4 dummy", "utf8");
    return tempPdfPath;
  };
}

/**
 * Creates a throwaway directory for destination PDFs.
 *
 * @returns {{directory: string, cleanup: Function}}
 */
function createTempTargetDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "converter-target-test-"));
  return {
    directory,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test("runConversionBatch calls openSavedFile for saved files", async () => {
  const { directory, cleanup } = createTempTargetDirectory();
  try {
    const openedFiles = [];
    const destinationPath = path.join(directory, "report.pdf");

    const result = await runConversionBatch(
      ["/docs/report.md"],
      {
        convertFn: createMockConvertFn(),
        promptSavePath: async () => destinationPath,
        onProgress: () => {},
        openSavedFile: async (savedPath) => {
          openedFiles.push(savedPath);
        },
      },
      silentLogger
    );

    assert.equal(result.savedCount, 1);
    assert.equal(result.skippedCount, 0);
    assert.deepEqual(openedFiles, [destinationPath]);
    assert.ok(fs.existsSync(destinationPath));
  } finally {
    cleanup();
  }
});

test("runConversionBatch does not call openSavedFile when the user cancels save", async () => {
  const openedFiles = [];

  const result = await runConversionBatch(
    ["/docs/report.md"],
    {
      convertFn: createMockConvertFn(),
      promptSavePath: async () => null,
      onProgress: () => {},
      openSavedFile: async (savedPath) => {
        openedFiles.push(savedPath);
      },
    },
    silentLogger
  );

  assert.equal(result.savedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(openedFiles.length, 0);
});

test("runConversionBatch handles openSavedFile errors gracefully without failing", async () => {
  const { directory, cleanup } = createTempTargetDirectory();
  const loggedWarnings = [];
  const trackingLogger = {
    ...silentLogger,
    warn: (message) => loggedWarnings.push(message),
  };

  try {
    const destinationPath = path.join(directory, "report.pdf");

    const result = await runConversionBatch(
      ["/docs/report.md"],
      {
        convertFn: createMockConvertFn(),
        promptSavePath: async () => destinationPath,
        onProgress: () => {},
        openSavedFile: async () => {
          throw new Error("Simulated OS viewer failure");
        },
      },
      trackingLogger
    );

    assert.equal(result.savedCount, 1);
    assert.equal(result.skippedCount, 0);
    assert.ok(fs.existsSync(destinationPath));
    assert.equal(loggedWarnings.length, 1);
    assert.ok(loggedWarnings[0].includes("Simulated OS viewer failure"));
  } finally {
    cleanup();
  }
});

test("runConversionBatch cleans up temporary workspace on error", async () => {
  let createdTempPath = null;
  const failingConvertFn = async (job, workspacePath) => {
    createdTempPath = workspacePath;
    throw new ConversionError("Failed conversion", "Error details");
  };

  await assert.rejects(
    async () => {
      await runConversionBatch(
        ["/docs/fail.md"],
        {
          convertFn: failingConvertFn,
          promptSavePath: async () => null,
          onProgress: () => {},
        },
        silentLogger
      );
    },
    (error) => error instanceof ConversionError
  );

  assert.ok(createdTempPath !== null);
  assert.equal(fs.existsSync(createdTempPath), false);
});

test("createTempWorkspace and cleanTempWorkspace manage folder lifecycle", () => {
  const workspacePath = createTempWorkspace();
  assert.ok(fs.existsSync(workspacePath));
  cleanTempWorkspace(workspacePath, silentLogger);
  assert.equal(fs.existsSync(workspacePath), false);
});
