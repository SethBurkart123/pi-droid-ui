/**
 * Terminal helpers — sizing, paths, formatting primitives.
 */

import { relative } from "node:path";
import { FG_DIM, FG_GREEN, FG_LNUM, FG_RED, FG_RULE, FG_STRIPE, RST } from "./ansi.js";

/** Current usable terminal width (clamped). */
export function termW(): number {
  const raw =
    process.stdout.columns ||
    (process.stderr as any).columns ||
    Number.parseInt(process.env.COLUMNS ?? "", 10) ||
    200;
  return Math.max(80, Math.min(raw - 4, 210));
}

/** Render `p` relative to cwd if nested, else tilde-ified. */
export function shortPath(cwd: string, home: string, p: string): string {
  if (!p) return "";
  const r = relative(cwd, p);
  if (!r.startsWith("..") && !r.startsWith("/")) return r;
  return p.replace(home, "~");
}

/** Horizontal rule of width `w`. */
export function rule(w: number): string {
  return `${FG_RULE}${"─".repeat(w)}${RST}`;
}

/** Right-aligned line number padded to `w` chars. */
export function lnum(n: number | null, w: number, fg = FG_LNUM): string {
  if (n === null) return " ".repeat(w);
  const v = String(n);
  return `${fg}${" ".repeat(Math.max(0, w - v.length))}${v}${RST}`;
}

/** Diagonal stripes used for empty diff sides. */
export function stripes(w: number, _rowOffset: number): string {
  return FG_STRIPE + "╱".repeat(w) + RST;
}

/** "+N added, -M removed" summary. */
export function summarize(added: number, removed: number): string {
  const p: string[] = [];
  if (added > 0) p.push(`${FG_GREEN}+${added} added${RST}`);
  if (removed > 0) p.push(`${FG_RED}-${removed} removed${RST}`);
  return p.length ? p.join(", ") : `${FG_DIM}no changes${RST}`;
}

/** Byte count → "12B" / "1.2KB" / "3.4MB". */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
