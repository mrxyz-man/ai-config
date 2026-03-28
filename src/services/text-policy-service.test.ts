import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";
import { describe, expect, it } from "@jest/globals";

import { TextPolicyService } from "./text-policy-service";

const createTempProject = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-text-policy-test-"));
  const sourceAiDir = path.resolve(__dirname, "../../ai");
  const targetAiDir = path.join(tempRoot, "ai");
  fs.cpSync(sourceAiDir, targetAiDir, { recursive: true });
  return tempRoot;
};

describe("TextPolicyService", () => {
  it("passes check when no mojibake signals are present", () => {
    const projectRoot = createTempProject();
    fs.writeFileSync(
      path.join(projectRoot, "ai/questions/profiles/default.yaml"),
      'profile: "default"\nquestions: []\n',
      "utf8"
    );
    const service = new TextPolicyService();

    const report = service.check(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.checkedFiles).toBeGreaterThan(0);
  });

  it("detects mojibake signals in ai files", () => {
    const projectRoot = createTempProject();
    const encodingConfig = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/text/encoding.yaml"), "utf8")
    ) as { mojibake_signals: string[] };
    const signal = encodingConfig.mojibake_signals[0] ?? "Гђ";
    fs.writeFileSync(
      path.join(projectRoot, "ai/custom/mojibake.md"),
      `This file contains ${signal} broken text`,
      "utf8"
    );
    const service = new TextPolicyService();

    const report = service.check(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  });
});
