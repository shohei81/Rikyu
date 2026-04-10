import { describe, expect, it } from "vitest";

import { parseTeishuResponse } from "../src/teishu/parse.js";
import { ProviderError } from "../src/providers/types.js";

describe("parseTeishuResponse", () => {
  it("parses a valid response with leading text", () => {
    expect(
      parseTeishuResponse(
        'noise\n{"output":"Done","needsMoreFromMizuya":false,"followUpQuestion":"Check tests?"}',
      ),
    ).toEqual({
      output: "Done",
      needsMoreFromMizuya: false,
      followUpQuestion: "Check tests?",
    });
  });

  it("throws ProviderError for invalid response shape", () => {
    expect(() => parseTeishuResponse('{"output":"Done"}')).toThrow(ProviderError);
  });
});
