/**
 * Terminal markdown renderer.
 *
 * Renders agent output as styled terminal text —
 * headers, code blocks, bold, inline code — all rendered
 * with muted, elegant colors befitting the tea room.
 */

import chalk from "chalk";
import { marked } from "marked";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // @ts-expect-error -- marked-terminal has no type declarations
  const { default: TerminalRenderer } = await import("marked-terminal");

  marked.setOptions({
    renderer: new TerminalRenderer({
      heading: chalk.bold.white,
      firstHeading: chalk.bold.white,
      strong: chalk.bold,
      em: chalk.italic,
      codespan: chalk.cyan,
      code: chalk.gray,
      blockquote: chalk.dim.italic,
      listitem: chalk.white,
      link: chalk.cyan.underline,
      table: chalk.white,
      paragraph: chalk.white,
      showSectionPrefix: false,
      reflowText: true,
      width: Math.min(process.stdout.columns || 80, 100),
      tab: 2,
    }),
  });
}

export async function renderMarkdown(text: string): Promise<string> {
  await ensureInit();
  const rendered = marked.parse(text) as string;
  return rendered.replace(/\n{3,}$/g, "\n");
}
