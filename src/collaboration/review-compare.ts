import type { MizuyaFinding, MizuyaResponse } from "../mizuya/schema.js";

export interface ReviewComparison {
  newFindings: MizuyaFinding[];
  resolvedFindings: MizuyaFinding[];
  unchangedFindings: MizuyaFinding[];
}

export function compareReviewFindings(
  previous: MizuyaResponse | undefined,
  next: MizuyaResponse | undefined,
): ReviewComparison {
  const previousFindings = previous?.findings ?? [];
  const nextFindings = next?.findings ?? [];
  const previousKeys = new Set(previousFindings.map(findingKey));
  const nextKeys = new Set(nextFindings.map(findingKey));

  return {
    newFindings: nextFindings.filter((finding) => !previousKeys.has(findingKey(finding))),
    resolvedFindings: previousFindings.filter((finding) => !nextKeys.has(findingKey(finding))),
    unchangedFindings: nextFindings.filter((finding) => previousKeys.has(findingKey(finding))),
  };
}

export function formatReReviewNotification(comparison: ReviewComparison): string {
  if (comparison.newFindings.length === 0) {
    return "Re-review found no new issues after apply.\n";
  }

  return [
    `Re-review found ${comparison.newFindings.length} new issue(s) after apply.`,
    ...comparison.newFindings.map(formatFindingLine),
    "",
  ].join("\n");
}

function formatFindingLine(finding: MizuyaFinding): string {
  const location = finding.location
    ? ` (${finding.location.file}${finding.location.startLine ? `:${finding.location.startLine}` : ""})`
    : "";
  return `- ${finding.level} ${finding.ruleId}${location}: ${finding.message}`;
}

function findingKey(finding: MizuyaFinding): string {
  return JSON.stringify({
    ruleId: finding.ruleId,
    level: finding.level,
    message: finding.message,
    location: finding.location,
  });
}
