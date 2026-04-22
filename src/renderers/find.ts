/**
 * Grouped renderer for `find` results — groups matches by directory.
 */

import { basename, dirname } from "node:path";
import { BOLD, FG_BLUE, FG_DIM, FG_RULE, RST } from "../ansi.js";
import { MAX_PREVIEW_LINES } from "../config.js";
import { dirIcon, fileIcon } from "../icons.js";

export function renderFindResults(text: string): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return `${FG_DIM}(no matches)${RST}`;

  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const trimmed = line.trim();
    const dir = dirname(trimmed) || ".";
    const file = basename(trimmed);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(file);
  }

  const out: string[] = [];
  let count = 0;

  for (const [dir, files] of groups) {
    if (count > 0) out.push("");
    out.push(`${dirIcon()}${FG_BLUE}${BOLD}${dir}/${RST}`);
    for (let i = 0; i < files.length; i++) {
      if (count >= MAX_PREVIEW_LINES) {
        out.push(`  ${FG_DIM}… ${lines.length - count} more files${RST}`);
        return out.join("\n");
      }
      const isLast = i === files.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      const icon = fileIcon(files[i]);
      out.push(`  ${FG_RULE}${prefix}${RST}${icon}${files[i]}`);
      count++;
    }
  }
  return out.join("\n");
}
