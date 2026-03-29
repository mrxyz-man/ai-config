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
    expect(report.scanMode).toBe("repository");
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
    expect(report.scanMode).toBe("repository");
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it("skips files that match ignore rules", () => {
    const projectRoot = createTempProject();
    const encodingConfig = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/text/encoding.yaml"), "utf8")
    ) as { mojibake_signals: string[] };
    const signal = encodingConfig.mojibake_signals[0] ?? "Гѓ";

    fs.mkdirSync(path.join(projectRoot, "node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, "node_modules", "bad-text.md"),
      `Ignored broken content ${signal}`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectRoot, "README.md"),
      "Clean project readme without broken symbols",
      "utf8"
    );

    const service = new TextPolicyService();
    const report = service.check(projectRoot);

    expect(report.ok).toBe(true);
    expect(report.scanMode).toBe("repository");
    expect(report.violations).toHaveLength(0);
  });

  it("applies allowlist overrides even when ignore is broad", () => {
    const projectRoot = createTempProject();
    const encodingConfig = YAML.parse(
      fs.readFileSync(path.join(projectRoot, "ai/text/encoding.yaml"), "utf8")
    ) as { mojibake_signals: string[] };
    const signal = encodingConfig.mojibake_signals[0] ?? "Гѓ";

    fs.writeFileSync(
      path.join(projectRoot, "ai/rules/ignore.yaml"),
      `version: "1.0"
ignore:
  - "**"
allowlist_overrides:
  - "ai/**"
`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectRoot, "ai/custom/allowlisted-bad.md"),
      `Allowlisted broken content ${signal}`,
      "utf8"
    );

    const service = new TextPolicyService();
    const report = service.check(projectRoot);

    expect(report.ok).toBe(false);
    expect(report.scanMode).toBe("repository");
    expect(report.violations.some((item) => item.file === "ai/custom/allowlisted-bad.md")).toBe(true);
  });

  it("falls back to repository scan in changed-only mode without git metadata", () => {
    const projectRoot = createTempProject();
    const service = new TextPolicyService();

    const report = service.check(projectRoot, { changedOnly: true });

    expect(report.scanMode).toBe("repository");
    expect(
      report.warnings.some((item) =>
        item.message.includes("Changed-only mode requires a git repository")
      )
    ).toBe(true);
  });

  it("warns when repository scan reaches configured guardrails", () => {
    const projectRoot = createTempProject();
    const service = new TextPolicyService();

    const bigDir = path.join(projectRoot, "bulk");
    fs.mkdirSync(bigDir, { recursive: true });
    for (let index = 0; index < 90; index += 1) {
      fs.writeFileSync(path.join(bigDir, `chunk-${index}.md`), "x".repeat(400_000), "utf8");
    }

    const report = service.check(projectRoot);

    expect(report.ok).toBe(true);
    expect(
      report.warnings.some((item) => item.message.includes("Reached scan size limit"))
    ).toBe(true);
  });
});
