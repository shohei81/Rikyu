import { describe, expect, it } from "vitest";

import { parseSlashCommand, slashHelpText } from "../src/cli/slash.js";

describe("parseSlashCommand", () => {
  it("parses command only", () => {
    expect(parseSlashCommand("/review")).toEqual({ kind: "command", command: "review" });
  });

  it("parses command with prompt", () => {
    expect(parseSlashCommand("/review このdiff見て")).toEqual({
      kind: "command",
      command: "review",
      prompt: "このdiff見て",
    });
  });

  it("parses unknown commands", () => {
    expect(parseSlashCommand("/wat now")).toEqual({
      kind: "unknown",
      command: "wat",
      prompt: "now",
    });
  });

  it("parses empty input", () => {
    expect(parseSlashCommand("  ")).toEqual({ kind: "empty" });
  });

  it("parses non-slash input as text", () => {
    expect(parseSlashCommand("hello")).toEqual({ kind: "text", text: "hello" });
  });

  it("renders help text", () => {
    expect(slashHelpText()).toContain("/review [prompt]");
    expect(slashHelpText()).toContain("/status");
  });
});
