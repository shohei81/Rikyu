import type { SessionBrief, SessionTask } from "../session/types.js";

export interface PromptContextBlock {
  label: string;
  content: string;
}

export interface BuildMizuyaPromptInput {
  requestId: string;
  userRequest: string;
  brief: SessionBrief;
  context?: PromptContextBlock[];
}

export function buildMizuyaPrompt(input: BuildMizuyaPromptInput): string {
  return [
    "You are mizuya for Rikyu. Prepare analysis for teishu.",
    "",
    "Return only one valid JSON object. Do not wrap it in Markdown. Do not add commentary before or after JSON.",
    "",
    "The JSON object must match this TypeScript shape:",
    mizuyaResponseShape,
    "",
    "Field rules:",
    "- requestId must equal the provided requestId.",
    "- findings must be a flat array.",
    "- evidence must contain concrete snippets, paths, logs, or observations used for the finding.",
    "- inference is your reasoning about why the evidence matters.",
    "- suggestedAction is only advice. It is not an instruction to teishu.",
    "- confidence must be high, medium, or low.",
    "",
    taskSpecificInstruction(input.brief.task),
    "",
    `<session-brief>${JSON.stringify(input.brief)}</session-brief>`,
    `<request-id>${input.requestId}</request-id>`,
    `<user-request>${input.userRequest}</user-request>`,
    renderContextBlocks(input.context ?? []),
  ].join("\n");
}

function taskSpecificInstruction(task: SessionTask): string {
  switch (task) {
    case "review":
      return [
        "Task handling:",
        "- Review the supplied diff or files for bugs, regressions, risky behavior, and missing tests.",
        "- Use findings for concrete code issues only.",
        "- Put low-impact observations at level note.",
      ].join("\n");
    case "debug":
      return [
        "Task handling:",
        "- Treat findings as hypotheses, suspicious locations, or concrete confirmation steps.",
        "- Use evidence for symptoms, logs, code paths, and observed behavior.",
        "- Structure summary as symptom, leading hypotheses, and next confirmation steps.",
      ].join("\n");
    case "ask":
    case "explain":
      return [
        "Task handling:",
        "- findings may be an empty array and that is normal.",
        "- Put the useful answer in summary.",
        "- Use contextUsed to record what context you relied on.",
      ].join("\n");
    case "fix":
      return [
        "Task handling:",
        "- Prefer a fix plan in summary unless the request explicitly asks for patch details.",
        "- Use findings for concrete blockers or risks that the fix must address.",
      ].join("\n");
  }
}

function renderContextBlocks(blocks: PromptContextBlock[]): string {
  if (blocks.length === 0) return "<context>No additional context provided.</context>";

  return [
    "<context>",
    ...blocks.map((block) =>
      [
        `<context-block label=${JSON.stringify(block.label)}>`,
        block.content,
        "</context-block>",
      ].join("\n"),
    ),
    "</context>",
  ].join("\n");
}

const mizuyaResponseShape = `{
  "requestId": "string",
  "findings": [
    {
      "ruleId": "string",
      "level": "error | warning | note",
      "message": "string",
      "location": { "file": "string", "startLine": 1 },
      "evidence": ["string"],
      "inference": "string",
      "suggestedAction": "string",
      "confidence": "high | medium | low"
    }
  ],
  "summary": "string",
  "doubts": ["string"],
  "contextUsed": ["string"]
}`;
