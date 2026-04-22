/**
 * Split (side-by-side) diff renderer with word-level highlights.
 * Falls back to unified when the terminal is too narrow or wrapping is excessive.
 */

import type { BundledLanguage } from "shiki";
import {
  BG_ADD, BG_DEL, BG_ADD_W, BG_DEL_W, BG_EMPTY,
  BG_GUTTER_ADD, BG_GUTTER_DEL,
  BOLD, BORDER_BAR, DIM,
  FG_DIM, FG_GREEN, FG_LNUM, FG_RED, FG_RULE, FG_STRIPE, RST,
  fit, tabs, wrapAnsi,
} from "../ansi.js";
import { MAX_HL_CHARS, MAX_PREVIEW_LINES, MAX_RENDER_LINES } from "../config.js";
import { hlBlock } from "../highlight.js";
import { lnum, rule, stripes, termW } from "../terminal.js";
import { injectBg } from "./inject.js";
import { type DiffLine, type ParsedDiff, WORD_DIFF_MIN_SIM, wordDiffAnalysis } from "./parse.js";
import { renderUnified } from "./unified.js";

const SPLIT_MIN_WIDTH = 150;
const SPLIT_MIN_CODE_WIDTH = 60;
const SPLIT_MAX_WRAP_RATIO = 0.2;
const SPLIT_MAX_WRAP_LINES = 8;

function shouldUseSplit(diff: ParsedDiff, tw: number, maxRows = MAX_PREVIEW_LINES): boolean {
  if (!diff.lines.length) return false;
  if (tw < SPLIT_MIN_WIDTH) return false;
  const nw = Math.max(2, String(Math.max(...diff.lines.map((l) => l.oldNum ?? l.newNum ?? 0), 0)).length);
  const half = Math.floor((tw - 1) / 2);
  const gw = nw + 5;
  const cw = Math.max(12, half - gw);
  if (cw < SPLIT_MIN_CODE_WIDTH) return false;
  const vis = diff.lines.slice(0, maxRows);
  let contentLines = 0, wrapCandidates = 0;
  for (const l of vis) {
    if (l.type === "sep") continue;
    contentLines++;
    if (tabs(l.content).length > cw) wrapCandidates++;
  }
  if (contentLines === 0) return true;
  if (wrapCandidates >= SPLIT_MAX_WRAP_LINES) return false;
  if (wrapCandidates / contentLines >= SPLIT_MAX_WRAP_RATIO) return false;
  return true;
}

