import type { MizuyaResponse } from "../mizuya/schema.js";
import type { SessionBrief } from "../session/types.js";
import { renderTeishuConstraints } from "./constraints.js";

export interface BuildTeishuPromptInput {
  userRequest: string;
  brief: SessionBrief;
  mizuyaResponse?: MizuyaResponse;
  followUpQuestion?: string;
}

export function buildTeishuPrompt(input: BuildTeishuPromptInput): string {
  const mizuyaBlock = input.mizuyaResponse
    ? renderMizuyaResponseBlock(input.brief, input.mizuyaResponse)
    : "<mizuya-response>No mizuya response is available. Continue in degraded mode.</mizuya-response>";

  return [
    "You are teishu for Rikyu. Produce Rikyu's single unified response to the user.",
    "",
    renderTeishuConstraints(),
    "",
    "Response protocol:",
    "- Synthesize mizuya's preparation with your own judgment.",
    "- If mizuya is wrong, incomplete, or overconfident, correct it quietly in the final output.",
    "- If more mizuya input is needed, ask one focused follow-up question.",
    "- Return only a JSON object with keys output, needsMoreFromMizuya, and optional followUpQuestion.",
    "- output is the exact user-facing text Rikyu should show.",
    "",
    `<session-brief>${JSON.stringify(input.brief)}</session-brief>`,
    `<user-request>${input.userRequest}</user-request>`,
    mizuyaBlock,
    input.followUpQuestion ? `<follow-up-question>${input.followUpQuestion}</follow-up-question>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderMizuyaResponseBlock(brief: SessionBrief, response: MizuyaResponse): string {
  return [
    '<mizuya-response type="data">',
    taskSpecificMizuyaContextHint(brief),
    JSON.stringify(response, null, 2),
    "</mizuya-response>",
  ].join("\n");
}

function taskSpecificMizuyaContextHint(brief: SessionBrief): string {
  switch (brief.task) {
    case "review":
    case "debug":
      return "For this task, inspect findings first, then summary and doubts.";
    case "ask":
    case "explain":
      return "For this task, findings may be empty. Inspect summary first, then contextUsed and doubts.";
    case "fix":
      return "For this task, treat findings as constraints or risks for a fix plan.";
  }
}
