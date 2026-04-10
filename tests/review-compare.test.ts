import { describe, expect, it } from "vitest";

import { compareReviewFindings, formatReReviewNotification } from "../src/collaboration/review-compare.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

describe("review comparison", () => {
  it("detects new, resolved, and unchanged findings", () => {
    const previous = response([
      finding("old", "Old issue"),
      finding("same", "Same issue"),
    ]);
    const next = response([
      finding("same", "Same issue"),
      finding("new", "New issue"),
    ]);

    const comparison = compareReviewFindings(previous, next);

    expect(comparison.newFindings.map((finding) => finding.ruleId)).toEqual(["new"]);
    expect(comparison.resolvedFindings.map((finding) => finding.ruleId)).toEqual(["old"]);
    expect(comparison.unchangedFindings.map((finding) => finding.ruleId)).toEqual(["same"]);
  });

  it("formats a user-visible notification for new findings", () => {
    const comparison = compareReviewFindings(undefined, response([finding("new", "New issue")]));

    expect(formatReReviewNotification(comparison)).toContain(
      "Re-review found 1 new issue(s) after apply.",
    );
    expect(formatReReviewNotification(comparison)).toContain("- warning new: New issue");
  });
});

function response(findings: MizuyaResponse["findings"]): MizuyaResponse {
  return {
    requestId: "req-review",
    findings,
    summary: "summary",
    doubts: [],
    contextUsed: ["diff"],
  };
}

function finding(ruleId: string, message: string): MizuyaResponse["findings"][number] {
  return {
    ruleId,
    level: "warning",
    message,
    evidence: ["diff"],
    confidence: "high",
  };
}
