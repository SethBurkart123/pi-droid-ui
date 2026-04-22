/**
 * Unified (single-column) diff renderer.
 */

import type { BundledLanguage } from "shiki";
import {
  BG_ADD, BG_DEL, BG_DEL_W, BG_ADD_W,
  BG_GUTTER_ADD, BG_GUTTER_DEL,
  BOLD, BORDER_BAR, DIM, DIVIDER,
  FG_DIM, FG_GREEN, FG_LNUM, FG_RED, RST,
  tabs, wrapAnsi,
} from "../ansi.js";
import { MAX_HL_CHARS, MAX_RENDER_LINES } from "../config.js";
import { hlBlock } from "../highlight.js";
import { lnum, rule, termW } from "../terminal.js";
import { injectBg } from "./inject.js";
import { type DiffLine, type ParsedDiff, WORD_DIFF_MIN_SIM, wordDiffAnalysis } from "./parse.js";

export async function renderUnified(
  diff: ParsedDiff,
  language: BundledLanguage | undefined,
  max = MAX_RENDER_LINES,
): Promise<string> {
  if (!diff.lines.length) return "";
  const vis = diff.lines.slice(0, max);
  const tw = termW();
  const nw = Math.max(2, String(Math.max(...vis.map((l) => l.oldNum ?? l.newNum ?? 0), 0)).length);
  const gw = nw + 5;
  const cw = Math.max(20, tw - gw);
  const canHL = diff.chars <= MAX_HL_CHARS && vis.length <= MAX_RENDER_LINES;

  const oldSrc: string[] = [], newSrc: string[] = [];
  for (const l of vis) {
    if (l.type === "ctx" || l.type === "del") oldSrc.push(l.content);
    if (l.type === "ctx" || l.type === "add") newSrc.push(l.content);
  }
  const [oldHL, newHL] = canHL
    ? await Promise.all([hlBlock(oldSrc.join("\n"), language), hlBlock(newSrc.join("\n"), language)])
    : [oldSrc, newSrc];

  let oI = 0, nI = 0, idx = 0;
  const out: string[] = [];
  out.push(rule(tw));

  function emitRow(num: number | null, sign: string, gutterBg: string, signFg: string, body: string, bodyBg = ""): void {
    const borderFg = sign === "-" ? FG_RED : sign === "+" ? FG_GREEN : "";
    const border = borderFg ? `${borderFg}${BORDER_BAR}${RST}` : ` `;
    const numFg = borderFg || FG_LNUM;
    const gutter = `${border}${gutterBg}${lnum(num, nw, numFg)}${signFg}${sign}${RST} ${DIVIDER} `;
    const contGutter = `${border}${gutterBg}${" ".repeat(nw + 1)}${RST} ${DIVIDER} `;
    const rows = wrapAnsi(tabs(body), cw, 2, bodyBg);
    out.push(`${gutter}${rows[0]}${RST}`);
    for (let r = 1; r < rows.length; r++) out.push(`${contGutter}${rows[r]}${RST}`);
  }

  while (idx < vis.length) {
    const l = vis[idx];
    if (l.type === "sep") {
      const gap = l.newNum;
      const label = gap && gap > 0 ? ` ${gap} unmodified lines ` : "···";
      const totalW = Math.min(tw, 72);
      const pad = Math.max(0, totalW - label.length - 2);
      const half1 = Math.floor(pad / 2), half2 = pad - half1;
      out.push(`${FG_DIM}${"─".repeat(half1)}${label}${"─".repeat(half2)}${RST}`);
      idx++; continue;
    }

    if (l.type === "ctx") {
      const hl = oldHL[oI] ?? l.content;
      emitRow(l.newNum, " ", "", FG_DIM, `${DIM}${hl}`);
      oI++; nI++; idx++; continue;
    }

    const dels: Array<{ l: DiffLine; hl: string }> = [];
    while (idx < vis.length && vis[idx].type === "del") {
      dels.push({ l: vis[idx], hl: oldHL[oI] ?? vis[idx].content });
      oI++; idx++;
    }
    const adds: Array<{ l: DiffLine; hl: string }> = [];
    while (idx < vis.length && vis[idx].type === "add") {
      adds.push({ l: vis[idx], hl: newHL[nI] ?? vis[idx].content });
      nI++; idx++;
    }

    const isPaired = dels.length === 1 && adds.length === 1;
    const wd = isPaired ? wordDiffAnalysis(dels[0].l.content, adds[0].l.content) : null;

    if (isPaired && wd && wd.similarity >= WORD_DIFF_MIN_SIM && canHL) {
      const delBody = injectBg(dels[0].hl, wd.oldRanges, BG_DEL, BG_DEL_W);
      const addBody = injectBg(adds[0].hl, wd.newRanges, BG_ADD, BG_ADD_W);
      emitRow(dels[0].l.oldNum, "-", BG_GUTTER_DEL, `${FG_RED}${BOLD}`, delBody, BG_DEL);
      emitRow(adds[0].l.newNum, "+", BG_GUTTER_ADD, `${FG_GREEN}${BOLD}`, addBody, BG_ADD);
      continue;
    }

    for (const d of dels) {
      emitRow(d.l.oldNum, "-", BG_GUTTER_DEL, `${FG_RED}${BOLD}`, `${BG_DEL}${d.hl}`, BG_DEL);
    }
    for (const a of adds) {
      emitRow(a.l.newNum, "+", BG_GUTTER_ADD, `${FG_GREEN}${BOLD}`, `${BG_ADD}${a.hl}`, BG_ADD);
    }
  }

  out.push(rule(tw));
  if (diff.lines.length > vis.length) {
    out.push(`${FG_DIM}  … ${diff.lines.length - vis.length} more lines${RST}`);
  }
  return out.join("\n");
}
