/**
 * ANSI constants and low-level ANSI-aware string utilities.
 * No background manipulation — clean terminal default.
 *
 * Foreground color vars are initialized to sensible defaults and then
 * overwritten by `initThemeColors(theme)` at extension load time so
 * they follow the active pi theme (dark-flat, light, etc.).
 */

export const RST = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

// ── Foreground colors ── (theme-aware, overwritten by initThemeColors) ──
export let FG_LNUM   = "\x1b[38;2;100;100;100m";
export let FG_DIM    = "\x1b[38;2;80;80;80m";
export let FG_RULE   = "\x1b[38;2;50;50;50m";
export let FG_GREEN  = "\x1b[38;2;100;180;120m";
export let FG_RED    = "\x1b[38;2;200;100;100m";
export let FG_YELLOW = "\x1b[38;2;220;180;80m";
export let FG_BLUE   = "\x1b[38;2;100;140;220m";
export let FG_MUTED  = "\x1b[38;2;139;148;158m";
export let FG_STRIPE = "\x1b[38;2;40;40;40m";

// ── Diff backgrounds ── (no theme equivalent — stay hardcoded) ──
export const BG_ADD       = "\x1b[48;2;13;26;18m";
export const BG_DEL       = "\x1b[48;2;26;13;13m";
export const BG_ADD_W     = "\x1b[48;2;26;56;37m";
export const BG_DEL_W     = "\x1b[48;2;56;26;26m";
export const BG_GUTTER_ADD = "\x1b[48;2;9;18;8m";
export const BG_GUTTER_DEL = "\x1b[48;2;18;9;8m";
export const BG_EMPTY     = "\x1b[48;2;8;8;8m";

export const BORDER_BAR = "▌";
export let DIVIDER = `${FG_RULE}│${RST}`;

/**
 * Initialize foreground colors from the active pi theme.
 * Call once at extension load time. Falls back gracefully if any
 * color key is missing (keeps the hardcoded default).
 */
export function initThemeColors(theme: any): void {
  function tryFg(key: string): string | null {
    try { return theme.getFgAnsi(key); }
    catch { return null; }
  }

  FG_DIM    = tryFg("dim")             ?? FG_DIM;
  FG_MUTED  = tryFg("muted")           ?? FG_MUTED;
  FG_GREEN  = tryFg("toolDiffAdded")   ?? tryFg("success") ?? FG_GREEN;
  FG_RED    = tryFg("toolDiffRemoved") ?? tryFg("error")   ?? FG_RED;
  FG_YELLOW = tryFg("warning")         ?? FG_YELLOW;
  FG_BLUE   = tryFg("border")          ?? FG_BLUE;
  FG_RULE   = tryFg("borderMuted")     ?? FG_RULE;

  // DIVIDER depends on FG_RULE, so rebuild it
  DIVIDER = `${FG_RULE}│${RST}`;

  // FG_LNUM stays slightly lighter than FG_DIM — no exact theme key.
  // FG_STRIPE is decorative (near-black hash marks) — no theme key.
}

const ESC_RE = "\u001b";
const ANSI_RE = new RegExp(`${ESC_RE}\\[[0-9;]*m`, "g");
const ANSI_CAPTURE_RE = new RegExp(`${ESC_RE}\\[([^m]*)m`, "g");
const ANSI_PARAM_CAPTURE_RE = new RegExp(`${ESC_RE}\\[([0-9;]*)m`, "g");

/** Strip all ANSI escape sequences. */
export function strip(s: string): string {
  return s.replace(ANSI_RE, "");
}

/** Replace tabs with two spaces. */
export function tabs(s: string): string {
  return s.replace(/\t/g, "  ");
}

/** Extract the active fg/bg ANSI state at the end of `s`. */
export function ansiState(s: string): string {
  let fg = "", bg = "";
  for (const match of s.matchAll(ANSI_CAPTURE_RE)) {
    const p = match[1] ?? "";
    const seq = match[0] ?? "";
    if (p === "0") { fg = ""; bg = ""; }
    else if (p === "39") { fg = ""; }
    else if (p.startsWith("38;")) { fg = seq; }
    else if (p.startsWith("48;")) { bg = seq; }
  }
  return bg + fg;
}

