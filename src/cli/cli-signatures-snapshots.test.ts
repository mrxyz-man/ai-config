import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "@jest/globals";

const projectRoot = path.resolve(__dirname, "../..");
const srcCliPath = path.join(projectRoot, "src/cli.ts");

const runHelp = (args: string[]): string => {
  const run = spawnSync("node", ["-r", "ts-node/register/transpile-only", srcCliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });

  return (run.stdout ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
};

describe("CLI command signature snapshots", () => {
  it("root help stays stable", () => {
    expect(runHelp(["--help"])).toMatchSnapshot();
  });

  it("tasks help stays stable", () => {
    expect(runHelp(["tasks", "--help"])).toMatchSnapshot();
  });

  it("questions help stays stable", () => {
    expect(runHelp(["questions", "--help"])).toMatchSnapshot();
  });

  it("mcp help stays stable", () => {
    expect(runHelp(["mcp", "--help"])).toMatchSnapshot();
  });

  it("text help stays stable", () => {
    expect(runHelp(["text", "--help"])).toMatchSnapshot();
  });
});
