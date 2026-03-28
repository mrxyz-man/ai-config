import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { AiConfigResolver } from "./ai-config-resolver";

const copyAiFolderToTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-resolve-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("AiConfigResolver", () => {
  it("produces deterministic checksum for the same input", () => {
    const projectRoot = copyAiFolderToTempProject();
    const resolver = new AiConfigResolver();

    const first = resolver.resolve(projectRoot);
    const second = resolver.resolve(projectRoot);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.checksum).toBeTruthy();
    expect(first.checksum).toBe(second.checksum);
    expect(first.outputFile).toBe("ai/resolved.yaml");
    expect(fs.existsSync(path.join(projectRoot, "ai/resolved.yaml"))).toBe(true);
  });

  it("fails when required input file is missing", () => {
    const projectRoot = copyAiFolderToTempProject();
    fs.rmSync(path.join(projectRoot, "ai/tasks/config.yaml"), { force: true });

    const resolver = new AiConfigResolver();
    const result = resolver.resolve(projectRoot);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.file === "ai/tasks/config.yaml")).toBe(true);
  });
});

