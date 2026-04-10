export type ProgressStage = "reading" | "mizuya" | "teishu" | "done";

export interface ProgressReporterOptions {
  enabled?: boolean;
  writer?: (text: string) => void;
}

export interface ProgressReporter {
  stage(stage: ProgressStage): void;
}

const progressMessages: Record<ProgressStage, string | undefined> = {
  reading: "Reading...",
  mizuya: "Consulting mizuya...",
  teishu: "Preparing response...",
  done: undefined,
};

export function createProgressReporter(options: ProgressReporterOptions = {}): ProgressReporter {
  const enabled = options.enabled ?? true;
  const writer = options.writer ?? ((text: string) => process.stderr.write(text));

  return {
    stage(stage) {
      if (!enabled) return;
      const message = progressMessages[stage];
      if (!message) return;
      writer(`${message}\n`);
    },
  };
}

export function progressMessageForStage(stage: ProgressStage): string | undefined {
  return progressMessages[stage];
}
