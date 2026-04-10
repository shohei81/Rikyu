import { describe, expect, it } from "vitest";

import { renderJsonOutput } from "../src/output/json.js";
import { redactJsonValue, redactSecrets } from "../src/output/redaction.js";
import type { CollaborationResult } from "../src/collaboration/flow.js";

const result: CollaborationResult = {
  requestId: "req-1",
  output: "Done with token=secret-value",
  teishuResponse: { output: "Done", needsMoreFromMizuya: false },
  mizuyaResponse: {
    requestId: "req-1",
    findings: [],
    summary: "API key: sk-1234567890abcdef",
    doubts: [],
    contextUsed: [],
  },
  degraded: true,
  degradedReason: "codex:ENOENT",
  stderr: [],
};

describe("renderJsonOutput", () => {
  it("renders degraded metadata and mizuya response", () => {
    const output = JSON.parse(
      renderJsonOutput(result, {
        sessionId: "session-1",
        brief: { task: "ask", target: "question", mode: "quick" },
        totalMs: 12,
      }),
    );

    expect(output).toMatchObject({
      sessionId: "session-1",
      requestId: "req-1",
      task: "ask",
      degraded: true,
      unavailableProviders: ["codex"],
      metadata: {
        totalMs: 12,
        mode: "quick",
        degradedReason: "codex:ENOENT",
      },
    });
    expect(output.output).toBe("Done with token=[REDACTED]");
    expect(output.mizuyaResponse.summary).toBe("API key: [REDACTED]");
  });
});

describe("redaction", () => {
  it("redacts common token and API key patterns", () => {
    expect(redactSecrets("token=abc123456789")).toBe("token=[REDACTED]");
    expect(redactSecrets("sk-1234567890abcdef")).toBe("[REDACTED]");
    expect(redactSecrets("ghp_1234567890abcdef")).toBe("[REDACTED]");
  });

  it("redacts nested JSON values", () => {
    expect(redactJsonValue({ nested: ["api_key=abc123456789"] })).toEqual({
      nested: ["api_key=[REDACTED]"],
    });
  });
});
