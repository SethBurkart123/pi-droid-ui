/**
 * Shiki-based ANSI syntax highlighting with an LRU cache.
 */

import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage } from "shiki";
import { normalizeShikiContrast } from "./ansi.js";
import { CACHE_LIMIT, MAX_HL_CHARS, THEME } from "./config.js";

// Warm Shiki on load
codeToANSI("", "typescript", THEME).catch(() => {});

const _cache = new Map<string, string[]>();

function _touch(k: string, v: string[]): string[] {
  _cache.delete(k);
  _cache.set(k, v);
  while (_cache.size > CACHE_LIMIT) {
    const first = _cache.keys().next().value;
    if (first === undefined) break;
    _cache.delete(first);
  }
  return v;
}

/** Highlight `code` as `language`, returning ANSI-styled lines. Falls back to plain split on error/size. */
export async function hlBlock(code: string, language: BundledLanguage | undefined): Promise<string[]> {
  if (!code) return [""];
  if (!language || code.length > MAX_HL_CHARS) return code.split("\n");

  const k = `${THEME}\0${language}\0${code}`;
  const hit = _cache.get(k);
  if (hit) return _touch(k, hit);

  try {
    const ansi = normalizeShikiContrast(await codeToANSI(code, language, THEME));
    const out = (ansi.endsWith("\n") ? ansi.slice(0, -1) : ansi).split("\n");
    return _touch(k, out);
  } catch {
    return code.split("\n");
  }
}
