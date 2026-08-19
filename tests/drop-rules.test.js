"use strict";

/**
 * Unit tests for the drop-validation rules of PLAN.md.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { planConversionJobs, DropValidationError } = require("../src/main/drop-rules");

test("a single markdown file converts with the default CSS", () => {
  const { jobs } = planConversionJobs(["/docs/report.md"]);
  assert.deepEqual(jobs, [{ markdownPath: "/docs/report.md", cssPath: null }]);
});

test("a markdown file with one css file converts with that css", () => {
  const { jobs } = planConversionJobs(["/docs/report.md", "/docs/style.css"]);
  assert.deepEqual(jobs, [{ markdownPath: "/docs/report.md", cssPath: "/docs/style.css" }]);
});

test("multiple markdown files without css all use the default css", () => {
  const { jobs } = planConversionJobs(["/a.md", "/b.md"]);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((job) => job.cssPath === null));
});

test("multiple markdown files share a single css file", () => {
  const { jobs } = planConversionJobs(["/a.md", "/b.md", "/shared.css"]);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((job) => job.cssPath === "/shared.css"));
});

test("fully paired markdown and css files convert as pairs", () => {
  const { jobs } = planConversionJobs(["/file1.md", "/file1.css", "/file2.md", "/file2.css"]);
  assert.deepEqual(jobs, [
    { markdownPath: "/file1.md", cssPath: "/file1.css" },
    { markdownPath: "/file2.md", cssPath: "/file2.css" },
  ]);
});

test("pairing is case-insensitive on file names", () => {
  const { jobs } = planConversionJobs(["/Report.MD", "/report.CSS"]);
  assert.deepEqual(jobs, [{ markdownPath: "/Report.MD", cssPath: "/report.CSS" }]);
});

test("an unsupported file is rejected and named", () => {
  assert.throws(
    () => planConversionJobs(["/report.md", "/photo.png"]),
    (error) => {
      assert.ok(error instanceof DropValidationError);
      assert.deepEqual(error.offendingFiles, ["photo.png"]);
      return true;
    }
  );
});

test("css files without any markdown file are rejected", () => {
  assert.throws(
    () => planConversionJobs(["/style.css"]),
    (error) => error instanceof DropValidationError && error.offendingFiles.includes("style.css")
  );
});

test("multiple css files with unpaired names are rejected", () => {
  assert.throws(
    () => planConversionJobs(["/file1.md", "/fileA.css", "/file2.md", "/fileB.css"]),
    (error) => {
      assert.ok(error instanceof DropValidationError);
      assert.deepEqual(error.offendingFiles.sort(), ["file1.md", "file2.md", "fileA.css", "fileB.css"].sort());
      return true;
    }
  );
});

test("strict partial pairing (3 md + 2 css) is rejected and names the unpaired file", () => {
  assert.throws(
    () => planConversionJobs(["/a.md", "/a.css", "/b.md", "/b.css", "/c.md"]),
    (error) => {
      assert.ok(error instanceof DropValidationError);
      assert.deepEqual(error.offendingFiles, ["c.md"]);
      return true;
    }
  );
});

test("an extra css file without a matching markdown file is rejected", () => {
  assert.throws(
    () => planConversionJobs(["/a.md", "/a.css", "/orphan.css"]),
    (error) => error instanceof DropValidationError && error.offendingFiles.includes("orphan.css")
  );
});
