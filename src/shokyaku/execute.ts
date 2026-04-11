/**
 * Shared execution — the common path for all commands and REPL turns.
 *
 * Whether the shokyaku (正客) invokes a command or types in the REPL,
 * the chaji flows through here.
 */

import { randomUUID } from "node:crypto";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { MizuyaAgent } from "../mizuya/agent.js";
import { TeishuAgent } from "../teishu/agent.js";
import { Hanto, type ChajiResult } from "../hanto/orchestrator.js";
import { resolveMode, shouldUseMizuya } from "../hanto/toriawase.js";
import { collectContext } from "../chaji/context.js";
import { saveSnapshot } from "../chaji/store.js";
import { loadConfig } from "../config/loader.js";
import type { RikyuConfig } from "../config/schema.js";
import type { ChajiMode, SessionBrief } from "../chaji/types.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import { formatText } from "../output/text.js";
import { formatJson } from "../output/json.js";
import { formatSarif } from "../output/sarif.js";
import { redactSecrets } from "../output/redaction.js";

// ── Types ───────────────────────────────────────────────

export interface OutputOptions {
  ci?: boolean;
  json?: boolean;
  quiet?: boolean;
  sarif?: boolean;
  verbose?: boolean;
}

export interface ExecuteOptions {
  brief: SessionBrief;
  userRequest: string;
  target?: string;
  cliMode?: ChajiMode;
  output?: OutputOptions;
  sessionId?: string;
  claudeSessionId?: string;
  /** Pre-fetched mizuya result (speculative prefetch or cache) */
  mizuyaResult?: MizuyaResponse;
  /** Pre-fetched mizuya failure */
  mizuyaFailure?: unknown;
  /** Suppress stdout output (REPL handles its own output) */
  suppressOutput?: boolean;
  /** Override config (for testing) */
  config?: RikyuConfig;
  /** Override Hanto (for testing) */
  hanto?: Hanto;
  /** Explicit tool use override (from /tools command) */
  toolUseOverride?: boolean;
}

export interface ExecuteResult extends ChajiResult {
  config: RikyuConfig;
}

// ── Execute ─────────────────────────────────────────────

export async function execute(options: ExecuteOptions): Promise<ExecuteResult> {
  const startedAt = Date.now();
  const config = options.config ?? (await loadConfig()).config;

  // Resolve mode via toriawase
  const brief: SessionBrief = {
    ...options.brief,
    mode: resolveMode({
      brief: options.brief,
      configMode: config.mode,
      cliMode: options.cliMode,
    }),
  };

  // Collect context (kaiseki)
  const context = await collectContext(brief, { target: options.target });
  const requestId = randomUUID();

  // Create Hanto with agents
  const hanto =
    options.hanto ?? new Hanto(new MizuyaAgent(), new TeishuAgent());

  // Spinner for progress
  const spinner = createSpinner(config.progress);

  // Conduct the chaji
  const result = await hanto.conduct(
    {
      id: requestId,
      brief,
      userRequest: options.userRequest,
      context: context.blocks,
      mode: brief.mode,
      claudeSessionId: options.claudeSessionId,
      mizuyaResult: options.mizuyaResult,
      mizuyaFailure: options.mizuyaFailure,
      skipMizuya: !shouldUseMizuya(brief.task),
      toolUse: options.toolUseOverride ?? (brief.desiredOutcome === "apply" || brief.desiredOutcome === "patch-proposal"),
    },
    { cwd: context.cwd },
    {
      onPhase: (phase) => updateSpinner(spinner, phase),
      onDegraded: (reason) => {
        spinner?.warn(chalk.yellow(`Degraded: ${reason}`));
      },
    },
  );

  stopSpinner(spinner);

  // Output formatting
  if (!options.suppressOutput) {
    const ciMode =
      options.output?.ci === true || process.env.CI === "true";
    const quietMode = options.output?.quiet === true;
    const shouldSuppress =
      quietMode && (result.mizuya?.findings.length ?? 0) === 0;

    if (!shouldSuppress) {
      if (options.output?.sarif) {
        process.stdout.write(formatSarif(result));
      } else if (config.json || options.output?.json) {
        process.stdout.write(
          formatJson(result, {
            brief,
            sessionId: options.sessionId,
            totalMs: Date.now() - startedAt,
          }),
        );
      } else {
        process.stdout.write(await formatText(result));
      }
    }

    if (config.verbose || options.output?.verbose) {
      writeVerbose(result, brief);
    }

    // CI exit code
    if (ciMode) {
      const hasErrors =
        result.mizuya?.findings.some((f) => f.level === "error") ?? false;
      process.exitCode = result.degraded || hasErrors ? 1 : 0;
    }
  }

  // Session persistence
  if (options.sessionId) {
    await saveSnapshot(
      {
        sessionId: options.sessionId,
        claudeSessionId: result.claudeSessionId,
        brief,
        mizuyaResponses: result.mizuya ? [result.mizuya] : [],
        metadata: {
          lastRequestId: result.id,
          degraded: result.degraded,
        },
      },
      { cwd: context.cwd },
    );
  }

  return { ...result, config };
}

// ── Spinner ─────────────────────────────────────────────

const phaseLabels: Record<string, string> = {
  shoza: "the kettle is heating …",
  goza: "making tea …",
  taiseki: "",
};

function createSpinner(enabled: boolean): Ora | undefined {
  if (!enabled || !process.stderr.isTTY) return undefined;
  return ora({
    stream: process.stderr,
    color: "gray",
    spinner: "dots",
  });
}

function updateSpinner(spinner: Ora | undefined, phase: string): void {
  if (!spinner) return;
  const label =
    phaseLabels[phase] ??
    (phase.startsWith("usucha") ? "one more steep …" : "");
  if (!label) {
    spinner.stop();
    return;
  }
  spinner.text = chalk.dim(label);
  if (!spinner.isSpinning) spinner.start();
}

function stopSpinner(spinner: Ora | undefined): void {
  if (spinner?.isSpinning) spinner.stop();
}

function writeVerbose(result: ChajiResult, brief: SessionBrief): void {
  const w = (s: string) => process.stderr.write(s);
  w(`\n${chalk.dim("requestId")}=${result.id}\n`);
  w(`${chalk.dim("mode")}=${brief.mode ?? "unknown"}\n`);
  w(`${chalk.dim("degraded")}=${String(result.degraded)}\n`);
  w(`${chalk.dim("mizuyaFindings")}=${String(result.mizuya?.findings.length ?? 0)}\n`);
  if (result.degradedReason) {
    w(`${chalk.dim("degradedReason")}=${redactSecrets(result.degradedReason)}\n`);
  }
  for (const span of result.phases) {
    w(`${chalk.dim(`phase.${span.name}`)}=${span.durationMs}ms\n`);
  }
}