/** Pad/truncate `s` to exactly `w` visible chars. ANSI-aware. */
export function fit(s: string, w: number): string {
  if (w <= 0) return "";
  const plain = strip(s);
  if (plain.length <= w) return s + " ".repeat(w - plain.length);
  const showW = w > 2 ? w - 1 : w;
  let vis = 0, i = 0;
  while (i < s.length && vis < showW) {
    if (s[i] === "\x1b") {
      const e = s.indexOf("m", i);
      if (e !== -1) { i = e + 1; continue; }
    }
    vis++; i++;
  }
  return w > 2 ? `${s.slice(0, i)}${RST}${FG_DIM}›${RST}` : `${s.slice(0, i)}${RST}`;
}

/** ANSI-aware line wrapping with a max row budget. */
export function wrapAnsi(s: string, w: number, maxRows = 2, fillBg = ""): string[] {
  if (w <= 0) return [""];
  const plain = strip(s);
  if (plain.length <= w) {
    const pad = w - plain.length;
    return pad > 0 ? [s + fillBg + " ".repeat(pad) + (fillBg ? RST : "")] : [s];
  }

  const rows: string[] = [];
  let row = "", vis = 0, i = 0;
  let onLastRow = false;
  let effW = w;

  while (i < s.length) {
    if (!onLastRow && rows.length >= maxRows - 1) {
      onLastRow = true;
      effW = w > 2 ? w - 1 : w;
    }
    if (s[i] === "\x1b") {
      const end = s.indexOf("m", i);
      if (end !== -1) { row += s.slice(i, end + 1); i = end + 1; continue; }
    }
    if (vis >= effW) {
      if (onLastRow) {
        let hasMore = false;
        for (let j = i; j < s.length; j++) {
          if (s[j] === "\x1b") { const e2 = s.indexOf("m", j); if (e2 !== -1) { j = e2; continue; } }
          hasMore = true; break;
        }
        if (hasMore && w > 2) row += `${RST}${FG_DIM}›${RST}`;
        else row += fillBg + " ".repeat(Math.max(0, w - vis)) + RST;
        rows.push(row);
        return rows;
      }
      const state = ansiState(row);
      rows.push(row + RST);
      row = state + fillBg;
      vis = 0;
      if (rows.length >= maxRows - 1) { onLastRow = true; effW = w > 2 ? w - 1 : w; }
    }
    row += s[i]; vis++; i++;
  }
  if (row.length > 0 || rows.length === 0) {
    rows.push(row + fillBg + " ".repeat(Math.max(0, w - vis)) + RST);
  }
  return rows;
}

/**
 * Clip a fully-rendered multi-line string to at most `maxRows` display rows.
 * Rows are counted as `\n`-separated lines (post-wrap, since wrapAnsi already
 * produced display rows). Adds a `… N more rows` footer when clipped.
 *
 * @param mode "head" keeps the first rows, "tail" keeps the last rows.
 */
export function clipDisplayRows(
  text: string,
  maxRows: number,
  mode: "head" | "tail" = "head",
  footerFg = FG_DIM,
): string {
  if (maxRows <= 0) return text;
  const rows = text.split("\n");
  if (rows.length <= maxRows) return text;
  const hidden = rows.length - maxRows;
  const kept = mode === "tail" ? rows.slice(-maxRows) : rows.slice(0, maxRows);
  const footer = `${footerFg}  … ${hidden} more ${mode === "tail" ? "earlier " : ""}rows${RST}`;
  return mode === "tail" ? `${footer}\n${kept.join("\n")}` : `${kept.join("\n")}\n${footer}`;
}

/** Shiki sometimes emits near-black foregrounds on dark bg. Bump those to muted. */
function isLowContrastShikiFg(params: string): boolean {
  if (params === "30" || params === "90") return true;
  if (params === "38;5;0" || params === "38;5;8") return true;
  if (!params.startsWith("38;2;")) return false;
  const parts = params.split(";").map(Number);
  if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n))) return false;
  const [, , r, g, b] = parts;
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance < 72;
}

export function normalizeShikiContrast(ansi: string): string {
  return ansi.replace(ANSI_PARAM_CAPTURE_RE, (seq, params: string) =>
    isLowContrastShikiFg(params) ? FG_MUTED : seq,
  );
}
