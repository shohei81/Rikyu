/**
 * Terminal markdown renderer — lightweight, no dependencies beyond chalk.
 *
 * Handles the subset of markdown that agents actually produce:
 * headers, bold, inline code, code blocks, lists, blockquotes.
 * 侘び寂び — simple enough to understand at a glance.
 */

import chalk from "chalk";

export function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;

  for (const line of lines) {
    // Code block fence
    if (line.trimStart().startsWith("```")) {
      inCode = !inCode;
      if (inCode) {
        out.push(chalk.dim("  ┌" + "─".repeat(50)));
      } else {
        out.push(chalk.dim("  └" + "─".repeat(50)));
      }
      continue;
    }

    if (inCode) {
      out.push(chalk.dim("  │ ") + chalk.gray(line));
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      out.push("");
      out.push(chalk.bold(h[2]));
      out.push("");
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      out.push(chalk.dim("  │ ") + chalk.italic(inlineFmt(line.slice(2))));
      continue;
    }

    // List item
    const li = line.match(/^(\s*)[-*]\s+(.+)/);
    if (li) {
      out.push(li[1] + "  " + chalk.dim("•") + " " + inlineFmt(li[2]));
      continue;
    }

    // Numbered list
    const ol = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (ol) {
      out.push(ol[1] + "  " + inlineFmt(ol[2]));
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push(chalk.dim("─".repeat(40)));
      continue;
    }

    // Regular line
    out.push(inlineFmt(line));
  }

  return out.join("\n") + "\n";
}

function inlineFmt(text: string): string {
  return (
    text
      // Bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, m: string) => chalk.bold.italic(m))
      // Bold
      .replace(/\*\*(.+?)\*\*/g, (_, m: string) => chalk.bold(m))
      // Italic
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (_, m: string) => chalk.italic(m))
      // Inline code
      .replace(/`([^`]+)`/g, (_, m: string) => chalk.cyan(m))
  );
}
