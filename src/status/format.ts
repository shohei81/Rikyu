import type { RikyuStatusReport } from "./checks.js";

export function formatStatusReport(report: RikyuStatusReport): string {
  const lines = ["Rikyu status"];

  for (const provider of report.providers) {
    lines.push(`${provider.name}: ${provider.exists}`);
    if (provider.path) lines.push(`  path=${provider.path}`);
    lines.push(formatIndentedValue("version", provider.version.state, provider.version.value));
    lines.push(formatIndentedValue("auth", provider.auth.state, provider.auth.message));
  }

  lines.push(`config: ${report.config.state}`);
  if (report.config.message) lines.push(`  message=${report.config.message}`);
  if (report.config.sources.global) lines.push(`  global=${report.config.sources.global}`);
  if (report.config.sources.project) lines.push(`  project=${report.config.sources.project}`);

  if (report.config.config) {
    for (const [key, value] of Object.entries(report.config.config)) {
      lines.push(`  ${key}=${String(value)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatIndentedValue(label: string, state: string, detail?: string): string {
  return detail ? `  ${label}=${state} (${detail})` : `  ${label}=${state}`;
}
