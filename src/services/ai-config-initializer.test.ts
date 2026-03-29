import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { AiConfigInitializer } from "./ai-config-initializer";
import { AiConfigResolver } from "./ai-config-resolver";

const createTempProject = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-init-test-"));

describe("AiConfigInitializer", () => {
  it("bootstraps ai folder on empty project and resolves baseline", () => {
    const projectRoot = createTempProject();
    const initializer = new AiConfigInitializer(new AiConfigResolver());

    const report = initializer.init(projectRoot, { lang: "ru", skipQuestions: true });

    expect(report.ok).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "ai/ai.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "ai/resolved.yaml"))).toBe(true);
    expect(report.unresolvedQuestions.length).toBeGreaterThan(0);
  });

  it("fails if target ai directory exists and force is false", () => {
    const projectRoot = createTempProject();
    fs.mkdirSync(path.join(projectRoot, "ai"), { recursive: true });
    const initializer = new AiConfigInitializer(new AiConfigResolver());

    const report = initializer.init(projectRoot, { force: false });

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.file === "ai")).toBe(true);
  });
});

