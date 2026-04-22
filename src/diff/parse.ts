/**
 * Diff parsing: line-level via jsdiff structuredPatch, plus word-level analysis.
 */

import * as Diff from "diff";

export interface DiffLine {
  type: "add" | "del" | "ctx" | "sep";
  oldNum: number | null;
  newNum: number | null;
  content: string;
}

export interface ParsedDiff {
  lines: DiffLine[];
  added: number;
  removed: number;
  chars: number;
}

export function parseDiff(oldContent: string, newContent: string, ctx = 3): ParsedDiff {
  const patch = Diff.structuredPatch("", "", oldContent, newContent, "", "", { context: ctx });
  const lines: DiffLine[] = [];
  let added = 0, removed = 0;

  for (let hi = 0; hi < patch.hunks.length; hi++) {
    if (hi > 0) {
      const prev = patch.hunks[hi - 1];
      const gap = patch.hunks[hi].oldStart - (prev.oldStart + prev.oldLines);
      lines.push({ type: "sep", oldNum: null, newNum: gap > 0 ? gap : null, content: "" });
    }
    const h = patch.hunks[hi];
    let oL = h.oldStart, nL = h.newStart;
    for (const raw of h.lines) {
      if (raw === "\\ No newline at end of file") continue;
      const ch = raw[0], text = raw.slice(1);
      if (ch === "+") { lines.push({ type: "add", oldNum: null, newNum: nL++, content: text }); added++; }
      else if (ch === "-") { lines.push({ type: "del", oldNum: oL++, newNum: null, content: text }); removed++; }
      else { lines.push({ type: "ctx", oldNum: oL++, newNum: nL++, content: text }); }
    }
  }
  return { lines, added, removed, chars: oldContent.length + newContent.length };
}

/** Compute per-word add/remove ranges and overall similarity in [0,1]. */
export function wordDiffAnalysis(a: string, b: string): {
  similarity: number;
  oldRanges: Array<[number, number]>;
  newRanges: Array<[number, number]>;
} {
  if (!a && !b) return { similarity: 1, oldRanges: [], newRanges: [] };
  const parts = Diff.diffWords(a, b);
  const oldRanges: Array<[number, number]> = [];
  const newRanges: Array<[number, number]> = [];
  let oPos = 0, nPos = 0, same = 0;
  for (const p of parts) {
    if (p.removed) { oldRanges.push([oPos, oPos + p.value.length]); oPos += p.value.length; }
    else if (p.added) { newRanges.push([nPos, nPos + p.value.length]); nPos += p.value.length; }
    else { const len = p.value.length; same += len; oPos += len; nPos += len; }
  }
  const maxLen = Math.max(a.length, b.length);
  return { similarity: maxLen > 0 ? same / maxLen : 1, oldRanges, newRanges };
}

export const WORD_DIFF_MIN_SIM = 0.15;
