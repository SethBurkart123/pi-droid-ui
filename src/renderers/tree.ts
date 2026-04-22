/**
 * Directory tree renderer for `ls` results.
 */

import { BOLD, FG_BLUE, FG_DIM, FG_RULE, RST } from "../ansi.js";
import { MAX_PREVIEW_LINES } from "../config.js";
import { dirIcon, fileIcon } from "../icons.js";

export function renderTree(text: string): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return `${FG_DIM}(empty directory)${RST}`;

  const out: string[] = [];
  const total = lines.length;
  const show = lines.slice(0, MAX_PREVIEW_LINES);

  for (let i = 0; i < show.length; i++) {
    const entry = show[i].trim();
    const isLast = i === show.length - 1 && total <= MAX_PREVIEW_LINES;
    const prefix = isLast ? "└── " : "├── ";
    const connector = `${FG_RULE}${prefix}${RST}`;
    const isDir = entry.endsWith("/");
    const name = isDir ? entry.slice(0, -1) : entry;
    const icon = isDir ? dirIcon() : fileIcon(name);
    const fg = isDir ? FG_BLUE + BOLD : "";
    const reset = isDir ? RST : "";
    out.push(`${connector}${icon}${fg}${name}${reset}`);
  }

  if (total > MAX_PREVIEW_LINES) {
    out.push(`${FG_RULE}└── ${RST}${FG_DIM}… ${total - MAX_PREVIEW_LINES} more entries${RST}`);
  }
  return out.join("\n");
}