export async function renderSplit(
  diff: ParsedDiff,
  language: BundledLanguage | undefined,
  max = MAX_PREVIEW_LINES,
): Promise<string> {
  const tw = termW();
  if (!shouldUseSplit(diff, tw, max)) return renderUnified(diff, language, max);
  if (!diff.lines.length) return "";

  type Row = { left: DiffLine | null; right: DiffLine | null };
  const rows: Row[] = [];
  let i = 0;
  while (i < diff.lines.length) {
    const l = diff.lines[i];
    if (l.type === "sep" || l.type === "ctx") { rows.push({ left: l, right: l }); i++; continue; }
    const dels: DiffLine[] = [], adds: DiffLine[] = [];
    while (i < diff.lines.length && diff.lines[i].type === "del") { dels.push(diff.lines[i]); i++; }
    while (i < diff.lines.length && diff.lines[i].type === "add") { adds.push(diff.lines[i]); i++; }
    const n = Math.max(dels.length, adds.length);
    for (let j = 0; j < n; j++) rows.push({ left: dels[j] ?? null, right: adds[j] ?? null });
  }

  const vis = rows.slice(0, max);
  const half = Math.floor((tw - 1) / 2);
  const nw = Math.max(2, String(Math.max(...diff.lines.map((l) => l.oldNum ?? l.newNum ?? 0), 0)).length);
  const gw = nw + 5;
  const cw = Math.max(12, half - gw);
  const canHL = diff.chars <= MAX_HL_CHARS && vis.length * 2 <= MAX_RENDER_LINES * 2;

  const leftSrc: string[] = [], rightSrc: string[] = [];
  for (const r of vis) {
    if (r.left && r.left.type !== "sep") leftSrc.push(r.left.content);
    if (r.right && r.right.type !== "sep") rightSrc.push(r.right.content);
  }
  const [leftHL, rightHL] = canHL
    ? await Promise.all([hlBlock(leftSrc.join("\n"), language), hlBlock(rightSrc.join("\n"), language)])
    : [leftSrc, rightSrc];

  let lI = 0, rI = 0;
  let stripeRow = 0;

  type HalfResult = { gutter: string; contGutter: string; bodyRows: string[] };

  function half_build(
    line: DiffLine | null,
    hl: string,
    ranges: Array<[number, number]> | null,
    side: "left" | "right",
  ): HalfResult {
    if (!line) {
      const gw2 = nw + 2;
      const gPat = FG_STRIPE + "╱".repeat(gw2) + RST;
      const g = ` ${gPat}${FG_RULE}│${RST} `;
      return { gutter: g, contGutter: g, bodyRows: [stripes(cw, stripeRow)] };
    }
    if (line.type === "sep") {
      const gap = line.newNum;
      const label = gap && gap > 0 ? `··· ${gap} lines ···` : "···";
      const g = ` ${FG_DIM}${fit("", nw + 2)}${RST}${FG_RULE}│${RST} `;
      return { gutter: g, contGutter: g, bodyRows: [`${FG_DIM}${fit(label, cw)}${RST}`] };
    }

    const isDel = line.type === "del", isAdd = line.type === "add";
    const cBg = isDel ? BG_DEL : isAdd ? BG_ADD : "";
    const sign = isDel ? "-" : isAdd ? "+" : " ";
    const num = isDel ? line.oldNum : isAdd ? line.newNum : side === "left" ? line.oldNum : line.newNum;
    const borderFg = isDel ? FG_RED : isAdd ? FG_GREEN : "";
    const border = borderFg ? `${borderFg}${BORDER_BAR}${RST}` : ` `;
    const numFg = borderFg || FG_LNUM;
    const gutterBg = isDel ? BG_GUTTER_DEL : isAdd ? BG_GUTTER_ADD : "";

    let body: string;
    if (ranges && ranges.length > 0) {
      body = injectBg(hl, ranges, cBg, isDel ? BG_DEL_W : BG_ADD_W);
    } else if (isDel || isAdd) {
      body = `${cBg}${hl}`;
    } else {
      body = `${DIM}${hl}`;
    }

    const gutter = `${border}${gutterBg}${lnum(num, nw, numFg)}${borderFg}${BOLD}${sign}${RST} ${FG_RULE}│${RST} `;
    const contGutter = `${border}${gutterBg}${" ".repeat(nw + 1)}${RST} ${FG_RULE}│${RST} `;
    const bodyRows = wrapAnsi(tabs(body), cw, 2, cBg);
    return { gutter, contGutter, bodyRows };
  }

  const out: string[] = [];
  out.push(`${rule(half)}${FG_RULE}┊${RST}${rule(half)}`);

  for (const r of vis) {
    const leftLine = r.left, rightLine = r.right;
    const paired = leftLine && rightLine && leftLine.type === "del" && rightLine.type === "add";
    const wd = paired ? wordDiffAnalysis(leftLine.content, rightLine.content) : null;

    let lResult: HalfResult, rResult: HalfResult;

    if (paired && wd && wd.similarity >= WORD_DIFF_MIN_SIM && canHL) {
      const lhl = leftHL[lI++] ?? leftLine.content;
      const rhl = rightHL[rI++] ?? rightLine.content;
      lResult = half_build(leftLine, lhl, wd.oldRanges, "left");
      rResult = half_build(rightLine, rhl, wd.newRanges, "right");
    } else {
      const lhl = leftLine && leftLine.type !== "sep" ? (leftHL[lI++] ?? leftLine?.content ?? "") : "";
      const rhl = rightLine && rightLine.type !== "sep" ? (rightHL[rI++] ?? rightLine?.content ?? "") : "";
      lResult = half_build(leftLine, lhl, null, "left");
      rResult = half_build(rightLine, rhl, null, "right");
    }

    const maxR = Math.max(lResult.bodyRows.length, rResult.bodyRows.length);
    const leftIsEmpty = !r.left;
    const rightIsEmpty = !r.right;
    for (let row = 0; row < maxR; row++) {
      const lg = row === 0 ? lResult.gutter : lResult.contGutter;
      const rg = row === 0 ? rResult.gutter : rResult.contGutter;
      const lb = lResult.bodyRows[row] ?? (leftIsEmpty ? stripes(cw, stripeRow) : `${BG_EMPTY}${" ".repeat(cw)}${RST}`);
      const rb = rResult.bodyRows[row] ?? (rightIsEmpty ? stripes(cw, stripeRow) : `${BG_EMPTY}${" ".repeat(cw)}${RST}`);
      out.push(`${lg}${lb}${FG_RULE}│${RST}${rg}${rb}`);
      stripeRow++;
    }
  }

  out.push(`${rule(half)}${FG_RULE}┊${RST}${rule(half)}`);
  if (rows.length > vis.length) {
    out.push(`${FG_DIM}  … ${rows.length - vis.length} more lines${RST}`);
  }
  return out.join("\n");
}
