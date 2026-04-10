import { describe, expect, it } from "vitest";

import { estimateChangeSize, selectChangeExecutor } from "../src/collaboration/change-size.js";

describe("estimateChangeSize", () => {
  it("treats local one-file changes as small", () => {
    expect(estimateChangeSize({ filesChanged: 1, diffLines: 40 })).toBe("small");
  });

  it("treats broad changes as large", () => {
    expect(estimateChangeSize({ filesChanged: 3, diffLines: 40 })).toBe("large");
    expect(estimateChangeSize({ filesChanged: 1, diffLines: 121 })).toBe("large");
    expect(estimateChangeSize({ filesChanged: 1, diffLines: 20, isRefactor: true })).toBe("large");
  });
});

describe("selectChangeExecutor", () => {
  it("selects claude for small changes and codex for large changes", () => {
    expect(selectChangeExecutor("small")).toBe("claude");
    expect(selectChangeExecutor("large")).toBe("codex");
  });
});
