import { describe, expect, it } from "@jest/globals";

import {
  createAppContext,
  getProcessSingletonAppContext,
  resetProcessSingletonAppContextForTests
} from "./app-context";

describe("app-context singleton boundaries", () => {
  it("createAppContext returns a fresh context each time", () => {
    const a = createAppContext();
    const b = createAppContext();

    expect(a).not.toBe(b);
    expect(a.commandRegistry).not.toBe(b.commandRegistry);
    expect(a.moduleRegistry).not.toBe(b.moduleRegistry);
    expect(a.validator).not.toBe(b.validator);
    expect(a.resolver).not.toBe(b.resolver);
  });

  it("getProcessSingletonAppContext returns same instance within process", () => {
    resetProcessSingletonAppContextForTests();
    const a = getProcessSingletonAppContext();
    const b = getProcessSingletonAppContext();

    expect(a).toBe(b);
    expect(a.commandRegistry).toBe(b.commandRegistry);
    expect(a.moduleRegistry).toBe(b.moduleRegistry);
  });
});

