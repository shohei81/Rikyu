export type ChangeSize = "small" | "large";

export type ChangeExecutor = "claude" | "codex";

export interface ChangeSizeInput {
  filesChanged: number;
  diffLines: number;
  isRefactor?: boolean;
  requiresTests?: boolean;
}

export function estimateChangeSize(input: ChangeSizeInput): ChangeSize {
  if (input.isRefactor) return "large";
  if (input.filesChanged > 2) return "large";
  if (input.diffLines > 120) return "large";
  if (input.requiresTests && input.filesChanged > 1) return "large";
  return "small";
}

export function selectChangeExecutor(size: ChangeSize): ChangeExecutor {
  return size === "small" ? "claude" : "codex";
}
