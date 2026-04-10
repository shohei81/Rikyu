import { describe, expect, it } from "vitest";

import { extractJsonObject, parseMizuyaResponse } from "../src/mizuya/parse.js";
import { ProviderError } from "../src/providers/types.js";

const response = {
  requestId: "req-1",
  findings: [],
  summary: "No findings.",
  doubts: [],
  contextUsed: [],
};

describe("extractJsonObject", () => {
  it("extracts the first complete object from mixed output", () => {
    const raw = `Preparing...\n${JSON.stringify(response)}\nDone`;

    expect(extractJsonObject(raw)).toBe(JSON.stringify(response));
  });

  it("does not stop on braces inside strings", () => {
    const raw = JSON.stringify({
      ...response,
      summary: "A string with { braces } inside.",
    });

    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("returns undefined for truncated JSON", () => {
    expect(extractJsonObject('noise {"requestId": "req-1"')).toBeUndefined();
  });
});

describe("parseMizuyaResponse", () => {
  it("parses a valid response with leading text", () => {
    expect(parseMizuyaResponse(`text\n${JSON.stringify(response)}`)).toEqual(response);
  });

  it("throws ProviderError when no object exists", () => {
    expect(() => parseMizuyaResponse("no json")).toThrow(ProviderError);
  });

  it("throws ProviderError for schema violations", () => {
    expect(() =>
      parseMizuyaResponse(
        JSON.stringify({
          ...response,
          findings: [{ level: "warning" }],
        }),
      ),
    ).toThrow(ProviderError);
  });
});
